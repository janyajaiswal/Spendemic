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
    TransactionTypeEnum,
    CategoryEnum,
    BudgetPeriodEnum,
    AlertTypeEnum,
    RecurringFrequencyEnum,
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
    bio: Optional[str] = Field(None, max_length=500)
    phone_number: Optional[str] = Field(None, max_length=30)
    country: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    state_province: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
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
    profile_picture_url: Optional[str] = None
    bio: Optional[str] = None
    phone_number: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    postal_code: Optional[str] = None
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


# ==================== AUTH SCHEMAS ====================

class GoogleAuthRequest(BaseModel):
    credential: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class RegisterRequest(BaseModel):
    """Step 1 of email sign-up — triggers OTP email."""
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=200)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator('name')
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank")
        return v

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        import re
        if not re.search(r'[A-Z]', v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r'\d', v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r'[^A-Za-z0-9]', v):
            raise ValueError("Password must contain at least one special character")
        return v


class OTPSentResponse(BaseModel):
    message: str
    expires_in_seconds: int = 300


class VerifyOTPRequest(BaseModel):
    """Step 2 of email sign-up — verifies code and creates the user."""
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


# ==================== TRANSACTION SCHEMAS ====================

class TransactionCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Must be positive")
    currency: CurrencyEnum
    type: TransactionTypeEnum
    category: CategoryEnum
    description: Optional[str] = Field(None, max_length=500)
    transaction_date: date
    is_recurring: bool = False
    recurring_frequency: Optional[RecurringFrequencyEnum] = None

    @field_validator('amount')
    @classmethod
    def round_amount(cls, v: Decimal) -> Decimal:
        return round(v, 2)


class TransactionUpdate(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=0)
    currency: Optional[CurrencyEnum] = None
    type: Optional[TransactionTypeEnum] = None
    category: Optional[CategoryEnum] = None
    description: Optional[str] = Field(None, max_length=500)
    transaction_date: Optional[date] = None
    is_recurring: Optional[bool] = None
    recurring_frequency: Optional[RecurringFrequencyEnum] = None

    @field_validator('amount')
    @classmethod
    def round_amount(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return round(v, 2) if v is not None else None


class TransactionResponse(BaseModel):
    id: UUID
    user_id: UUID
    amount: Decimal
    currency: CurrencyEnum
    amount_in_usd: Optional[Decimal] = None
    type: TransactionTypeEnum
    category: CategoryEnum
    description: Optional[str] = None
    transaction_date: date
    is_recurring: bool
    recurring_frequency: Optional[RecurringFrequencyEnum] = None
    recurring_parent_id: Optional[UUID] = None
    is_generated: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TransactionSummary(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    net: Decimal
    by_category: dict
    period_start: date
    period_end: date


# ==================== BUDGET SCHEMAS ====================

class BudgetCreate(BaseModel):
    category: CategoryEnum
    limit_amount: Decimal = Field(..., gt=0)
    currency: CurrencyEnum
    period: BudgetPeriodEnum = BudgetPeriodEnum.MONTHLY
    start_date: date
    end_date: Optional[date] = None

    @field_validator('limit_amount')
    @classmethod
    def round_amount(cls, v: Decimal) -> Decimal:
        return round(v, 2)


class BudgetUpdate(BaseModel):
    limit_amount: Optional[Decimal] = Field(None, gt=0)
    currency: Optional[CurrencyEnum] = None
    period: Optional[BudgetPeriodEnum] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class BudgetResponse(BaseModel):
    id: UUID
    user_id: UUID
    category: CategoryEnum
    limit_amount: Decimal
    currency: CurrencyEnum
    period: BudgetPeriodEnum
    start_date: date
    end_date: Optional[date] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    spent: Optional[Decimal] = None        # computed at query time
    utilization: Optional[float] = None   # 0.0 - 1.0+

    model_config = ConfigDict(from_attributes=True)


# ==================== FORECAST CONTEXT SCHEMAS ====================

class ForecastContextUpsert(BaseModel):
    """Create or update covariate values for a single month."""
    hours_per_week: Optional[float] = Field(None, ge=0, le=168)
    is_working: bool = True
    is_summer_break: bool = False
    is_winter_break: bool = False
    travel_home: bool = False
    travel_cost: Optional[float] = Field(None, ge=0)  # actual flight/travel cost
    tuition_due: Optional[float] = Field(None, ge=0)
    scholarship_received: Optional[float] = Field(None, ge=0)
    exchange_rate: Optional[float] = Field(None, gt=0)
    health_insurance: bool = False
    rent: Optional[float] = Field(None, ge=0)


class ForecastContextResponse(ForecastContextUpsert):
    id: UUID
    user_id: UUID
    year: int
    month: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ForecastContextBulkCopy(BaseModel):
    """Copy one month's values to a list of target (year, month) pairs."""
    source_year: int
    source_month: int = Field(..., ge=1, le=12)
    targets: List[dict]  # [{"year": 2026, "month": 4}, ...]


# ==================== FORECAST REQUEST / RESPONSE ====================

class ForecastMonthInput(BaseModel):
    """
    Covariate data for one future month.
    year + month identify which calendar month this applies to.
    All spending-related fields are required (no assumed defaults) —
    only provide what you know; omit the rest and the model will use
    your historical spending pattern as the baseline.
    """
    year: int = Field(..., ge=2000, le=2100)
    month: int = Field(..., ge=1, le=12)
    rent: Optional[float] = Field(None, ge=0, description="Monthly rent in USD")
    tuition_due: Optional[float] = Field(None, ge=0, description="Tuition payment due this month")
    scholarship_received: Optional[float] = Field(None, ge=0, description="Scholarship credit this month")
    travel_home: bool = Field(False, description="Flying home this month?")
    travel_cost: Optional[float] = Field(None, ge=0, description="Actual round-trip cost if travel_home=true")
    is_summer_break: bool = False
    is_winter_break: bool = False
    is_working: bool = True
    hours_per_week: Optional[float] = Field(None, ge=0, le=168)


class ForecastRequest(BaseModel):
    """
    Inline forecast request — provide the future months you want
    predicted, plus how many months back of your own transaction
    history to include (default: all available).
    """
    months: List[ForecastMonthInput] = Field(
        ...,
        min_length=1,
        max_length=60,
        description="Ordered list of future months to forecast (oldest first).",
    )
    history_months: Optional[int] = Field(
        None, ge=1, le=120,
        description="Limit history to last N months (omit = use all available).",
    )


class ForecastHistoryPoint(BaseModel):
    year: int
    month: int
    total: float
    synthetic: bool = False


class ForecastPrediction(BaseModel):
    month_offset: int
    year: int
    month: int
    lower: float
    median: float
    upper: float


class ForecastResponse(BaseModel):
    history: List[ForecastHistoryPoint]
    predictions: List[ForecastPrediction]
    prediction_months: int
    graduation_date: Optional[str] = None
    warnings: List[str] = []