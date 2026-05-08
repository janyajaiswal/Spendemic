"""
Prophet-based student spending forecaster with numpy LSTM fallback.

Prophet is Meta's decomposable time-series model — trend + seasonality + custom events.
It outperforms a from-scratch neural net on small datasets (< 100 data points) because
it has far fewer parameters (trend knots + Fourier terms) relative to the data available,
and it handles academic-calendar seasonality natively via add_seasonality().

Fallback chain: Prophet → numpy LSTM → linear trend

Public interface (unchanged from original):
  has_enough_data(history) -> (bool, str)
  forecast(history, future_covariates, prediction_months) -> list[dict]
  forecast_weekly(history, weekly_covariates, prediction_weeks) -> list[dict]
  MODEL_NAME: str  — "prophet" or "lstm-fallback"
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

import numpy as np

_log = logging.getLogger(__name__)
_WEEKS_PER_MONTH: float = 52 / 12

# ── Prophet import ────────────────────────────────────────────────────────────

try:
    import pandas as pd
    from prophet import Prophet
    logging.getLogger("prophet").setLevel(logging.ERROR)
    logging.getLogger("cmdstanpy").setLevel(logging.ERROR)
    _PROPHET_OK = True
except Exception:
    _PROPHET_OK = False

MODEL_NAME: str = "prophet" if _PROPHET_OK else "lstm-fallback"


# ════════════════════════════════════════════════════════════════════════════
# SECTION 1 — shared covariate helpers
# ════════════════════════════════════════════════════════════════════════════

def _valid_date(y: int, m: int, d: int) -> bool:
    try:
        date(y, m, d)
        return True
    except ValueError:
        return False


def _is_rent_week(iso_year: int, iso_week: int, rent_day: int = 1) -> bool:
    try:
        monday = date.fromisocalendar(iso_year, iso_week, 1)
        return any(
            _valid_date(monday.year, monday.month, monday.day + d)
            and date(monday.year, monday.month, monday.day + d).day == rent_day
            for d in range(7)
        )
    except Exception:
        return False


def _is_rent_week_from_ts(ts: "pd.Timestamp", rent_day: int = 1) -> bool:
    """Timestamp-aware rent-week check (used by Prophet path)."""
    try:
        d = ts.date()
        monday = d - timedelta(days=d.weekday())
        return any((monday + timedelta(days=i)).day == rent_day for i in range(7))
    except Exception:
        return False


def _covariate_delta(cov: dict, base: float) -> float:
    """Monthly covariate delta — mirrors chronos_model._apply_covariates()."""
    delta = 0.0
    delta += float(cov.get("travel_home", 0)) * (float(cov.get("travel_cost") or 0) or 1200.0)
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


def _covariate_delta_weekly(
    cov: dict, base: float, ts: "pd.Timestamp | None" = None
) -> float:
    """
    Weekly covariate delta.
    ts: actual calendar timestamp from Prophet's future dataframe — enables
        precise rent-week detection without iso_yr/iso_wk lookup.
    """
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

    # Rent: full monthly amount in rent week, $0 all other weeks
    rent = float(cov.get("rent_monthly") or cov.get("rent") or 0)
    if rent > 0:
        if ts is not None:
            in_rent_wk = _is_rent_week_from_ts(ts)
        else:
            iso_yr, iso_wk = cov.get("iso_yr"), cov.get("iso_wk")
            in_rent_wk = _is_rent_week(int(iso_yr), int(iso_wk)) if iso_yr and iso_wk else False
        delta += rent if in_rent_wk else 0.0

    delta += float(cov.get("food_estimate") or 0)
    delta += float(cov.get("utilities_estimate") or 0)
    delta += float(cov.get("tuition_due") or 0)
    delta -= float(cov.get("scholarship_received") or 0)
    delta += float(cov.get("travel_home", 0)) * (float(cov.get("travel_cost") or 0) or 1200.0)

    xr = float(cov.get("exchange_rate") or 1.0)
    if xr > 0 and xr != 1.0:
        delta *= xr
    return delta


# ════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Prophet engine
# ════════════════════════════════════════════════════════════════════════════

def _monthly_df(history: list[float]) -> "pd.DataFrame":
    """Build a monthly Prophet DataFrame from spending history, working back from today."""
    today = date.today()
    rows = []
    n = len(history)
    for idx, val in enumerate(history):
        months_ago = n - 1 - idx
        m = today.month - months_ago
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        try:
            rows.append({"ds": pd.Timestamp(date(y, m, 1)), "y": max(0.0, float(val))})
        except Exception:
            continue
    return pd.DataFrame(rows)


def _weekly_df(history: list[float]) -> "pd.DataFrame":
    """Build a weekly Prophet DataFrame from spending history, working back from today."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    n = len(history)
    rows = [
        {
            "ds": pd.Timestamp(monday - timedelta(weeks=(n - 1 - idx))),
            "y": max(0.0, float(val)),
        }
        for idx, val in enumerate(history)
    ]
    return pd.DataFrame(rows)


