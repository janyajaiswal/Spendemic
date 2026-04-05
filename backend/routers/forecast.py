"""
Forecast router — data pipeline + Chronos-2 inference.

Endpoints
---------
POST /api/v1/forecast               → run forecast with inline month data (primary)
GET  /api/v1/forecast               → run forecast using pre-saved ForecastContext rows
GET  /api/v1/forecast/to-graduation → forecast through the user's graduation date

Cold-start
----------
If zero transaction history exists, a single anchor month is synthesized from
the user's dollar amounts (rent + tuition_due - scholarship + travel_cost).
No assumed overheads. If the result is 0 the user is prompted to fill in
Forecast Setup first.
"""
from __future__ import annotations

import os
import sys
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from database import get_db
from models import Transaction, ForecastContext, TransactionTypeEnum, User
from routers.auth import get_current_user
from schemas import ForecastRequest, ForecastResponse

_ML_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml_models"))
if _ML_PATH not in sys.path:
    sys.path.insert(0, _ML_PATH)

import chronos_model  # noqa: E402

router = APIRouter(prefix="/api/v1/forecast", tags=["forecast"])


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=ForecastResponse)
def run_forecast_inline(
    body: ForecastRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForecastResponse:
    """
    Run a forecast by supplying future-month data directly in the request body.
    No pre-saved ForecastContext rows required.

    Minimum body (cold-start):
    ```json
    {
      "months": [
        {"year": 2026, "month": 4, "rent": 900},
        {"year": 2026, "month": 5, "rent": 900},
        {"year": 2026, "month": 6, "rent": 900, "is_summer_break": true}
      ]
    }
    ```
    """
    ordered = sorted(body.months, key=lambda m: (m.year, m.month))
    prediction_months = len(ordered)
    history, monthly_labels = _query_history(current_user.id, db, limit=body.history_months)
    cold_start = False

    future_covariates = []
    for m in ordered:
        cov = {k: v for k, v in {
            "rent":                 m.rent,
            "tuition_due":          m.tuition_due,
            "scholarship_received": m.scholarship_received,
            "travel_home":          int(m.travel_home),
            "travel_cost":          m.travel_cost or 0.0,
            "is_summer_break":      int(m.is_summer_break),
            "is_winter_break":      int(m.is_winter_break),
            "is_working":           int(m.is_working),
            "hours_per_week":       m.hours_per_week or 10.0,
            "income_amount":        m.income_amount or 0.0,
            "food_estimate":        m.food_estimate or 0.0,
            "utilities_estimate":   m.utilities_estimate or 0.0,
            "exchange_rate":        m.exchange_rate or 1.0,
            "health_insurance":     int(m.health_insurance),
            "hourly_rate":          m.hourly_rate,
        }.items() if v is not None}
        _derive_income(cov)
        future_covariates.append(cov)
    next_months = [(m.year, m.month) for m in ordered]

    if not history:
        m0 = ordered[0]
        anchor = _compute_anchor(
            m0.rent, m0.tuition_due, m0.scholarship_received,
            m0.travel_home, m0.travel_cost,
            food_estimate=m0.food_estimate, utilities_estimate=m0.utilities_estimate,
        )
        if anchor is None:
            raise HTTPException(
                status_code=422,
                detail="No transaction history and no spending data in request. Include at least rent, food estimate, or utilities in the first month.",
            )
        today = date.today()
        prev_mo = today.month - 1 or 12
        prev_yr = today.year if today.month > 1 else today.year - 1
        history, monthly_labels, cold_start = [anchor], [(prev_yr, prev_mo)], True

    return _execute(history, monthly_labels, future_covariates, next_months, prediction_months, cold_start)


@router.get("")
def run_forecast(
    prediction_months: int = Query(default=3, ge=1, le=12),
    prediction_weeks: int = Query(default=8, ge=1, le=52),
    granularity: Literal["weekly", "monthly"] = Query(default="weekly"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Run forecast using pre-saved ForecastContext rows. Default granularity is weekly."""
    if granularity == "weekly":
        return _run_from_db_weekly(current_user.id, prediction_weeks, db)
    return _run_from_db(current_user.id, prediction_months, db)


@router.get("/to-graduation")
def forecast_to_graduation(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Forecast through the user's graduation date (set in Settings)."""
    user: User = db.query(User).filter(User.id == current_user.id).first()
    if not user or not user.graduation_date:
        raise HTTPException(status_code=422, detail="Set your graduation date in Settings to enable this.")
    today = date.today()
    if user.graduation_date <= today:
        raise HTTPException(status_code=422, detail="Graduation date is in the past.")
    months_left = (user.graduation_date.year - today.year) * 12 + (user.graduation_date.month - today.month) + 1
    return _run_from_db(current_user.id, max(1, min(months_left, 60)), db, graduation_date=user.graduation_date)


# ---------------------------------------------------------------------------
# Shared execution — called by all three endpoints
# ---------------------------------------------------------------------------

def _execute(history, monthly_labels, future_covariates, next_months, prediction_months, cold_start, graduation_date=None) -> dict:
    ok, msg = chronos_model.has_enough_data(history)
    if not ok:
        raise HTTPException(status_code=422, detail=msg)
    if chronos_model._PIPELINE is None:
        raise HTTPException(status_code=503, detail="ML model is still loading — try again in a few seconds.")
    try:
        predictions = chronos_model.forecast(history=history, future_covariates=future_covariates, prediction_months=prediction_months)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    for pred, (yr, mo) in zip(predictions, next_months):
        pred["year"], pred["month"] = yr, mo

    warnings = []
    if msg:
        warnings.append(msg)
    if cold_start:
        warnings.append("No transaction history yet — forecast anchored on your Forecast Setup data. Accuracy improves once you log real expenses.")

    return {
        "history": [
            {"year": y, "month": m, "total": round(t, 2), "synthetic": cold_start and i == len(monthly_labels) - 1}
            for i, ((y, m), t) in enumerate(zip(monthly_labels, history))
        ],
        "predictions": predictions,
        "prediction_months": prediction_months,
        "granularity": "monthly",
        "graduation_date": graduation_date.isoformat() if graduation_date else None,
        "warnings": warnings,
        "missing_fields": _compute_missing_fields(future_covariates, prediction_months),
    }


def _run_from_db(user_id, prediction_months: int, db: Session, graduation_date=None) -> dict:
    """Build all inputs from DB (history + ForecastContext covariates) then execute."""
    history, monthly_labels = _query_history(user_id, db)
    cold_start = False

    if not history:
        anchor, anchor_label = _cold_start_from_db(user_id, db)
        if anchor is not None:
            history, monthly_labels, cold_start = [anchor], [anchor_label], True

    if monthly_labels:
        last_yr, last_mo = monthly_labels[-1]
    else:
        today = date.today()
        last_yr, last_mo = today.year, today.month

    next_months: list[tuple] = []
    yr, mo = last_yr, last_mo
    for _ in range(prediction_months):
        mo += 1
        if mo > 12:
            mo, yr = 1, yr + 1
        next_months.append((yr, mo))

    # Fetch user for break schedule and graduation date
    user: User = db.query(User).filter(User.id == user_id).first()

    future_covariates = []
    for f_yr, f_mo in next_months:
        cov = _ctx_to_dict(
            db.query(ForecastContext).filter(
                ForecastContext.user_id == user_id,
                ForecastContext.year == f_yr,
                ForecastContext.month == f_mo,
            ).first()
        )
        # Auto-apply summer/winter break flags from user's academic schedule
        if user and _month_in_break(user.summer_break_start, user.summer_break_end, f_mo):
            cov["is_summer_break"] = 1
        if user and _month_in_break(user.winter_break_start, user.winter_break_end, f_mo):
            cov["is_winter_break"] = 1
        _derive_income(cov, float(user.monthly_income) if user and user.monthly_income else None)
        # Post-graduation: no tuition or work income, living expenses continue
        if user and user.graduation_date and date(f_yr, f_mo, 1) > user.graduation_date:
            cov["tuition_due"] = 0.0
            cov["income_amount"] = 0.0
            cov["is_working"] = 0
        future_covariates.append(cov)

    return _execute(history, monthly_labels, future_covariates, next_months, prediction_months, cold_start, graduation_date)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _query_history(user_id, db: Session, limit: int | None = None) -> tuple[list[float], list[tuple]]:
    """Aggregate expense transactions into monthly USD totals (oldest first)."""
    rows = (
        db.query(
            extract("year",  Transaction.transaction_date).label("yr"),
            extract("month", Transaction.transaction_date).label("mo"),
            func.sum(func.coalesce(Transaction.amount_in_usd, Transaction.amount)).label("total"),
        )
        .filter(Transaction.user_id == user_id, Transaction.type == TransactionTypeEnum.EXPENSE)
        .group_by("yr", "mo")
        .order_by("yr", "mo")
        .all()
    )
    history = [float(r.total) for r in rows]
    labels  = [(int(r.yr), int(r.mo)) for r in rows]
    if limit and len(history) > limit:
        history, labels = history[-limit:], labels[-limit:]
    return history, labels


def _compute_anchor(
    rent, tuition_due, scholarship, travel_home, travel_cost,
    food_estimate=None, utilities_estimate=None,
) -> float | None:
    """
    Compute cold-start anchor from known monthly costs.
    Mandatory: at least rent, food_estimate, or utilities_estimate must be non-zero.
    Returns None if the total is zero (user needs to fill in Forecast Setup first).
    """
    anchor = (
        (rent or 0.0)
        + (food_estimate or 0.0)
        + (utilities_estimate or 0.0)
        + (tuition_due or 0.0)
        - (scholarship or 0.0)
        + ((travel_cost or 0.0) if travel_home else 0.0)
    )
    return round(anchor, 2) if anchor > 0 else None


def _cold_start_from_db(user_id, db: Session) -> tuple[float | None, tuple | None]:
    """Build cold-start anchor from the nearest saved ForecastContext row."""
    ctx = (
        db.query(ForecastContext)
        .filter(ForecastContext.user_id == user_id)
        .order_by(ForecastContext.year.desc(), ForecastContext.month.desc())
        .first()
    )
    if ctx is None:
        return None, None
    anchor = _compute_anchor(
        ctx.rent, ctx.tuition_due, ctx.scholarship_received, ctx.travel_home, ctx.travel_cost,
        food_estimate=float(ctx.food_estimate) if ctx.food_estimate else None,
        utilities_estimate=float(ctx.utilities_estimate) if ctx.utilities_estimate else None,
    )
    if anchor is None:
        return None, None
    today = date.today()
    prev_mo = today.month - 1 or 12
    prev_yr = today.year if today.month > 1 else today.year - 1
    return anchor, (prev_yr, prev_mo)


def _month_in_break(start, end, month: int) -> bool:
    """
    Return True if `month` (1-12) falls within the annual break window.
    Accepts either date objects (month extracted) or plain int month numbers.
    Handles year-wrap (e.g. Dec-Feb winter break).
    """
    if not start or not end:
        return False
    s = start.month if hasattr(start, "month") else int(start)
    e = end.month if hasattr(end, "month") else int(end)
    if s <= e:
        return s <= month <= e
    return month >= s or month <= e


def _ctx_to_dict(ctx) -> dict:
    """Convert a ForecastContext ORM row to a covariate dict for chronos_model."""
    if ctx is None:
        return {}
    return {
        "hours_per_week":       float(ctx.hours_per_week)       if ctx.hours_per_week       is not None else 10.0,
        "hourly_rate":          float(ctx.hourly_rate)          if ctx.hourly_rate          else None,
        "is_working":           int(ctx.is_working),
        "is_summer_break":      int(ctx.is_summer_break),
        "is_winter_break":      int(ctx.is_winter_break),
        "travel_home":          int(ctx.travel_home),
        "travel_cost":          float(ctx.travel_cost)          if ctx.travel_cost          else 0.0,
        "tuition_due":          float(ctx.tuition_due)          if ctx.tuition_due          else 0.0,
        "scholarship_received": float(ctx.scholarship_received) if ctx.scholarship_received else 0.0,
        "exchange_rate":        float(ctx.exchange_rate)         if ctx.exchange_rate         else 1.0,
        "health_insurance":     int(ctx.health_insurance),
        "rent":                 float(ctx.rent)                  if ctx.rent                  else 0.0,
        "income_amount":        float(ctx.income_amount)         if ctx.income_amount         else 0.0,
        "food_estimate":        float(ctx.food_estimate)         if ctx.food_estimate         else 0.0,
        "utilities_estimate":   float(ctx.utilities_estimate)    if ctx.utilities_estimate    else 0.0,
        "break_hourly_rate":    float(ctx.break_hourly_rate)     if ctx.break_hourly_rate     else None,
        "break_hours_per_week": float(ctx.break_hours_per_week)  if ctx.break_hours_per_week  else None,
    }


# ---------------------------------------------------------------------------
# Income + missing-field helpers
# ---------------------------------------------------------------------------

def _derive_income(cov: dict, fallback_monthly: float | None = None) -> None:
    """
    Mutate cov in-place to ensure income_amount is set.
    Priority: break rate > regular hourly rate > profile monthly_income fallback.
    Uses exact _WEEKS_PER_MONTH (52/12) instead of rounded 4.33.
    """
    if not cov.get("income_amount"):
        on_break = cov.get("is_summer_break") or cov.get("is_winter_break")
        if on_break and cov.get("break_hourly_rate") and cov.get("break_hours_per_week"):
            cov["income_amount"] = round(
                cov["break_hourly_rate"] * cov["break_hours_per_week"] * _WEEKS_PER_MONTH, 2
            )
        elif cov.get("hourly_rate") and cov.get("hours_per_week"):
            cov["income_amount"] = round(
                cov["hourly_rate"] * cov["hours_per_week"] * _WEEKS_PER_MONTH, 2
            )
        elif fallback_monthly:
            cov["income_amount"] = float(fallback_monthly)


def _compute_missing_fields(covariates: list[dict], prediction_months: int) -> list[str]:
    """
    Return human-readable names of fields absent from covariates that would
    meaningfully improve forecast accuracy for international students.
    """
    missing: set[str] = set()
    for cov in covariates:
        if not cov.get("rent"):
            missing.add("rent")
        has_income = cov.get("income_amount") or (
            cov.get("hourly_rate") and cov.get("hours_per_week")
        )
        if not has_income:
            missing.add("hourly_rate / income_amount")
        if not cov.get("food_estimate"):
            missing.add("food_estimate")
    if prediction_months > 2:
        if not any(cov.get("tuition_due") or cov.get("scholarship_received") for cov in covariates):
            missing.add("tuition_due (if enrolled)")
    if prediction_months > 6:
        if not any(cov.get("exchange_rate") and cov["exchange_rate"] != 1.0 for cov in covariates):
            missing.add("exchange_rate")
    return sorted(missing)


# ---------------------------------------------------------------------------
# Weekly pipeline
# ---------------------------------------------------------------------------

_WEEKLY_DOLLAR_KEYS = ("rent", "tuition_due", "scholarship_received", "travel_cost",
                       "income_amount", "food_estimate", "utilities_estimate")
_WEEKS_PER_MONTH = 52 / 12  # exact: 4.3333... weeks per month


def _query_history_weekly(user_id, db: Session, limit_weeks: int | None = None) -> tuple[list[float], list[tuple]]:
    """Aggregate expense transactions into ISO-weekly USD totals (oldest first)."""
    rows = (
        db.query(
            extract("isoyear", Transaction.transaction_date).label("iso_year"),
            extract("week",    Transaction.transaction_date).label("iso_week"),
            func.sum(func.coalesce(Transaction.amount_in_usd, Transaction.amount)).label("total"),
        )
        .filter(Transaction.user_id == user_id, Transaction.type == TransactionTypeEnum.EXPENSE)
        .group_by("iso_year", "iso_week")
        .order_by("iso_year", "iso_week")
        .all()
    )
    history = [float(r.total) for r in rows]
    labels  = [(int(r.iso_year), int(r.iso_week)) for r in rows]
    if limit_weeks and len(history) > limit_weeks:
        history, labels = history[-limit_weeks:], labels[-limit_weeks:]
    return history, labels


def _run_from_db_weekly(user_id, prediction_weeks: int, db: Session) -> dict:
    """Build weekly history + per-week covariates from DB, then run Chronos weekly forecast."""
    history, weekly_labels = _query_history_weekly(user_id, db)
    cold_start = False

    if not history:
        anchor, _ = _cold_start_from_db(user_id, db)
        if anchor is not None:
            weekly_anchor = round(anchor / _WEEKS_PER_MONTH, 2)
            today = date.today()
            iso = today.isocalendar()
            prev_wk = iso.week - 1 or 52
            prev_yr = iso.year if iso.week > 1 else iso.year - 1
            history, weekly_labels, cold_start = [weekly_anchor], [(prev_yr, prev_wk)], True

    if weekly_labels:
        last_yr, last_wk = weekly_labels[-1]
    else:
        today = date.today()
        iso = today.isocalendar()
        last_yr, last_wk = iso.year, iso.week

    user: User = db.query(User).filter(User.id == user_id).first()

    # Generate next N ISO weeks, mapping each to its parent calendar month's ForecastContext
    next_weeks: list[tuple] = []
    yr, wk = last_yr, last_wk
    for _ in range(prediction_weeks):
        # Advance one ISO week, handling year boundaries via date arithmetic
        try:
            next_monday = date.fromisocalendar(yr, wk + 1, 1)
        except ValueError:
            next_monday = date.fromisocalendar(yr + 1, 1, 1)
        iso = next_monday.isocalendar()
        yr, wk = iso.year, iso.week
        next_weeks.append((yr, wk))

    weekly_covariates = []
    for iso_yr, iso_wk in next_weeks:
        # Use Monday of the ISO week to determine calendar year/month
        week_monday = date.fromisocalendar(iso_yr, iso_wk, 1)
        f_yr, f_mo = week_monday.year, week_monday.month

        cov = _ctx_to_dict(
            db.query(ForecastContext).filter(
                ForecastContext.user_id == user_id,
                ForecastContext.year == f_yr,
                ForecastContext.month == f_mo,
            ).first()
        )
        # Apply break flags from user academic schedule
        if user and _month_in_break(user.summer_break_start, user.summer_break_end, f_mo):
            cov["is_summer_break"] = 1
        if user and _month_in_break(user.winter_break_start, user.winter_break_end, f_mo):
            cov["is_winter_break"] = 1
        _derive_income(cov, float(user.monthly_income) if user and user.monthly_income else None)
        # Post-graduation zeroing
        if user and user.graduation_date and date(f_yr, f_mo, 1) > user.graduation_date:
            cov["tuition_due"] = 0.0
            cov["income_amount"] = 0.0
            cov["is_working"] = 0
        # Scale monthly dollar amounts down to weekly
        for key in _WEEKLY_DOLLAR_KEYS:
            if cov.get(key):
                cov[key] = round(cov[key] / _WEEKS_PER_MONTH, 2)
        weekly_covariates.append(cov)

    ok, msg = chronos_model.has_enough_data(history)
    if not ok:
        raise HTTPException(status_code=422, detail=msg)
    if chronos_model._PIPELINE is None:
        raise HTTPException(status_code=503, detail="ML model is still loading — try again in a few seconds.")
    try:
        predictions = chronos_model.forecast_weekly(
            history=history,
            weekly_covariates=weekly_covariates,
            prediction_weeks=prediction_weeks,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    for pred, (iso_yr, iso_wk) in zip(predictions, next_weeks):
        pred["year"] = iso_yr
        pred["week"] = iso_wk

    warnings = []
    if msg:
        warnings.append(msg)
    if cold_start:
        warnings.append("No transaction history yet — forecast anchored on your Forecast Setup data. Accuracy improves once you log real expenses.")

    return {
        "history": [
            {"year": y, "week": w, "total": round(t, 2), "synthetic": cold_start and i == len(weekly_labels) - 1}
            for i, ((y, w), t) in enumerate(zip(weekly_labels, history))
        ],
        "predictions": predictions,
        "prediction_weeks": prediction_weeks,
        "granularity": "weekly",
        "graduation_date": None,
        "warnings": warnings,
        "missing_fields": _compute_missing_fields(weekly_covariates, round(prediction_weeks / _WEEKS_PER_MONTH)),
    }