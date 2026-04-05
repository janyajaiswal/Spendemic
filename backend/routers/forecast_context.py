"""
Forecast Context router — per-month covariate data for Chronos-2.

Endpoints
---------
GET  /api/v1/forecast-context          → list all months for the current user
GET  /api/v1/forecast-context/{y}/{m}  → get a specific month (404 if none)
PUT  /api/v1/forecast-context/{y}/{m}  → upsert a month's covariates
POST /api/v1/forecast-context/bulk-copy → copy one month's values to many months
"""
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from database import get_db
from models import ForecastContext
from routers.auth import get_current_user
from schemas import ForecastContextUpsert, ForecastContextResponse, ForecastContextBulkCopy

router = APIRouter(prefix="/api/v1/forecast-context", tags=["forecast-context"])


@router.get("", response_model=list[ForecastContextResponse])
def list_contexts(
    year: int | None = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ForecastContextResponse]:
    """Return all saved forecast context rows for the current user."""
    q = db.query(ForecastContext).filter(ForecastContext.user_id == current_user.id)
    if year:
        q = q.filter(ForecastContext.year == year)
    return q.order_by(ForecastContext.year, ForecastContext.month).all()


@router.delete("", status_code=200)
def delete_all_contexts(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Delete every forecast context row for the current user."""
    deleted = (
        db.query(ForecastContext)
        .filter(ForecastContext.user_id == current_user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted}


@router.get("/{year}/{month}", response_model=ForecastContextResponse)
def get_context(
    year: int = Path(..., ge=2000, le=2100),
    month: int = Path(..., ge=1, le=12),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForecastContextResponse:
    row = _get_row(current_user.id, year, month, db)
    if not row:
        raise HTTPException(status_code=404, detail="No forecast context for this month")
    return row


@router.put("/{year}/{month}", response_model=ForecastContextResponse)
def upsert_context(
    year: int = Path(..., ge=2000, le=2100),
    month: int = Path(..., ge=1, le=12),
    body: ForecastContextUpsert = ...,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForecastContextResponse:
    """Create or fully replace the covariate row for (user, year, month)."""
    row = _get_row(current_user.id, year, month, db)
    if row is None:
        row = ForecastContext(user_id=current_user.id, year=year, month=month)
        db.add(row)
    _apply_body(row, body)
    db.commit()
    db.refresh(row)
    return row


@router.post("/bulk-copy", response_model=list[ForecastContextResponse])
def bulk_copy(
    body: ForecastContextBulkCopy,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ForecastContextResponse]:
    """
    Copy source month's covariate values to each target (year, month).
    Creates rows that don't exist yet; overwrites those that do.
    """
    source = _get_row(current_user.id, body.source_year, body.source_month, db)
    if not source:
        raise HTTPException(
            status_code=404,
            detail=f"No forecast context for {body.source_year}-{body.source_month:02d} to copy from",
        )

    source_data = ForecastContextUpsert(
        hours_per_week=source.hours_per_week,
        hourly_rate=source.hourly_rate,
        is_working=source.is_working,
        is_summer_break=source.is_summer_break,
        is_winter_break=source.is_winter_break,
        travel_home=source.travel_home,
        travel_cost=source.travel_cost,
        tuition_due=source.tuition_due,
        scholarship_received=source.scholarship_received,
        exchange_rate=source.exchange_rate,
        health_insurance=source.health_insurance,
        rent=source.rent,
        income_amount=source.income_amount,
        food_estimate=source.food_estimate,
        utilities_estimate=source.utilities_estimate,
        break_hourly_rate=source.break_hourly_rate,
        break_hours_per_week=source.break_hours_per_week,
    )

    results = []
    for target in body.targets:
        t_year = int(target.get("year", body.source_year))
        t_month = int(target.get("month", 0))
        if not (1 <= t_month <= 12):
            continue
        row = _get_row(current_user.id, t_year, t_month, db)
        if row is None:
            row = ForecastContext(user_id=current_user.id, year=t_year, month=t_month)
            db.add(row)
        _apply_body(row, source_data)
        results.append(row)

    db.commit()
    for r in results:
        db.refresh(r)
    return results


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_row(user_id, year: int, month: int, db: Session) -> ForecastContext | None:
    return (
        db.query(ForecastContext)
        .filter(
            ForecastContext.user_id == user_id,
            ForecastContext.year == year,
            ForecastContext.month == month,
        )
        .first()
    )


def _apply_body(row: ForecastContext, body: ForecastContextUpsert) -> None:
    row.hours_per_week = body.hours_per_week
    row.hourly_rate = body.hourly_rate
    row.is_working = body.is_working
    row.is_summer_break = body.is_summer_break
    row.is_winter_break = body.is_winter_break
    row.travel_home = body.travel_home
    row.travel_cost = body.travel_cost
    row.tuition_due = body.tuition_due
    row.scholarship_received = body.scholarship_received
    row.exchange_rate = body.exchange_rate
    row.health_insurance = body.health_insurance
    row.rent = body.rent
    row.income_amount = body.income_amount
    row.food_estimate = body.food_estimate
    row.utilities_estimate = body.utilities_estimate
    row.break_hourly_rate = body.break_hourly_rate
    row.break_hours_per_week = body.break_hours_per_week