def _build_prophet(n_hist: int, freq: str) -> "Prophet":
    """
    Configure Prophet for student spending data.
    - yearly_seasonality only when there's enough data to estimate it
    - semester seasonality (182.5 day period) captures spring/fall spending cycles
    - changepoint_prior_scale=0.35: flexible enough for graduation/lifestyle changes
    - uncertainty_samples=0: disables Stan MCMC sampling (cuts 10s → <1s per request);
      we compute our own residual-based confidence bands instead
    """
    use_yearly = (freq == "MS" and n_hist >= 12) or (freq == "W" and n_hist >= 52)
    m = Prophet(
        yearly_seasonality=use_yearly,
        weekly_seasonality=False,
        daily_seasonality=False,
        interval_width=0.8,
        changepoint_prior_scale=0.35,
        seasonality_prior_scale=10.0,
        uncertainty_samples=0,  # skip MCMC; we use residual bands below
    )
    # Semester cycle: spring semester (Jan–May) + fall semester (Aug–Dec) ≈ 182.5 days
    if n_hist >= 6:
        m.add_seasonality(name="semester", period=182.5, fourier_order=3)
    return m


def _residual_std(df: "pd.DataFrame", fc: "pd.DataFrame") -> float:
    """
    Residual std from in-sample Prophet fit.
    Falls back to 20% of history std when Prophet overfits (near-zero residuals),
    which happens when the dataset is small relative to model complexity.
    """
    hist_fc = fc.iloc[: len(df)]
    errors = df["y"].values - hist_fc["yhat"].values
    r_std = float(np.std(errors)) if len(errors) > 1 else 0.0
    hist_std = float(df["y"].std())
    # Always keep at least 20% of the history spread as the band floor
    return max(r_std, hist_std * 0.20, 1.0)


def _prophet_monthly(
    history: list[float],
    future_covariates: list[dict],
    prediction_months: int,
) -> list[dict]:
    df = _monthly_df(history)
    m = _build_prophet(len(history), "MS")
    m.fit(df, iter=200)  # 200 L-BFGS iterations — plenty for ≤ 60 data points
    future = m.make_future_dataframe(periods=prediction_months, freq="MS")
    fc = m.predict(future)

    # Residual std from in-sample fit — our uncertainty calibration
    res_std = _residual_std(df, fc)
    future_fc = fc.tail(prediction_months).reset_index(drop=True)

    results = []
    for i, row in future_fc.iterrows():
        cov = future_covariates[i] if i < len(future_covariates) else {}
        base = max(0.0, float(row["yhat"]))
        median = max(0.0, base + _covariate_delta(cov, base))
        # Residual-based bands widening with horizon (same approach as LSTM fallback)
        uncertainty = res_std * (1.0 + i * 0.12)
        results.append({
            "month_offset": i + 1,
            "lower":  round(max(0.0, median - uncertainty * 1.5), 2),
            "median": round(median, 2),
            "upper":  round(median + uncertainty * 1.5, 2),
        })
    return results


