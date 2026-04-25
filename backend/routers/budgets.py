"""
Budgets router — CRUD + spend tracking per category.
All endpoints require a valid JWT (Bearer token).
"""
from __future__ import annotations
import csv
import io
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from database import get_db
from models import Budget, Transaction, TransactionTypeEnum, CategoryEnum, BudgetPeriodEnum
from routers.auth import get_current_user
from schemas import BudgetCreate, BudgetUpdate, BudgetResponse

router = APIRouter(prefix="/api/v1/budgets", tags=["budgets"])


def _get_budget_or_404(budget_id: UUID, user_id: UUID, db: Session) -> Budget:
    b = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == user_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")
    return b


def _compute_spend(budget: Budget, db: Session) -> Decimal:
    """Sum expenses in this budget's category for the current period."""
    today = date.today()
    q = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == budget.user_id,
        Transaction.category == budget.category,
        Transaction.type == TransactionTypeEnum.EXPENSE,
    )
    if budget.period == BudgetPeriodEnum.MONTHLY:
        q = q.filter(
            extract("year", Transaction.transaction_date) == today.year,
            extract("month", Transaction.transaction_date) == today.month,
        )
    else:  # WEEKLY — last 7 days
        from datetime import timedelta
        week_start = today - timedelta(days=today.weekday())
        q = q.filter(Transaction.transaction_date >= week_start)
    total = q.scalar()
    return Decimal(str(total)) if total else Decimal("0")


def _enrich(budget: Budget, db: Session) -> BudgetResponse:
    spent = _compute_spend(budget, db)
    limit = Decimal(str(budget.limit_amount))
    utilization = float(spent / limit) if limit > 0 else 0.0
    r = BudgetResponse.model_validate(budget)
    r.spent = spent
    r.utilization = round(utilization, 4)
    return r


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.post("", response_model=BudgetResponse, status_code=201)
def create_budget(
    body: BudgetCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetResponse:
    """Create a spending budget for a category."""
    # Prevent duplicate active budget for same category+period
    existing = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.category == body.category,
        Budget.period == body.period,
        Budget.is_active == True,
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"An active {body.period} budget for {body.category} already exists"
        )
    b = Budget(user_id=current_user.id, **body.model_dump())
    db.add(b)
    db.commit()
    db.refresh(b)
    return _enrich(b, db)


@router.get("", response_model=list[BudgetResponse])
def list_budgets(
    active_only: bool = Query(True),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BudgetResponse]:
    """List all budgets for the current user with live spend data."""
    q = db.query(Budget).filter(Budget.user_id == current_user.id)
    if active_only:
        q = q.filter(Budget.is_active == True)
    budgets = q.order_by(Budget.category).all()
    return [_enrich(b, db) for b in budgets]


@router.get("/{budget_id}", response_model=BudgetResponse)
def get_budget(
    budget_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetResponse:
    b = _get_budget_or_404(budget_id, current_user.id, db)
    return _enrich(b, db)


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(
    budget_id: UUID,
    body: BudgetUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetResponse:
    b = _get_budget_or_404(budget_id, current_user.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(b, field, value)
    db.commit()
    db.refresh(b)
    return _enrich(b, db)


@router.delete("/{budget_id}", status_code=200)
def delete_budget(
    budget_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    b = _get_budget_or_404(budget_id, current_user.id, db)
    db.delete(b)
    db.commit()


@router.get("/export", response_class=StreamingResponse)
def export_budgets_csv(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download all budgets as a CSV file."""
    budgets = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id)
        .order_by(Budget.category)
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["category", "limit_amount", "currency", "period", "start_date", "end_date", "is_active", "spent", "utilization_pct"])
    for b in budgets:
        enriched = _enrich(b, db)
        writer.writerow([
            b.category.value,
            float(b.limit_amount),
            b.currency.value,
            b.period.value,
            b.start_date.isoformat(),
            b.end_date.isoformat() if b.end_date else "",
            b.is_active,
            float(enriched.spent) if enriched.spent else 0.0,
            round((enriched.utilization or 0.0) * 100, 1),
        ])
    output.seek(0)
    filename = f"budgets_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )