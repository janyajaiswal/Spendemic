"""
Amazon Chronos-2 time-series forecasting model
Primary ML model for expense prediction with covariate support.

Architecture note
-----------------
`load_model()` is called once at FastAPI startup and the pipeline object is
cached in _PIPELINE so every request reuses the same loaded weights.

Covariate dictionary keys (all optional, pass 0 / False if unknown)
--------------------------------------------------------------------
  hours_per_week      : float   — CPT/OPT weekly work hours
  is_working          : 0 or 1  — will the user have income that month?
  is_summer_break     : 0 or 1
  is_winter_break     : 0 or 1
  travel_home         : 0 or 1  — flying home → large one-off expense spike
  tuition_due         : float   — semester tuition amount (0 if none)
  scholarship_received: float   — expected scholarship credit (0 if none)
  exchange_rate       : float   — USD per 1 unit of home currency
  health_insurance    : 0 or 1  — enrollment month (Fall/Spring)
  rent                : float   — that month's rent amount
"""

from __future__ import annotations

import sys
import warnings
from typing import Any

import numpy as np
import torch

# Silence HuggingFace / transformers progress bars in server context
warnings.filterwarnings("ignore", category=UserWarning)

# ---------------------------------------------------------------------------
# Module-level singleton — loaded once, reused across all requests
# ---------------------------------------------------------------------------
_PIPELINE: Any = None
_MODEL_ID = "amazon/chronos-2"

# Ordered list of covariate keys — order must be consistent everywhere
COVARIATE_KEYS = [
    "hours_per_week",
    "is_working",
    "is_summer_break",
    "is_winter_break",
    "travel_home",
    "tuition_due",
    "scholarship_received",
    "exchange_rate",
    "health_insurance",
    "rent",
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_model() -> None:
    """
    Load the Chronos-2 pipeline and cache it globally.
    Call this once at application startup (e.g. FastAPI lifespan).
    Downloads ~500 MB on first run; subsequent runs use the HuggingFace cache.
    """
    global _PIPELINE
    if _PIPELINE is not None:
        return  # already loaded

    try:
        from chronos import BaseChronosPipeline  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "chronos-forecasting is not installed. "
            "Run: pip install --force-reinstall --no-cache-dir "
            "\"git+https://github.com/amazon-science/chronos-forecasting.git\""
        ) from exc

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[Chronos-2] Loading model on {device} …", flush=True)

    _PIPELINE = BaseChronosPipeline.from_pretrained(
        _MODEL_ID,
        device_map=device,
        dtype=torch.bfloat16 if device == "cuda" else torch.float32,
    )
    print("[Chronos-2] Model ready.", flush=True)


def forecast(
    history: list[float],
    future_covariates: list[dict] | None = None,
    prediction_months: int = 3,
) -> list[dict]:
    """
    Forecast monthly spending for the next `prediction_months` months.

    Parameters
    ----------
    history : list[float]
        Monthly spending totals in chronological order (oldest first).
        Each value represents one calendar month's total in USD.
        Minimum: 1 (may be a synthetic cold-start anchor).  Recommended: 6+.

    future_covariates : list[dict] or None
        One dict per forecast month (length == prediction_months).
        Each dict may contain any subset of COVARIATE_KEYS.
        Missing keys default to 0.

    prediction_months : int
        How many months ahead to forecast (1–12).

    Returns
    -------
    list[dict]  — one entry per forecast month, e.g.:
        [
          {"month_offset": 1, "median": 1250.0, "lower": 980.0, "upper": 1540.0},
          {"month_offset": 2, "median": 1310.0, "lower": 1010.0, "upper": 1650.0},
          ...
        ]
    """
    if _PIPELINE is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")

    if len(history) < 1:
        raise ValueError(
            "No spending history available. "
            "Add at least one month of transactions, or fill in your rent/expenses "
            "in Forecast Setup so we can build a starting estimate."
        )

    # ---- Build context tensor  [1, T] ----
    # Covariates are appended to the history as a simple weighted adjustment.
    # Full Chronos-2 native covariate API will be wired in Step 3 once we
    # confirm the basic inference pipeline works end-to-end.
    adjusted_history = _apply_covariates(history, future_covariates, prediction_months)
    # Chronos-2 requires shape (n_series=1, n_variates=1, history_length)
    context = torch.tensor(adjusted_history, dtype=torch.float32).unsqueeze(0).unsqueeze(0)  # [1, 1, T]

    # ---- Run inference ----
    # quantile_levels: 0.1 = lower bound, 0.5 = median, 0.9 = upper bound
    quantiles, mean = _PIPELINE.predict_quantiles(
        inputs=context,
        prediction_length=prediction_months,
        quantile_levels=[0.1, 0.5, 0.9],
    )
    # predict_quantiles returns a list of tensors, one per series in the batch.
    # Take the first (only) series and squeeze to [prediction_length, n_quantiles].
    q = quantiles[0].squeeze().numpy()
    if q.ndim == 3:
        q = q[0]  # drop variate dim if present → [prediction_length, 3]

    results = []
    for i in range(prediction_months):
        results.append({
            "month_offset": i + 1,
            "lower":  float(round(max(float(q[i, 0]), 0.0), 2)),
            "median": float(round(max(float(q[i, 1]), 0.0), 2)),
            "upper":  float(round(max(float(q[i, 2]), 0.0), 2)),
        })
    return results