def _prophet_weekly(
    history: list[float],
    weekly_covariates: list[dict],
    prediction_weeks: int,
) -> list[dict]:
    df = _weekly_df(history)
    m = _build_prophet(len(history), "W")
    m.fit(df, iter=200)
    future = m.make_future_dataframe(periods=prediction_weeks, freq="W")
    fc = m.predict(future)

    res_std = _residual_std(df, fc)
    future_fc = fc.tail(prediction_weeks).reset_index(drop=True)

    results = []
    for i, row in future_fc.iterrows():
        cov = weekly_covariates[i] if i < len(weekly_covariates) else {}
        base = max(0.0, float(row["yhat"]))
        # Pass the actual timestamp for precise rent-week detection
        delta = _covariate_delta_weekly(cov, base, ts=row["ds"])
        median = max(0.0, base + delta)
        uncertainty = res_std * (1.0 + i * 0.07)
        results.append({
            "week_offset": i + 1,
            "lower":  round(max(0.0, median - uncertainty * 1.5), 2),
            "median": round(median, 2),
            "upper":  round(median + uncertainty * 1.5, 2),
        })
    return results


# ════════════════════════════════════════════════════════════════════════════
# SECTION 3 — numpy LSTM fallback (kept intact from original)
# ════════════════════════════════════════════════════════════════════════════

def _sigmoid(x: np.ndarray) -> np.ndarray:
    pos = x >= 0
    result = np.empty_like(x, dtype=np.float64)
    result[pos] = 1.0 / (1.0 + np.exp(-x[pos]))
    ex = np.exp(x[~pos])
    result[~pos] = ex / (1.0 + ex)
    return result


class _LSTM:
    def __init__(self, hidden: int = 32, seed: int = 42):
        rng = np.random.default_rng(seed)
        H = hidden
        D = 1 + H
        scale = np.sqrt(2.0 / D)
        self.W = rng.normal(0.0, scale, (4 * H, D)).astype(np.float64)
        self.b = np.zeros(4 * H, dtype=np.float64)
        self.b[H: 2 * H] = 1.0
        self.Wq = rng.normal(0.0, 0.01, (3, H)).astype(np.float64)
        self.bq = np.zeros(3, dtype=np.float64)
        self.H = H

    def _step(self, x: float, h: np.ndarray, c: np.ndarray):
        H = self.H
        z = np.concatenate([h, np.array([x], dtype=np.float64)])
        g = self.W @ z + self.b
        f = _sigmoid(g[:H])
        i = _sigmoid(g[H: 2 * H])
        gc = np.tanh(g[2 * H: 3 * H])
        o = _sigmoid(g[3 * H:])
        c_ = f * c + i * gc
        h_ = o * np.tanh(c_)
        return h_, c_, (z, f, i, gc, o, c_, c)

    def forward(self, seq: list[float]) -> tuple[np.ndarray, np.ndarray, list]:
        h, c = np.zeros(self.H), np.zeros(self.H)
        caches: list = []
        for x in seq:
            h, c, cache = self._step(x, h, c)
            caches.append(cache)
        return h, c, caches

    def predict(self, h: np.ndarray) -> np.ndarray:
        return self.Wq @ h + self.bq

    def train_step(self, seq: list[float], target: float, lr: float, wd: float) -> float:
        QUANTILES = [0.2, 0.5, 0.8]
        H = self.H
        h, c, caches = self.forward(seq)
        q = self.predict(h)
        loss = 0.0
        dq = np.zeros(3, dtype=np.float64)
        for j, tau in enumerate(QUANTILES):
            err = target - q[j]
            loss += tau * err if err >= 0.0 else (tau - 1.0) * err
            dq[j] = -tau if err >= 0.0 else (1.0 - tau)
        dWq = np.outer(dq, h)
        dbq = dq.copy()
        dh = self.Wq.T @ dq
        dW = np.zeros_like(self.W)
        db = np.zeros_like(self.b)
        dc = np.zeros(H, dtype=np.float64)
        for t in reversed(range(len(caches))):
            z, f, i, gc, o, c_new, c_prev = caches[t]
            tanh_c = np.tanh(c_new)
            do = dh * tanh_c
            dc += dh * o * (1.0 - tanh_c ** 2)
            df = dc * c_prev
            di = dc * gc
            dgc = dc * i
            dc = dc * f
            do_r = do * o * (1.0 - o)
            df_r = df * f * (1.0 - f)
            di_r = di * i * (1.0 - i)
            dgc_r = dgc * (1.0 - gc ** 2)
            d_gates = np.concatenate([df_r, di_r, dgc_r, do_r])
            dW += np.outer(d_gates, z)
            db += d_gates
            dh = (self.W.T @ d_gates)[:H]
        gnorm = np.sqrt(np.sum(dW**2) + np.sum(db**2) + np.sum(dWq**2) + np.sum(dbq**2))
        if gnorm > 5.0:
            s = 5.0 / gnorm
            dW *= s; db *= s; dWq *= s; dbq *= s
        self.W -= lr * (dW + wd * self.W)
        self.b -= lr * db
        self.Wq -= lr * (dWq + wd * self.Wq)
        self.bq -= lr * dbq
        return float(loss)

    def fit(self, seqs: list[list[float]], targets: list[float],
            epochs: int = 250, lr: float = 0.01, wd: float = 1e-4) -> None:
        n = max(len(seqs), 1)
        for epoch in range(epochs):
            total = sum(self.train_step(s, t, lr, wd) for s, t in zip(seqs, targets))
            if (epoch + 1) % 60 == 0:
                lr *= 0.65
            if total / n < 5e-5:
                break


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
    tgts = [float(norm[i + lookback]) for i in range(len(norm) - lookback)]
    return seqs, tgts


