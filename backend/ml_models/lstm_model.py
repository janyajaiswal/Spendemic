"""
Lightweight numpy-only LSTM for student spending forecasting.

Trains per-user on their historical data + covariate-adjusted anchors at inference time.
No torch/tensorflow dependency — deploys on Render free tier.
Same public interface as chronos_model.py: forecast() and forecast_weekly().
"""
from __future__ import annotations

import numpy as np
from datetime import date

_WEEKS_PER_MONTH: float = 52 / 12

# ── numerics ─────────────────────────────────────────────────────────────────

def _sigmoid(x: np.ndarray) -> np.ndarray:
    """Numerically stable sigmoid."""
    pos = x >= 0
    result = np.empty_like(x, dtype=np.float64)
    result[pos]  = 1.0 / (1.0 + np.exp(-x[pos]))
    ex = np.exp(x[~pos])
    result[~pos] = ex / (1.0 + ex)
    return result


# ── LSTM cell ─────────────────────────────────────────────────────────────────

class _LSTM:
    """
    Single-layer LSTM.  Input dim = 1 (normalised spending), hidden = 32.
    Output: 3 quantile heads [lower, median, upper] via pinball loss.
    Trained with vanilla BPTT + SGD + gradient clipping + weight decay.
    """

    def __init__(self, hidden: int = 32, seed: int = 42):
        rng = np.random.default_rng(seed)
        H = hidden
        D = 1 + H                         # input_size=1 + hidden_size
        scale = np.sqrt(2.0 / D)

        # Combined gate matrix [Wf | Wi | Wg | Wo], shape (4H, D)
        self.W = rng.normal(0.0, scale, (4 * H, D)).astype(np.float64)
        self.b = np.zeros(4 * H, dtype=np.float64)
        self.b[H: 2 * H] = 1.0           # forget-gate bias = 1 (standard init)

        # Quantile output layer: 3 heads × H
        self.Wq = rng.normal(0.0, 0.01, (3, H)).astype(np.float64)
        self.bq = np.zeros(3, dtype=np.float64)
        self.H  = H

    # ── forward ──────────────────────────────────────────────────────────────

    def _step(self, x: float, h: np.ndarray, c: np.ndarray):
        H   = self.H
        inp = np.array([x], dtype=np.float64)
        z   = np.concatenate([h, inp])        # (H+1,)
        g   = self.W @ z + self.b             # (4H,)
        f   = _sigmoid(g[:H])
        i   = _sigmoid(g[H: 2 * H])
        gc  = np.tanh(g[2 * H: 3 * H])
        o   = _sigmoid(g[3 * H:])
        c_  = f * c + i * gc
        h_  = o * np.tanh(c_)
        return h_, c_, (z, f, i, gc, o, c_, c)

    def forward(self, seq: list[float]) -> tuple[np.ndarray, np.ndarray, list]:
        h, c = np.zeros(self.H), np.zeros(self.H)
        caches: list = []
        for x in seq:
            h, c, cache = self._step(x, h, c)
            caches.append(cache)
        return h, c, caches

    def predict(self, h: np.ndarray) -> np.ndarray:
        return self.Wq @ h + self.bq          # (3,)

    # ── training ─────────────────────────────────────────────────────────────

    def train_step(self, seq: list[float], target: float, lr: float, wd: float) -> float:
        QUANTILES = [0.2, 0.5, 0.8]
        H = self.H

        # forward
        h, c, caches = self.forward(seq)
        q = self.predict(h)

        # pinball loss + gradient
        loss = 0.0
        dq = np.zeros(3, dtype=np.float64)
        for j, tau in enumerate(QUANTILES):
            err = target - q[j]
            loss += tau * err if err >= 0.0 else (tau - 1.0) * err
            dq[j] = -tau if err >= 0.0 else (1.0 - tau)

        # output-layer grads
        dWq = np.outer(dq, h)
        dbq = dq.copy()
        dh  = self.Wq.T @ dq

        # BPTT
        dW  = np.zeros_like(self.W)
        db  = np.zeros_like(self.b)
        dc  = np.zeros(H, dtype=np.float64)

        for t in reversed(range(len(caches))):
            z, f, i, gc, o, c_new, c_prev = caches[t]
            tanh_c = np.tanh(c_new)

            do  = dh * tanh_c
            dc += dh * o * (1.0 - tanh_c ** 2)

            df  = dc * c_prev
            di  = dc * gc
            dgc = dc * i
            dc  = dc * f                       # gradient to c_{t-1}

            do_r  = do  * o  * (1.0 - o)
            df_r  = df  * f  * (1.0 - f)
            di_r  = di  * i  * (1.0 - i)
            dgc_r = dgc * (1.0 - gc ** 2)

            d_gates = np.concatenate([df_r, di_r, dgc_r, do_r])
            dW += np.outer(d_gates, z)
            db += d_gates

            d_z = self.W.T @ d_gates
            dh  = d_z[:H]

        # gradient clipping
        gnorm = np.sqrt(np.sum(dW**2) + np.sum(db**2) +
                        np.sum(dWq**2) + np.sum(dbq**2))
        if gnorm > 5.0:
            scale = 5.0 / gnorm
            dW *= scale; db *= scale; dWq *= scale; dbq *= scale

        # weight update (SGD + L2 decay)
        self.W  -= lr * (dW  + wd * self.W)
        self.b  -= lr * db
        self.Wq -= lr * (dWq + wd * self.Wq)
        self.bq -= lr * dbq

        return float(loss)

    def fit(self, seqs: list[list[float]], targets: list[float],
            epochs: int = 250, lr: float = 0.01, wd: float = 1e-4) -> None:
        n = max(len(seqs), 1)
        for epoch in range(epochs):
            total = sum(self.train_step(s, t, lr, wd)
                        for s, t in zip(seqs, targets))
            if (epoch + 1) % 60 == 0:
                lr *= 0.65
            if total / n < 5e-5:
                break