def has_enough_data(history: list[float]) -> tuple[bool, str]:
    """
    Check whether there is enough history to produce a meaningful forecast.

    Returns (ok: bool, message: str).
    The message is user-facing and explains what to do when ok=False.
    """
    n = len(history)
    if n == 0:
        return False, (
            "No spending data yet. Fill in your rent (and any tuition or "
            "scholarship amounts) in Forecast Setup to generate your first estimate."
        )
    if n < 3:
        return True, (
            f"Forecast is based on {n} month{'s' if n != 1 else ''} of data — "
            "confidence intervals will be wide. Accuracy improves as you log more months."
        )
    return True, ""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _apply_covariates(
    history: list[float],
    future_covariates: list[dict] | None,
    prediction_months: int,
) -> list[float]:
    """
    Encode covariates as lightweight adjustments appended to the history.

    Strategy: generate `prediction_months` synthetic "anchor" values from the
    last known month, scaled by covariate signals.  These anchor points are
    appended to the history so Chronos-2 sees the covariate influence as a
    trend continuation before it makes its probabilistic extrapolation.

    Covariate weight heuristics (USD impact per unit):
      travel_home         → +$1 200 one-off travel spike
      tuition_due         → added directly (dollar amount)
      scholarship_received→ subtracted (reduces net spend)
      is_working          → −$200 (income offset proxy)
      is_summer_break     → −$300 (lower rent / food area spending)
      is_winter_break     → −$200
      health_insurance    → +$150 (enrollment month premium)
      hours_per_week      → −$8 per hour above 10 h/wk (more work → less leisure)
      exchange_rate       → multiplier on total (home currency weakening)
      rent                → added directly (known fixed cost)
    """
    if not future_covariates:
        return history

    base = history[-1] if history else 1000.0
    anchors: list[float] = []

    for cov in future_covariates[:prediction_months]:
        delta = 0.0
        travel_cost = float(cov.get("travel_cost") or 0)
        delta += float(cov.get("travel_home", 0)) * (travel_cost if travel_cost > 0 else 1200.0)
        delta += float(cov.get("tuition_due", 0))
        delta -= float(cov.get("scholarship_received", 0))
        delta -= float(cov.get("is_working", 0)) * 200.0
        delta -= float(cov.get("is_summer_break", 0)) * 300.0
        delta -= float(cov.get("is_winter_break", 0)) * 200.0
        delta += float(cov.get("health_insurance", 0)) * 150.0
        extra_hours = max(float(cov.get("hours_per_week", 10)) - 10, 0)
        delta -= extra_hours * 8.0
        rent = float(cov.get("rent", 0))
        if rent > 0:
            delta += rent  # treat rent as a known fixed contribution
        rate = float(cov.get("exchange_rate", 1.0))
        adjusted = max((base + delta) * (rate if rate > 0 else 1.0), 0.0)
        anchors.append(round(adjusted, 2))

    return history + anchors


# ---------------------------------------------------------------------------
# Standalone test — run:  python ml_models/chronos_model.py
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 55)
    print("Chronos-2 standalone inference test")
    print("=" * 55)

    # Simulate 8 months of spending (USD) — realistic international student
    dummy_history = [1450, 1380, 1520, 1600, 980, 1050, 1420, 1390]
    #                                              ^--- summer break months

    # Covariates for the next 3 months
    dummy_covariates = [
        {"hours_per_week": 20, "is_working": 1, "rent": 750, "is_summer_break": 0},
        {"hours_per_week": 20, "is_working": 1, "rent": 750, "tuition_due": 4500},
        {"hours_per_week": 20, "is_working": 1, "rent": 750, "travel_home": 1},
    ]

    ok, msg = has_enough_data(dummy_history)
    print(f"\nData check → ok={ok}  msg='{msg}'")

    print("\nLoading model (first run downloads ~500 MB) …")
    load_model()

    print("\nRunning forecast …")
    results = forecast(dummy_history, dummy_covariates, prediction_months=3)

    print("\nForecast results:")
    print(f"{'Month':>6}  {'Lower':>8}  {'Median':>8}  {'Upper':>8}")
    print("-" * 38)
    for r in results:
        print(f"  +{r['month_offset']}    ${r['lower']:>7.2f}  ${r['median']:>7.2f}  ${r['upper']:>7.2f}")

    print("\nTest passed.")