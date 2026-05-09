"""
Prophet-based forecasting model (hosted fallback for Chronos-2).
Named lstm_model for legacy compatibility with the forecast router.
"""
import logging
import math

logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

MODEL_NAME = "prophet"
_WEEKS_PER_MONTH = 52 / 12


def has_enough_data(history: list) -> tuple:
    if len(history) < 2:
        return False, "Prophet requires at least 2 months of data. Add more transactions or configure Forecast Setup."
    return True, ""


def _build_prophet(n_hist: int):
    from prophet import Prophet
    m = Prophet(
        yearly_seasonality=(n_hist >= 12),
        weekly_seasonality=False,
        daily_seasonality=False,
        uncertainty_samples=0,
    )
    if n_hist >= 6:
        m.add_seasonality(name="semester", period=182.5, fourier_order=3)
    return m


def _residual_std(history: list, in_sample_preds: list) -> float:
    if len(history) < 2:
        return max(float(history[0]) * 0.15 if history else 100.0, 50.0)
    residuals = [abs(float(a) - float(p)) for a, p in zip(history, in_sample_preds)]
    mean_res = sum(residuals) / len(residuals)
    baseline = sum(history) / len(history)
    return max(mean_res, baseline * 0.08)


def _run_prophet(history: list, prediction_months: int) -> tuple:
    import pandas as pd
    from datetime import date
    from dateutil.relativedelta import relativedelta

    n = len(history)
    today = date.today()
    first_date = today.replace(day=1) - relativedelta(months=n - 1)
    dates = [first_date + relativedelta(months=i) for i in range(n)]

    df = pd.DataFrame({"ds": pd.to_datetime(dates), "y": [float(v) for v in history]})
    m = _build_prophet(n)
    m.fit(df)

    future = m.make_future_dataframe(periods=prediction_months, freq="MS")
    fc = m.predict(future)

    in_sample = fc[fc["ds"].isin(df["ds"])]["yhat"].tolist()
    std = _residual_std(list(history), in_sample)
    out_of_sample = fc.iloc[-prediction_months:]["yhat"].tolist()
    return out_of_sample, std


def forecast(history: list, future_covariates: list, prediction_months: int) -> list:
    try:
        preds, std = _run_prophet(history, prediction_months)
    except Exception:
        avg = sum(history) / max(len(history), 1)
        preds = [avg] * prediction_months
        std = max(avg * 0.15, 50.0)

    results = []
    for i, pred in enumerate(preds):
        cov = future_covariates[i] if i < len(future_covariates) else {}
        pred = max(0.0, pred)

        floor = float(cov.get("rent", 0)) + float(cov.get("food_estimate", 0))
        if floor > 0 and pred < floor:
            pred = pred * 0.3 + floor * 0.7

        pred += float(cov.get("tuition_due", 0))
        if cov.get("travel_home"):
            pred += float(cov.get("travel_cost", 0))
        pred = max(0.0, pred - float(cov.get("scholarship_received", 0)) * 0.3)

        margin = std * (1 + i * 0.05)
        results.append({
            "month_offset": i + 1,
            "median": round(pred, 2),
            "lower": round(max(0.0, pred - margin), 2),
            "upper": round(pred + margin, 2),
        })
    return results


def forecast_weekly(history: list, weekly_covariates: list, prediction_weeks: int) -> list:
    prediction_months = max(2, round(prediction_weeks / _WEEKS_PER_MONTH) + 1)

    # Group weekly history into 4-week monthly buckets
    if len(history) >= 4:
        monthly = [sum(history[i:i + 4]) for i in range(0, len(history), 4) if len(history[i:i + 4]) == 4]
    else:
        monthly = []
    if len(monthly) < 2:
        avg_w = sum(history) / max(len(history), 1)
        monthly = [avg_w * _WEEKS_PER_MONTH] * max(2, len(history))

    try:
        preds, std = _run_prophet(monthly, prediction_months)
    except Exception:
        avg = sum(monthly) / max(len(monthly), 1)
        preds = [avg] * prediction_months
        std = max(avg * 0.15, 50.0)

    results = []
    for i in range(prediction_weeks):
        mo_idx = min(int(i / _WEEKS_PER_MONTH), len(preds) - 1)
        pred_w = max(0.0, preds[mo_idx] / _WEEKS_PER_MONTH)

        cov = weekly_covariates[i] if i < len(weekly_covariates) else {}
        floor_w = float(cov.get("rent", 0)) + float(cov.get("food_estimate", 0))
        if floor_w > 0 and pred_w < floor_w:
            pred_w = pred_w * 0.3 + floor_w * 0.7

        margin_w = (std / _WEEKS_PER_MONTH) * (1 + i * 0.02)
        results.append({
            "month_offset": i + 1,
            "median": round(pred_w, 2),
            "lower": round(max(0.0, pred_w - margin_w), 2),
            "upper": round(pred_w + margin_w, 2),
        })
    return results