# ── data helpers ──────────────────────────────────────────────────────────────

def _clip_outliers(history: list[float]) -> list[float]:
    if len(history) < 3:
        return history
    med = float(np.median(history))
    cap = 3.0 * med if med > 0 else float(np.max(history))
    return [min(v, cap) for v in history]


def _sliding_windows(norm: np.ndarray, lookback: int):
    if len(norm) <= lookback:
        return [list(norm)], [float(norm[-1])]
    seqs = [list(norm[i: i + lookback]) for i in range(len(norm) - lookback)]
    tgts = [float(norm[i + lookback])   for i in range(len(norm) - lookback)]
    return seqs, tgts


def _cap_band(lower: float, median: float, upper: float, hist_len: int):
    upper_cap  = median * (2.0 + max(0, 6 - hist_len) * 0.1)
    lower_floor = median * max(0.15, 0.30 - 0.03 * hist_len)
    return (
        max(0.0, min(lower, lower_floor) if lower < lower_floor else lower),
        max(0.0, median),
        min(upper, upper_cap) if upper > upper_cap else upper,
    )


# ── covariate helpers (mirrors chronos_model._apply_covariates) ──────────────

def _covariate_delta(cov: dict, base: float) -> float:
    """Return the spending delta (positive = more expensive) for one period."""
    delta = 0.0

    travel = float(cov.get("travel_home", 0)) * (
        float(cov.get("travel_cost") or 0) or 1200.0
    )
    delta += travel
    delta += float(cov.get("tuition_due") or 0)
    delta -= float(cov.get("scholarship_received") or 0)

    income = float(cov.get("income_amount") or 0)
    if income > 0:
        delta -= min(income * 0.08, 300.0)
    elif cov.get("is_working"):
        delta -= 150.0

    if cov.get("is_summer_break"):
        delta -= max(300.0, base * 0.15)
    if cov.get("is_winter_break"):
        delta -= max(200.0, base * 0.10)
    if cov.get("health_insurance"):
        delta += 150.0

    delta += float(cov.get("rent") or 0)
    delta += float(cov.get("food_estimate") or 0)
    delta += float(cov.get("utilities_estimate") or 0)

    xr = float(cov.get("exchange_rate") or 1.0)
    if xr > 0 and xr != 1.0:
        delta *= xr

    return delta


def _build_anchors(history: list[float], future_covariates: list[dict],
                   n: int) -> list[float]:
    """
    Append n synthetic anchor values to history using covariate heuristics.
    Same strategy as chronos_model._apply_covariates().
    Returns extended list (len = original + n).
    """
    recent  = history[-4:] if len(history) >= 4 else history
    weights = [0.1, 0.2, 0.3, 0.4][-len(recent):]
    w_sum   = sum(weights)
    base    = sum(w * v for w, v in zip(weights, recent)) / w_sum

    anchors: list[float] = []
    for cov in future_covariates[:n]:
        delta  = _covariate_delta(cov, base)
        anchor = max(0.0, base + delta)
        anchors.append(anchor)
        base = anchor
    return list(history) + anchors


