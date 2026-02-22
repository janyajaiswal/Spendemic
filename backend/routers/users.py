"""
AI Financial Planner - User Management API Endpoints
CRUD operations for user management
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import User
from schemas import UserCreate, UserUpdate, UserResponse

router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"]
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
    status_code=status.HTTP_204_NO_CONTENT,
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