"""
AI Financial Planner - Pydantic Schemas
Defines validation models for API requests and responses
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, EmailStr, ConfigDict

from models import (
    CurrencyEnum,
    IncomeFrequencyEnum,
    ScholarshipFrequencyEnum,
    StudentStatusEnum,
    VisaTypeEnum,
)


# ==================== USER SCHEMAS ====================

class UserCreate(BaseModel):
    """
    Schema for creating a new user.
    Used in POST /api/v1/users endpoint.
    """
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=200)
    home_currency: CurrencyEnum = CurrencyEnum.USD
    study_country_currency: CurrencyEnum = CurrencyEnum.USD
    monthly_income: Optional[Decimal] = None
    income_frequency: Optional[IncomeFrequencyEnum] = None
    scholarship_amount: Optional[Decimal] = None
    scholarship_frequency: Optional[ScholarshipFrequencyEnum] = None
    university: Optional[str] = None
    student_status: Optional[StudentStatusEnum] = None
    visa_type: Optional[VisaTypeEnum] = None
    max_work_hours_per_week: Optional[int] = None
    graduation_date: Optional[date] = None
    total_loan_amount: Optional[Decimal] = None
    monthly_loan_payment: Optional[Decimal] = None
    loan_start_date: Optional[date] = None
    timezone: str = "UTC"

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Strip whitespace and validate non-empty name."""
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty or only whitespace")
        return v

    @field_validator(
        'monthly_income',
        'scholarship_amount',
        'total_loan_amount',
        'monthly_loan_payment'
    )
    @classmethod
    def validate_positive_amounts(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        """Validate that monetary amounts are non-negative."""
        if v is not None and v < 0:
            raise ValueError(
                "Monetary amounts must be positive. "
                "Please enter a value greater than or equal to 0."
            )
        return v

    @field_validator('max_work_hours_per_week')
    @classmethod
    def validate_work_hours(cls, v: Optional[int]) -> Optional[int]:
        """Validate work hours are within reasonable bounds."""
        if v is not None:
            if v < 0:
                raise ValueError("Work hours cannot be negative")
            if v > 168:
                raise ValueError(
                    "Work hours per week cannot exceed 168 hours "
                    "(there are only 168 hours in a week)"
                )
        return v

    @field_validator('graduation_date', 'loan_start_date', mode='before')
    @classmethod
    def validate_dates(cls, v):
        """Validate dates are not too far in the past."""
        # Handle empty strings and 'null' string
        if v in ('', 'null', 'None'):
            return None
        if v is not None:
            # Optional: Add date range validation if needed
            # For now, just return the value
            pass
        return v


class UserUpdate(BaseModel):
    """
    Schema for updating an existing user.
    Used in PUT/PATCH /api/v1/users/{user_id} endpoint.
    All fields are optional to support partial updates.
    """
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    home_currency: Optional[CurrencyEnum] = None
    study_country_currency: Optional[CurrencyEnum] = None
    monthly_income: Optional[Decimal] = None
    income_frequency: Optional[IncomeFrequencyEnum] = None
    scholarship_amount: Optional[Decimal] = None
    scholarship_frequency: Optional[ScholarshipFrequencyEnum] = None
    university: Optional[str] = None
    student_status: Optional[StudentStatusEnum] = None
    visa_type: Optional[VisaTypeEnum] = None
    max_work_hours_per_week: Optional[int] = None
    graduation_date: Optional[date] = None
    total_loan_amount: Optional[Decimal] = None
    monthly_loan_payment: Optional[Decimal] = None
    loan_start_date: Optional[date] = None
    timezone: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Strip whitespace and validate non-empty name."""
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Name cannot be empty or only whitespace")
        return v

    @field_validator(
        'monthly_income',
        'scholarship_amount',
        'total_loan_amount',
        'monthly_loan_payment'
    )
    @classmethod
    def validate_positive_amounts(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        """Validate that monetary amounts are non-negative."""
        if v is not None and v < 0:
            raise ValueError(
                "Monetary amounts must be positive. "
                "Please enter a value greater than or equal to 0."
            )
        return v

    @field_validator('max_work_hours_per_week')
    @classmethod
    def validate_work_hours(cls, v: Optional[int]) -> Optional[int]:
        """Validate work hours are within reasonable bounds."""
        if v is not None:
            if v < 0:
                raise ValueError("Work hours cannot be negative")
            if v > 168:
                raise ValueError(
                    "Work hours per week cannot exceed 168 hours "
                    "(there are only 168 hours in a week)"
                )
        return v


class UserResponse(BaseModel):
    """
    Schema for user responses.
    Used in GET /api/v1/users endpoints.
    Returns user data from the database.
    """
    id: UUID
    email: str
    name: str
    home_currency: CurrencyEnum
    study_country_currency: CurrencyEnum
    monthly_income: Optional[Decimal] = None
    income_frequency: Optional[IncomeFrequencyEnum] = None
    scholarship_amount: Optional[Decimal] = None
    scholarship_frequency: Optional[ScholarshipFrequencyEnum] = None
    university: Optional[str] = None
    student_status: Optional[StudentStatusEnum] = None
    visa_type: Optional[VisaTypeEnum] = None
    max_work_hours_per_week: Optional[int] = None
    graduation_date: Optional[date] = None
    total_loan_amount: Optional[Decimal] = None
    monthly_loan_payment: Optional[Decimal] = None
    loan_start_date: Optional[date] = None
    timezone: str
    notification_preferences: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    is_active: bool
    email_verified: bool

    model_config = ConfigDict(from_attributes=True)


class UserInDB(UserResponse):
    """
    Schema for internal database operations.
    Inherits all fields from UserResponse.
    Can be extended with internal-only fields (e.g., password_hash when auth is added).
    """
    pass