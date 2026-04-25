"""
Alerts router — computed in-app notifications from budget utilization.
GET /api/v1/alerts  returns alerts for budgets at ≥80% or ≥100% spend.
No writes needed: alerts are derived on-the-fly from live budget data.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from routers.auth import get_current_user
from routers.budgets import _enrich
from models import Budget

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


@router.get("")
def list_alerts(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return computed alerts for budgets approaching or exceeding their limit."""
    budgets = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id, Budget.is_active == True)
        .all()
    )
    alerts = []
    for b in budgets:
        enriched = _enrich(b, db)
        if enriched.utilization >= 1.0:
            alerts.append({
                "budget_id": str(b.id),
                "category": b.category.value,
                "type": "BUDGET_EXCEEDED",
                "message": f"{b.category.value.replace('_', ' ').title()} budget exceeded — {round(enriched.utilization * 100)}% used",
                "utilization": enriched.utilization,
                "period": b.period.value,
            })
        elif enriched.utilization >= 0.8:
            alerts.append({
                "budget_id": str(b.id),
                "category": b.category.value,
                "type": "APPROACHING_LIMIT",
                "message": f"{b.category.value.replace('_', ' ').title()} budget at {round(enriched.utilization * 100)}% — approaching limit",
                "utilization": enriched.utilization,
                "period": b.period.value,
            })
    # Most severe first
    alerts.sort(key=lambda a: a["utilization"], reverse=True)
    return alerts