def _cap_band(lower: float, median: float, upper: float, hist_len: int):
    upper_cap = median * (2.0 + max(0, 6 - hist_len) * 0.1)
    lower_floor = median * max(0.15, 0.30 - 0.03 * hist_len)
    return (
        max(0.0, min(lower, lower_floor) if lower < lower_floor else lower),
        max(0.0, median),
        min(upper, upper_cap) if upper > upper_cap else upper,
    )


def _build_anchors(history: list[float], future_covariates: list[dict], n: int) -> list[float]:
    recent = history[-4:] if len(history) >= 4 else history
    weights = [0.1, 0.2, 0.3, 0.4][-len(recent):]
    base = sum(w * v for w, v in zip(weights, recent)) / sum(weights)
    anchors: list[float] = []
    for cov in future_covariates[:n]:
        anchor = max(0.0, base + _covariate_delta(cov, base))
        anchors.append(anchor)
        base = anchor
    return list(history) + anchors


def _build_anchors_weekly(history: list[float], weekly_covariates: list[dict], n: int) -> list[float]:
    recent = history[-4:] if len(history) >= 4 else history
    weights = [0.1, 0.2, 0.3, 0.4][-len(recent):]
    base = sum(w * v for w, v in zip(weights, recent)) / sum(weights)
    anchors: list[float] = []
    for cov in weekly_covariates[:n]:
        anchor = max(0.0, base + _covariate_delta_weekly(cov, base))
        anchors.append(anchor)
        base = anchor
    return list(history) + anchors


def _lstm_monthly(
    history: list[float],
    future_covariates: list[dict],
    prediction_months: int,
) -> list[dict]:
    history = _clip_outliers(history)
    extended = _build_anchors(history, future_covariates, prediction_months)
    if not extended or all(v == 0.0 for v in extended):
        return [{"month_offset": i + 1, "lower": 0.0, "median": 0.0, "upper": 0.0}
                for i in range(prediction_months)]
    arr = np.array(extended, dtype=np.float64)
    mean, std = float(arr.mean()), float(arr.std()) + 1e-8
    norm = (arr - mean) / std
    hist_norm = norm[: len(history)]
    lookback = min(4, max(1, len(hist_norm) - 1))
    seqs, tgts = _sliding_windows(hist_norm, lookback)
    model = _LSTM(hidden=32, seed=42)
    model.fit(seqs, tgts, epochs=250, lr=0.012, wd=1e-4)
    residuals = [abs(tgt - float(model.predict(model.forward(seq)[0])[1])) for seq, tgt in zip(seqs, tgts)]
    residual_std = float(np.std(residuals)) if residuals else 0.3
    h, c, _ = model.forward(list(hist_norm))
    last_val = float(hist_norm[-1]) if len(hist_norm) > 0 else 0.0
    results: list[dict] = []
    for i in range(prediction_months):
        h, c, _ = model._step(last_val, h, c)
        q = model.predict(h)
        raw_median = float(q[1]) * std + mean
        anchor = extended[len(history) + i]
        blend_alpha = min(0.5, 0.3 + i * 0.04)
        median = blend_alpha * anchor + (1.0 - blend_alpha) * raw_median
        uncertainty = residual_std * std * (1.0 + i * 0.12)
        lower, median, upper = _cap_band(median - uncertainty * 1.6, median, median + uncertainty * 1.6, len(history))
        results.append({
            "month_offset": i + 1,
            "lower": round(max(0.0, lower), 2),
            "median": round(max(0.0, median), 2),
            "upper": round(max(0.0, upper), 2),
        })
        last_val = (median - mean) / std
    return results


