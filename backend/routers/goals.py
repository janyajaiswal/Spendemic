from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from database import get_db
from models import Goal, Transaction, TransactionTypeEnum
from routers.auth import get_current_user
from schemas import GoalCreate, GoalUpdate, GoalResponse, GoalFundRequest, NetSavingsResponse

router = APIRouter(prefix="/api/v1/goals", tags=["goals"])


@router.get("", response_model=List[GoalResponse])
def list_goals(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id, Goal.is_active == True)
        .order_by(Goal.created_at)
        .all()
    )
    return [_to_response(g) for g in goals]


@router.get("/net-savings", response_model=NetSavingsResponse)
def net_savings(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= date(today.year, today.month, 1),
            Transaction.transaction_date <= today,
        )
        .all()
    )
    income = sum(float(t.amount_in_usd or t.amount) for t in txns if t.type == TransactionTypeEnum.INCOME)
    expenses = sum(float(t.amount_in_usd or t.amount) for t in txns if t.type == TransactionTypeEnum.EXPENSE)
    return NetSavingsResponse(
        net_savings=round(income - expenses, 2),
        month_income=round(income, 2),
        month_expenses=round(expenses, 2),
    )


@router.post("", response_model=GoalResponse, status_code=201)
def create_goal(
    body: GoalCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = Goal(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=body.name,
        target_amount=body.target_amount,
        saved_amount=0,
        currency=body.currency,
        deadline=body.deadline,
        is_active=True,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _to_response(goal)


@router.put("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: str,
    body: GoalUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = _get_goal(goal_id, current_user.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return _to_response(goal)


@router.post("/{goal_id}/fund", response_model=GoalResponse)
def fund_goal(
    goal_id: str,
    body: GoalFundRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = _get_goal(goal_id, current_user.id, db)

    today = date.today()
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= date(today.year, today.month, 1),
            Transaction.transaction_date <= today,
        )
        .all()
    )
    income = sum(float(t.amount_in_usd or t.amount) for t in txns if t.type == TransactionTypeEnum.INCOME)
    expenses = sum(float(t.amount_in_usd or t.amount) for t in txns if t.type == TransactionTypeEnum.EXPENSE)
    net = income - expenses

    if net <= 0:
        raise HTTPException(
            status_code=400,
            detail="No net savings available this month to fund a goal."
        )

    amount_to_add = min(float(body.amount), net)
    goal.saved_amount = float(goal.saved_amount) + amount_to_add
    db.commit()
    db.refresh(goal)
    return _to_response(goal)


@router.delete("/{goal_id}", status_code=200)
def delete_goal(
    goal_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = _get_goal(goal_id, current_user.id, db)
    goal.is_active = False
    db.commit()


def _get_goal(goal_id: str, user_id, db: Session) -> Goal:
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


def _to_response(goal: Goal) -> GoalResponse:
    target = float(goal.target_amount)
    saved = float(goal.saved_amount)
    pct = round(saved / target * 100, 1) if target > 0 else 0.0
    return GoalResponse(
        id=goal.id,
        user_id=goal.user_id,
        name=goal.name,
        target_amount=goal.target_amount,
        saved_amount=goal.saved_amount,
        currency=goal.currency,
        deadline=goal.deadline,
        is_active=goal.is_active,
        created_at=goal.created_at,
        progress_pct=pct,
    )