# ── weekly covariate delta (rent handled per-week) ────────────────────────────

def _is_rent_week(iso_year: int, iso_week: int, rent_day: int = 1) -> bool:
    try:
        monday = date.fromisocalendar(iso_year, iso_week, 1)
        return any((monday.replace(day=1) if (monday.day + d) <= 1
                    else date(monday.year, monday.month, monday.day + d)).day == rent_day
                   for d in range(7)
                   if 1 <= monday.day + d <= 31
                   and _valid_date(monday.year, monday.month, monday.day + d))
    except Exception:
        return False


def _valid_date(y, m, d) -> bool:
    try:
        date(y, m, d); return True
    except ValueError:
        return False


def _covariate_delta_weekly(cov: dict, base: float) -> float:
    """Weekly version of _covariate_delta.  Rent handled by caller."""
    delta = 0.0
    income = float(cov.get("income_amount") or 0)
    if income > 0:
        delta -= min(income * 0.08, round(300.0 / _WEEKS_PER_MONTH, 2))
    elif cov.get("is_working"):
        delta -= round(150.0 / _WEEKS_PER_MONTH, 2)
    if cov.get("is_summer_break"):
        delta -= max(round(300.0 / _WEEKS_PER_MONTH, 2), base * 0.15)
    if cov.get("is_winter_break"):
        delta -= max(round(200.0 / _WEEKS_PER_MONTH, 2), base * 0.10)
    if cov.get("health_insurance"):
        delta += round(150.0 / _WEEKS_PER_MONTH, 2)

    # Rent: full monthly in rent-week, $0 otherwise
    rent_monthly = float(cov.get("rent_monthly") or 0)
    iso_yr = cov.get("iso_yr")
    iso_wk = cov.get("iso_wk")
    if rent_monthly > 0 and iso_yr and iso_wk:
        delta += rent_monthly if _is_rent_week(int(iso_yr), int(iso_wk)) else 0.0
    else:
        delta += float(cov.get("rent") or 0)

    delta += float(cov.get("food_estimate") or 0)
    delta += float(cov.get("utilities_estimate") or 0)
    delta += float(cov.get("tuition_due") or 0)
    delta -= float(cov.get("scholarship_received") or 0)

    xr = float(cov.get("exchange_rate") or 1.0)
    if xr > 0 and xr != 1.0:
        delta *= xr
    return delta


def _build_anchors_weekly(history: list[float], weekly_covariates: list[dict],
                          n: int) -> list[float]:
    recent  = history[-4:] if len(history) >= 4 else history
    weights = [0.1, 0.2, 0.3, 0.4][-len(recent):]
    w_sum   = sum(weights)
    base    = sum(w * v for w, v in zip(weights, recent)) / w_sum

    anchors: list[float] = []
    for cov in weekly_covariates[:n]:
        delta  = _covariate_delta_weekly(cov, base)
        anchor = max(0.0, base + delta)
        anchors.append(anchor)
        base = anchor
    return list(history) + anchors


# ── public interface ──────────────────────────────────────────────────────────

def has_enough_data(history: list[float]) -> tuple[bool, str]:
    """Same interface as chronos_model.has_enough_data()."""
    n = len(history)
    if n < 1:
        return False, "No spending data found."
    if n < 3:
        return True, "⚠ Very few data points — confidence intervals will be wide."
    return True, ""