def _lstm_weekly(
    history: list[float],
    weekly_covariates: list[dict],
    prediction_weeks: int,
) -> list[dict]:
    history = _clip_outliers(history)
    extended = _build_anchors_weekly(history, weekly_covariates, prediction_weeks)
    if not extended or all(v == 0.0 for v in extended):
        return [{"week_offset": i + 1, "lower": 0.0, "median": 0.0, "upper": 0.0}
                for i in range(prediction_weeks)]
    arr = np.array(extended, dtype=np.float64)
    mean, std = float(arr.mean()), float(arr.std()) + 1e-8
    norm = (arr - mean) / std
    hist_norm = norm[: len(history)]
    lookback = min(6, max(1, len(hist_norm) - 1))
    seqs, tgts = _sliding_windows(hist_norm, lookback)
    model = _LSTM(hidden=32, seed=42)
    model.fit(seqs, tgts, epochs=250, lr=0.012, wd=1e-4)
    residuals = [abs(tgt - float(model.predict(model.forward(seq)[0])[1])) for seq, tgt in zip(seqs, tgts)]
    residual_std = float(np.std(residuals)) if residuals else 0.3
    h, c, _ = model.forward(list(hist_norm))
    last_val = float(hist_norm[-1]) if len(hist_norm) > 0 else 0.0
    results: list[dict] = []
    for i in range(prediction_weeks):
        h, c, _ = model._step(last_val, h, c)
        q = model.predict(h)
        raw_median = float(q[1]) * std + mean
        anchor = extended[len(history) + i]
        blend_alpha = min(0.5, 0.3 + i * 0.025)
        median = blend_alpha * anchor + (1.0 - blend_alpha) * raw_median
        uncertainty = residual_std * std * (1.0 + i * 0.06)
        lower, median, upper = _cap_band(median - uncertainty * 1.6, median, median + uncertainty * 1.6, len(history))
        results.append({
            "week_offset": i + 1,
            "lower": round(max(0.0, lower), 2),
            "median": round(max(0.0, median), 2),
            "upper": round(max(0.0, upper), 2),
        })
        last_val = (median - mean) / std
    return results


# ════════════════════════════════════════════════════════════════════════════
# SECTION 4 — public interface
# ════════════════════════════════════════════════════════════════════════════

def has_enough_data(history: list[float]) -> tuple[bool, str]:
    if not history or len(history) < 1:
        return False, "No spending data found."
    if len(history) < 3:
        return True, "Very few data points — confidence bands will be wide."
    return True, ""


def forecast(
    history: list[float],
    future_covariates: list[dict],
    prediction_months: int,
) -> list[dict]:
    if _PROPHET_OK and len(history) >= 4:
        try:
            return _prophet_monthly(history, future_covariates, prediction_months)
        except Exception as exc:
            _log.warning("Prophet monthly failed (%s) — falling back to LSTM", exc)
    return _lstm_monthly(history, future_covariates, prediction_months)


def forecast_weekly(
    history: list[float],
    weekly_covariates: list[dict],
    prediction_weeks: int,
) -> list[dict]:
    if _PROPHET_OK and len(history) >= 4:
        try:
            return _prophet_weekly(history, weekly_covariates, prediction_weeks)
        except Exception as exc:
            _log.warning("Prophet weekly failed (%s) — falling back to LSTM", exc)
    return _lstm_weekly(history, weekly_covariates, prediction_weeks)
