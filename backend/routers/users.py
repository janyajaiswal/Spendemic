"""
AI Financial Planner - User Management API Endpoints
CRUD operations for user management
"""
from __future__ import annotations
import json
import math
import uuid as uuid_lib
from datetime import date
from dateutil.relativedelta import relativedelta
from typing import List, Optional
from uuid import UUID
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import User
from schemas import UserCreate, UserUpdate, UserResponse, NotificationPreferencesUpdate, LoanProjectionResponse, LoanMonthPoint
from routers.auth import get_current_user

UPLOADS_DIR = Path(__file__).parent.parent / "uploads" / "avatars"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB

router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"]
)


# ==================== CURRENT USER (JWT-protected) — must be before /{user_id} ====================

@router.get("/me", response_model=UserResponse, summary="Get my profile")
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user


@router.put("/me", response_model=UserResponse, summary="Update my profile")
async def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
    return current_user


@router.post("/me/avatar", response_model=UserResponse, summary="Upload profile picture")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Allowed: jpeg, png, gif, webp",
        )
    contents = await file.read()
    if len(contents) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be under 5 MB",
        )
    ext = file.content_type.split("/")[1].replace("jpeg", "jpg")
    filename = f"{current_user.id}.{ext}"
    dest = UPLOADS_DIR / filename
    dest.write_bytes(contents)
    base_url = str(request.base_url).rstrip("/")
    current_user.profile_picture_url = f"{base_url}/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me/notification-preferences", response_model=UserResponse, summary="Update notification preferences")
async def update_notification_preferences(
    body: NotificationPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    existing: dict = {}
    if current_user.notification_preferences:
        try:
            existing = json.loads(current_user.notification_preferences)
        except (json.JSONDecodeError, TypeError):
            existing = {}
    updates = body.model_dump(exclude_unset=True)
    existing.update(updates)
    current_user.notification_preferences = json.dumps(existing)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me/loan-projection", response_model=LoanProjectionResponse, summary="Loan repayment projection")
async def loan_projection(
    current_user: User = Depends(get_current_user),
) -> LoanProjectionResponse:
    if not current_user.total_loan_amount or not current_user.monthly_loan_payment:
        raise HTTPException(
            status_code=400,
            detail="Set total_loan_amount and monthly_loan_payment in your profile first."
        )
    total = float(current_user.total_loan_amount)
    payment = float(current_user.monthly_loan_payment)
    if payment <= 0:
        raise HTTPException(status_code=400, detail="Monthly loan payment must be greater than 0.")

    start = current_user.loan_start_date or date.today()
    months_remaining = math.ceil(total / payment)
    payoff_date = start + relativedelta(months=months_remaining)

    schedule: list[LoanMonthPoint] = []
    balance = total
    cursor = start
    for i in range(1, months_remaining + 1):
        balance = max(0.0, balance - payment)
        schedule.append(LoanMonthPoint(
            month_number=i,
            year=cursor.year,
            month=cursor.month,
            remaining_balance=round(balance, 2),
        ))
        cursor = cursor + relativedelta(months=1)

    return LoanProjectionResponse(
        total_loan_amount=total,
        monthly_payment=payment,
        months_remaining=months_remaining,
        payoff_date=payoff_date,
        monthly_schedule=schedule,
    )


# ==================== CREATE USER ====================

@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    description="Create a new user account with financial profile and student information"
)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Create a new user with the following information:

    - **email**: Valid email address (must be unique)
    - **name**: User's full name
    - **home_currency**: Currency from user's home country
    - **study_country_currency**: Currency in country of study
    - **monthly_income**: Optional monthly income amount
    - **income_frequency**: How often income is received
    - **scholarship_amount**: Optional scholarship amount
    - **scholarship_frequency**: How often scholarship is received
    - **university**: Name of university
    - **student_status**: Academic level (undergraduate, graduate, etc.)
    - **visa_type**: Type of visa held
    - **max_work_hours_per_week**: Maximum allowed work hours
    - **graduation_date**: Expected graduation date
    - **total_loan_amount**: Total student loan amount
    - **monthly_loan_payment**: Monthly loan payment amount
    - **loan_start_date**: When loan repayment begins
    - **timezone**: User's timezone
    """
    try:
        # Create User instance from Pydantic model
        db_user = User(**user_data.model_dump())

        # Add to database
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        return db_user

    except IntegrityError as e:
        db.rollback()
        # Email uniqueness violation
        if "email" in str(e.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity error"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating user: {str(e)}"
        )


# ==================== GET SINGLE USER ====================

@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
    description="Retrieve a specific user's information by their UUID"
)
async def get_user(
    user_id: UUID,
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Retrieve user information by ID.

    - **user_id**: UUID of the user to retrieve

    Returns the complete user profile including financial and student information.
    """
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )

    return user


