"""
Transactions router — CRUD + monthly summary.
All endpoints require a valid JWT (Bearer token).
"""
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from database import get_db
from models import Transaction, TransactionTypeEnum, CategoryEnum, RecurringFrequencyEnum
from routers.auth import get_current_user
from schemas import TransactionCreate, TransactionUpdate, TransactionResponse, TransactionSummary

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _next_occurrence(current: date, freq: RecurringFrequencyEnum) -> date:
    if freq == RecurringFrequencyEnum.DAILY:
        return current + timedelta(days=1)
    if freq == RecurringFrequencyEnum.WEEKLY:
        return current + timedelta(weeks=1)
    if freq == RecurringFrequencyEnum.BI_WEEKLY:
        return current + timedelta(weeks=2)
    if freq == RecurringFrequencyEnum.MONTHLY:
        return current + relativedelta(months=1)
    if freq == RecurringFrequencyEnum.QUARTERLY:
        return current + relativedelta(months=3)
    return current + relativedelta(years=1)  # ANNUALLY


def _materialize_recurring(user_id: UUID, through: date, db: Session) -> None:
    """Generate child transaction rows for all recurring templates up to `through`."""
    templates = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.is_recurring == True,
            Transaction.recurring_parent_id == None,
        )
        .all()
    )
    created = False
    for tmpl in templates:
        if not tmpl.recurring_frequency:
            continue
        existing_dates = {
            row.transaction_date
            for row in db.query(Transaction.transaction_date).filter(
                Transaction.recurring_parent_id == tmpl.id
            )
        }
        next_d = _next_occurrence(tmpl.transaction_date, tmpl.recurring_frequency)
        while next_d <= through:
            if next_d not in existing_dates:
                db.add(
                    Transaction(
                        user_id=user_id,
                        amount=tmpl.amount,
                        currency=tmpl.currency,
                        type=tmpl.type,
                        category=tmpl.category,
                        description=tmpl.description,
                        transaction_date=next_d,
                        is_recurring=False,
                        is_generated=True,
                        recurring_parent_id=tmpl.id,
                    )
                )
                created = True
            next_d = _next_occurrence(next_d, tmpl.recurring_frequency)
    if created:
        db.commit()


def _get_transaction_or_404(
    transaction_id: UUID, user_id: UUID, db: Session
) -> Transaction:
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == user_id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.post("", response_model=TransactionResponse, status_code=201)
def create_transaction(
    body: TransactionCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionResponse:
    """Create a new income or expense transaction."""
    tx = Transaction(
        user_id=current_user.id,
        amount=body.amount,
        currency=body.currency,
        type=body.type,
        category=body.category,
        description=body.description,
        transaction_date=body.transaction_date,
        is_recurring=body.is_recurring,
        recurring_frequency=body.recurring_frequency if body.is_recurring else None,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    type: Optional[TransactionTypeEnum] = Query(None),
    category: Optional[CategoryEnum] = Query(None),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TransactionResponse]:
    """List transactions with optional filters."""
    _materialize_recurring(current_user.id, date.today(), db)
    q = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if type:
        q = q.filter(Transaction.type == type)
    if category:
        q = q.filter(Transaction.category == category)
    if year:
        q = q.filter(extract("year", Transaction.transaction_date) == year)
    if month:
        q = q.filter(extract("month", Transaction.transaction_date) == month)

    return (
        q.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )


@router.get("/summary", response_model=TransactionSummary)
def get_summary(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionSummary:
    """Return income/expense totals and breakdown by category for a period."""
    today = date.today()
    _year = year or today.year
    _month = month or today.month

    period_start = date(_year, _month, 1)
    period_end = date(_year, _month, monthrange(_year, _month)[1])

    rows = (
        db.query(
            Transaction.type,
            Transaction.category,
            func.sum(Transaction.amount).label("total"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= period_start,
            Transaction.transaction_date <= period_end,
        )
        .group_by(Transaction.type, Transaction.category)
        .all()
    )

    total_income = Decimal("0")
    total_expenses = Decimal("0")
    by_category: dict[str, str] = {}

    for row in rows:
        cat_key = row.category.value
        if row.type == TransactionTypeEnum.INCOME:
            total_income += row.total
            by_category[cat_key] = str(round(row.total, 2))
        else:
            total_expenses += row.total
            by_category[cat_key] = str(round(row.total, 2))

    return TransactionSummary(
        total_income=round(total_income, 2),
        total_expenses=round(total_expenses, 2),
        net=round(total_income - total_expenses, 2),
        by_category=by_category,
        period_start=period_start,
        period_end=period_end,
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionResponse:
    return _get_transaction_or_404(transaction_id, current_user.id, db)


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: UUID,
    body: TransactionUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionResponse:
    tx = _get_transaction_or_404(transaction_id, current_user.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    tx = _get_transaction_or_404(transaction_id, current_user.id, db)
    db.delete(tx)
    db.commit()