def forecast(history: list[float], future_covariates: list[dict],
             prediction_months: int) -> list[dict]:
    """
    Monthly LSTM forecast.  Same return format as chronos_model.forecast().
    Trains a 32-unit numpy LSTM on the user's covariate-extended history.
    """
    history = _clip_outliers(history)

    # Build synthetic anchor values for future months (same as Chronos pipeline)
    extended = _build_anchors(history, future_covariates, prediction_months)
    if not extended or all(v == 0.0 for v in extended):
        return [{"month_offset": i + 1, "lower": 0.0, "median": 0.0, "upper": 0.0}
                for i in range(prediction_months)]

    arr  = np.array(extended, dtype=np.float64)
    mean = float(arr.mean())
    std  = float(arr.std()) + 1e-8
    norm = (arr - mean) / std

    # Train only on historical portion (anchors are held out as test targets)
    hist_norm = norm[: len(history)]
    lookback  = min(4, max(1, len(hist_norm) - 1))
    seqs, tgts = _sliding_windows(hist_norm, lookback)

    model = _LSTM(hidden=32, seed=42)
    model.fit(seqs, tgts, epochs=250, lr=0.012, wd=1e-4)

    # Compute training residuals for confidence-band calibration
    residuals: list[float] = []
    for seq, tgt in zip(seqs, tgts):
        h, _, _ = model.forward(seq)
        q = model.predict(h)
        residuals.append(abs(tgt - float(q[1])))
    residual_std = float(np.std(residuals)) if residuals else 0.3

    # Warm up hidden state on full history
    h, c, _ = model.forward(list(hist_norm))

    results: list[dict] = []
    last_val = float(hist_norm[-1]) if len(hist_norm) > 0 else 0.0

    for i in range(prediction_months):
        h, c, _ = model._step(last_val, h, c)
        q = model.predict(h)                  # (3,) normalised quantiles

        # Denormalise
        raw_lower  = float(q[0]) * std + mean
        raw_median = float(q[1]) * std + mean
        raw_upper  = float(q[2]) * std + mean

        # Blend LSTM prediction with covariate anchor (50/50 at short horizons)
        anchor = extended[len(history) + i]
        blend_alpha = min(0.5, 0.3 + i * 0.04)   # lean more on anchor further out
        median = blend_alpha * anchor + (1.0 - blend_alpha) * raw_median

        # Calibrated confidence band
        uncertainty = residual_std * std * (1.0 + i * 0.12)
        lower = median - uncertainty * 1.6
        upper = median + uncertainty * 1.6

        lower, median, upper = _cap_band(lower, median, upper, len(history))

        results.append({
            "month_offset": i + 1,
            "lower":  round(max(0.0, lower),  2),
            "median": round(max(0.0, median), 2),
            "upper":  round(max(0.0, upper),  2),
        })
        last_val = (median - mean) / std

    return results


def forecast_weekly(history: list[float], weekly_covariates: list[dict],
                    prediction_weeks: int) -> list[dict]:
    """
    Weekly LSTM forecast.  Same return format as chronos_model.forecast_weekly().
    """
    history = _clip_outliers(history)
    extended = _build_anchors_weekly(history, weekly_covariates, prediction_weeks)
    if not extended or all(v == 0.0 for v in extended):
        return [{"week_offset": i + 1, "lower": 0.0, "median": 0.0, "upper": 0.0}
                for i in range(prediction_weeks)]

    arr  = np.array(extended, dtype=np.float64)
    mean = float(arr.mean())
    std  = float(arr.std()) + 1e-8
    norm = (arr - mean) / std

    hist_norm = norm[: len(history)]
    lookback  = min(6, max(1, len(hist_norm) - 1))
    seqs, tgts = _sliding_windows(hist_norm, lookback)

    model = _LSTM(hidden=32, seed=42)
    model.fit(seqs, tgts, epochs=250, lr=0.012, wd=1e-4)

    residuals: list[float] = []
    for seq, tgt in zip(seqs, tgts):
        h, _, _ = model.forward(seq)
        q = model.predict(h)
        residuals.append(abs(tgt - float(q[1])))
    residual_std = float(np.std(residuals)) if residuals else 0.3

    h, c, _ = model.forward(list(hist_norm))
    last_val = float(hist_norm[-1]) if len(hist_norm) > 0 else 0.0
    results: list[dict] = []

    for i in range(prediction_weeks):
        h, c, _ = model._step(last_val, h, c)
        q = model.predict(h)

        raw_median = float(q[1]) * std + mean
        anchor     = extended[len(history) + i]
        blend_alpha = min(0.5, 0.3 + i * 0.025)
        median  = blend_alpha * anchor + (1.0 - blend_alpha) * raw_median

        uncertainty = residual_std * std * (1.0 + i * 0.06)
        lower = median - uncertainty * 1.6
        upper = median + uncertainty * 1.6
        lower, median, upper = _cap_band(lower, median, upper, len(history))

        results.append({
            "week_offset": i + 1,
            "lower":  round(max(0.0, lower),  2),
            "median": round(max(0.0, median), 2),
            "upper":  round(max(0.0, upper),  2),
        })
        last_val = (median - mean) / std

    return results