# ==================== GET ALL USERS ====================

@router.get(
    "",
    response_model=List[UserResponse],
    summary="Get all users",
    description="Retrieve a list of all users with optional pagination"
)
async def get_users(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    active_only: bool = Query(False, description="Filter for active users only"),
    db: Session = Depends(get_db)
) -> List[UserResponse]:
    """
    Retrieve all users with pagination.

    - **skip**: Number of records to skip (for pagination)
    - **limit**: Maximum number of records to return (max 1000)
    - **active_only**: If true, only return active users

    Returns a list of user profiles.
    """
    query = db.query(User)

    # Filter by active status if requested
    if active_only:
        query = query.filter(User.is_active == True)

    # Apply pagination
    users = query.offset(skip).limit(limit).all()

    return users


# ==================== GET USER BY EMAIL ====================

@router.get(
    "/email/{email}",
    response_model=UserResponse,
    summary="Get user by email",
    description="Retrieve a user's information by their email address"
)
async def get_user_by_email(
    email: str,
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Retrieve user information by email address.

    - **email**: Email address of the user to retrieve

    Returns the complete user profile.
    """
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{email}' not found"
        )

    return user


# ==================== UPDATE USER ====================

@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user",
    description="Update a user's information (partial updates supported)"
)
async def update_user(
    user_id: UUID,
    user_update: UserUpdate,
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Update user information. Only provided fields will be updated.

    - **user_id**: UUID of the user to update
    - All user fields are optional for partial updates

    Returns the updated user profile.
    """
    # Check if user exists
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )

    try:
        # Update only provided fields
        update_data = user_update.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(db_user, field, value)

        db.commit()
        db.refresh(db_user)

        return db_user

    except IntegrityError as e:
        db.rollback()
        if "email" in str(e.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email address is already in use by another user"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity error"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating user: {str(e)}"
        )


# ==================== DELETE USER ====================

@router.delete(
    "/{user_id}",
    status_code=200,
    summary="Delete user",
    description="Permanently delete a user account"
)
async def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db)
) -> None:
    """
    Delete a user account permanently.

    - **user_id**: UUID of the user to delete

    This action cannot be undone. Returns 204 No Content on success.
    """
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )

    try:
        db.delete(db_user)
        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting user: {str(e)}"
        )


# ==================== DEACTIVATE USER ====================

@router.patch(
    "/{user_id}/deactivate",
    response_model=UserResponse,
    summary="Deactivate user account",
    description="Soft-delete by marking user as inactive"
)
async def deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Deactivate a user account (soft delete).

    - **user_id**: UUID of the user to deactivate

    The account is marked as inactive but not deleted from the database.
    """
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )

    db_user.is_active = False
    db.commit()
    db.refresh(db_user)

    return db_user


# ==================== REACTIVATE USER ====================

@router.patch(
    "/{user_id}/reactivate",
    response_model=UserResponse,
    summary="Reactivate user account",
    description="Restore a deactivated user account"
)
async def reactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Reactivate a deactivated user account.

    - **user_id**: UUID of the user to reactivate

    Marks the account as active again.
    """
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )

    db_user.is_active = True
    db.commit()
    db.refresh(db_user)

    return db_user

