"""
Transactions router — CRUD + monthly summary.
All endpoints require a valid JWT (Bearer token).
"""
from __future__ import annotations
import csv
import io
import os
import uuid as uuid_lib
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Optional
from uuid import UUID

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from database import get_db
from models import Transaction, TransactionTypeEnum, CategoryEnum, RecurringFrequencyEnum
from routers.auth import get_current_user
from routers.exchange_rates import _FALLBACK_RATES
from schemas import TransactionCreate, TransactionUpdate, TransactionResponse, TransactionSummary, WeeklyTransactionSummary, ReceiptUploadResponse

RECEIPTS_DIR = Path(__file__).parent.parent / "uploads" / "receipts"
RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_RECEIPT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_RECEIPT_BYTES = 10 * 1024 * 1024  # 10 MB

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _to_usd(amount: Decimal, currency: str) -> Decimal:
    """Convert amount to USD using fallback rates (rate = units per 1 USD)."""
    rate = _FALLBACK_RATES.get(currency.upper(), 1.0)
    return round(amount / Decimal(str(rate)), 2)


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
                        amount_in_usd=_to_usd(Decimal(str(tmpl.amount)), tmpl.currency.value),
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
        amount_in_usd=_to_usd(Decimal(str(body.amount)), body.currency),
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
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
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
    if start_date:
        q = q.filter(Transaction.transaction_date >= start_date)
    if end_date:
        q = q.filter(Transaction.transaction_date <= end_date)

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


@router.get("/weekly-summary", response_model=list[WeeklyTransactionSummary])
def get_weekly_summary(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WeeklyTransactionSummary]:
    """Return weekly expense totals grouped by ISO week number."""
    from models import TransactionTypeEnum as TTE
    q = (
        db.query(
            extract("isoyear", Transaction.transaction_date).label("iso_year"),
            extract("week",    Transaction.transaction_date).label("iso_week"),
            func.min(Transaction.transaction_date).label("week_start"),
            func.max(Transaction.transaction_date).label("week_end"),
            func.sum(func.coalesce(Transaction.amount_in_usd, Transaction.amount)).label("total"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == TTE.EXPENSE,
        )
    )
    if year:
        q = q.filter(extract("isoyear", Transaction.transaction_date) == year)
    rows = q.group_by("iso_year", "iso_week").order_by("iso_year", "iso_week").all()
    return [
        WeeklyTransactionSummary(
            year=int(r.iso_year),
            week=int(r.iso_week),
            week_start=r.week_start,
            week_end=r.week_end,
            total=float(round(r.total, 2)),
        )
        for r in rows
    ]


@router.get("/export", response_class=StreamingResponse)
def export_transactions_csv(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download transactions as a CSV file."""
    q = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if year:
        q = q.filter(extract("year", Transaction.transaction_date) == year)
    if month:
        q = q.filter(extract("month", Transaction.transaction_date) == month)
    if start_date:
        q = q.filter(Transaction.transaction_date >= start_date)
    if end_date:
        q = q.filter(Transaction.transaction_date <= end_date)
    rows = q.order_by(Transaction.transaction_date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "type", "category", "amount", "currency", "amount_usd", "description", "notes", "recurring"])
    for t in rows:
        writer.writerow([
            t.transaction_date.isoformat(),
            t.type.value,
            t.category.value,
            float(t.amount),
            t.currency.value,
            float(t.amount_in_usd) if t.amount_in_usd else "",
            t.description or "",
            t.notes or "",
            t.recurring_frequency.value if t.is_recurring and t.recurring_frequency else "",
        ])
    output.seek(0)
    filename = f"transactions_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
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


@router.delete("", status_code=200)
def delete_all_transactions(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Delete every transaction belonging to the current user. Returns count deleted."""
    deleted = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted}


@router.delete("/{transaction_id}", status_code=200)
def delete_transaction(
    transaction_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    tx = _get_transaction_or_404(transaction_id, current_user.id, db)
    db.delete(tx)
    db.commit()


@router.post("/{transaction_id}/receipt", response_model=ReceiptUploadResponse)
async def upload_receipt(
    transaction_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a receipt image for a transaction. Returns a suggested category."""
    tx = _get_transaction_or_404(transaction_id, current_user.id, db)

    if file.content_type not in ALLOWED_RECEIPT_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Allowed: jpeg, png, webp, gif")
    contents = await file.read()
    if len(contents) > MAX_RECEIPT_BYTES:
        raise HTTPException(status_code=413, detail="Receipt image must be under 10 MB")

    user_dir = RECEIPTS_DIR / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    ext = file.content_type.split("/")[1].replace("jpeg", "jpg")
    filename = f"{transaction_id}.{ext}"
    (user_dir / filename).write_bytes(contents)

    base_url = str(request.base_url).rstrip("/")
    receipt_url = f"{base_url}/uploads/receipts/{current_user.id}/{filename}"

    tx.receipt_url = receipt_url
    db.commit()

    # Attempt LLM category suggestion from description + filename heuristic
    suggested_category = _guess_category_from_description(tx.description or file.filename or "")

    return ReceiptUploadResponse(
        receipt_url=receipt_url,
        suggested_category=suggested_category,
    )


def _guess_category_from_description(text: str) -> Optional[str]:
    """Simple keyword-based category guesser as a fallback when LLM is unavailable."""
    text = text.lower()
    mapping = {
        "FOOD": ["restaurant", "cafe", "coffee", "pizza", "burger", "sushi", "boba", "grocery", "safeway", "trader joe", "aldi", "walmart food", "chipotle", "mcdonald", "starbucks"],
        "TRANSPORTATION": ["uber", "lyft", "bus", "metro", "gas", "parking", "bart", "mta"],
        "HOUSING": ["rent", "lease", "apartment", "landlord"],
        "UTILITIES": ["electric", "internet", "wifi", "phone", "at&t", "verizon", "t-mobile", "comcast"],
        "EDUCATION": ["tuition", "textbook", "course", "udemy", "coursera", "amazon books"],
        "HEALTHCARE": ["pharmacy", "cvs", "walgreens", "doctor", "clinic", "insurance"],
        "ENTERTAINMENT": ["netflix", "spotify", "hulu", "movie", "concert", "ticket"],
        "TRAVEL": ["flight", "airline", "hotel", "airbnb", "expedia", "booking"],
        "SHOPPING": ["amazon", "target", "walmart", "h&m", "zara", "clothing"],
    }
    for category, keywords in mapping.items():
        if any(kw in text for kw in keywords):
            return category
    return None