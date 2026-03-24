"""
AI Financial Planner - Database Models
Defines SQLAlchemy models for the application
"""
import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Column,
    String,
    Numeric,
    Boolean,
    DateTime,
    Date,
    Integer,
    Text,
    UUID,
    Enum,
    ForeignKey,
    Index,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from database import Base


# ==================== ENUMS ====================

class CurrencyEnum(str, enum.Enum):
    """Enumeration of major world currencies."""
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"
    CNY = "CNY"
    INR = "INR"
    CAD = "CAD"
    AUD = "AUD"
    CHF = "CHF"
    SEK = "SEK"
    NZD = "NZD"
    SGD = "SGD"
    HKD = "HKD"
    NOK = "NOK"
    KRW = "KRW"
    MXN = "MXN"
    BRL = "BRL"
    ZAR = "ZAR"
    RUB = "RUB"
    TRY = "TRY"
    PLN = "PLN"
    DKK = "DKK"
    THB = "THB"
    IDR = "IDR"
    MYR = "MYR"
    PHP = "PHP"
    CZK = "CZK"
    HUF = "HUF"
    ILS = "ILS"
    CLP = "CLP"
    AED = "AED"
    SAR = "SAR"
    EGP = "EGP"
    PKR = "PKR"
    BDT = "BDT"
    VND = "VND"
    NGN = "NGN"
    KES = "KES"
    GHS = "GHS"
    UAH = "UAH"
    ARS = "ARS"
    COP = "COP"
    PEN = "PEN"
    RON = "RON"
    QAR = "QAR"
    KWD = "KWD"


class IncomeFrequencyEnum(str, enum.Enum):
    """Frequency at which user receives income."""
    WEEKLY = "WEEKLY"
    BI_WEEKLY = "BI_WEEKLY"
    MONTHLY = "MONTHLY"
    SEMI_MONTHLY = "SEMI_MONTHLY"
    IRREGULAR = "IRREGULAR"
    NONE = "NONE"


class ScholarshipFrequencyEnum(str, enum.Enum):
    """Frequency at which user receives scholarship payments."""
    ONE_TIME = "ONE_TIME"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    SEMESTER = "SEMESTER"
    ANNUAL = "ANNUAL"
    NONE = "NONE"


class StudentStatusEnum(str, enum.Enum):
    """Academic status of the student."""
    UNDERGRADUATE = "UNDERGRADUATE"
    GRADUATE = "GRADUATE"
    MASTERS = "MASTERS"
    PHD = "PHD"
    POST_DOC = "POST_DOC"
    EXCHANGE = "EXCHANGE"
    CERTIFICATE = "CERTIFICATE"


class VisaTypeEnum(str, enum.Enum):
    """Type of visa the international student holds."""
    F1 = "F1"
    J1 = "J1"
    M1 = "M1"
    H1B = "H1B"
    OPT = "OPT"
    CPT = "CPT"
    B1_B2 = "B1_B2"
    CITIZEN = "CITIZEN"
    OTHER = "OTHER"
    NONE = "NONE"


class RecurringFrequencyEnum(str, enum.Enum):
    """How often a recurring transaction repeats."""
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    BI_WEEKLY = "BI_WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    ANNUALLY = "ANNUALLY"


class TransactionTypeEnum(str, enum.Enum):
    """Whether the transaction is money coming in or going out."""
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


class CategoryEnum(str, enum.Enum):
    """Spending and income categories for transactions and budgets."""
    # Expense categories
    HOUSING = "HOUSING"           # Rent, mortgage, dorm fees
    FOOD = "FOOD"                 # Groceries, dining, meal plans
    TRANSPORTATION = "TRANSPORTATION"  # Bus, rideshare, gas, parking
    EDUCATION = "EDUCATION"       # Tuition, books, supplies, courses
    HEALTHCARE = "HEALTHCARE"     # Insurance, prescriptions, clinic
    ENTERTAINMENT = "ENTERTAINMENT"  # Streaming, movies, sports, events
    SHOPPING = "SHOPPING"         # Clothing, electronics, household
    UTILITIES = "UTILITIES"       # Electricity, internet, phone plan
    PERSONAL_CARE = "PERSONAL_CARE"  # Haircut, gym, hygiene
    TRAVEL = "TRAVEL"             # Flights, hotels, trips home
    SAVINGS = "SAVINGS"           # Transfers to savings / emergency fund
    # Income categories
    SALARY = "SALARY"             # Part-time job / on-campus work
    STIPEND = "STIPEND"           # TA/RA stipend
    SCHOLARSHIP = "SCHOLARSHIP"   # Scholarship disbursement
    FINANCIAL_AID = "FINANCIAL_AID"  # Grants, loans from school
    FAMILY_SUPPORT = "FAMILY_SUPPORT"  # Money from family
    FREELANCE = "FREELANCE"       # Gig work, consulting
    # Catch-all
    OTHER = "OTHER"


class BudgetPeriodEnum(str, enum.Enum):
    """Recurring period for a budget limit."""
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"


class AlertTypeEnum(str, enum.Enum):
    """Types of budget alerts the system can trigger."""
    BUDGET_EXCEEDED = "BUDGET_EXCEEDED"        # Spent > 100% of limit
    APPROACHING_LIMIT = "APPROACHING_LIMIT"    # Spent > threshold% of limit
    LARGE_TRANSACTION = "LARGE_TRANSACTION"    # Single transaction > threshold amount
    LOW_BALANCE = "LOW_BALANCE"                # Estimated balance < threshold


# ==================== USER MODEL ====================

class User(Base):
    """
    Represents international student users in the financial planning system.

    Stores user profile information, financial details, student context,
    and preferences for personalized budgeting and forecasting.
    """
    __tablename__ = "users"

    # Core Identity
    id: UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: str = Column(String, unique=True, nullable=False)
    name: str = Column(String, nullable=False)
    password_hash: Optional[str] = Column(String, nullable=True)  # None for OAuth-only users

    # Profile
    profile_picture_url: Optional[str] = Column(String, nullable=True)
    bio: Optional[str] = Column(Text, nullable=True)
    phone_number: Optional[str] = Column(String(30), nullable=True)

    # Address
    country: Optional[str] = Column(String(100), nullable=True)
    city: Optional[str] = Column(String(100), nullable=True)
    state_province: Optional[str] = Column(String(100), nullable=True)
    postal_code: Optional[str] = Column(String(20), nullable=True)

    # Financial Profile
    home_currency: CurrencyEnum = Column(
        Enum(CurrencyEnum),
        default=CurrencyEnum.USD,
        nullable=False
    )
    study_country_currency: CurrencyEnum = Column(
        Enum(CurrencyEnum),
        default=CurrencyEnum.USD,
        nullable=False
    )
    monthly_income: Optional[float] = Column(Numeric(10, 2), nullable=True)
    income_frequency: Optional[IncomeFrequencyEnum] = Column(
        Enum(IncomeFrequencyEnum),
        nullable=True
    )
    scholarship_amount: Optional[float] = Column(Numeric(10, 2), nullable=True)
    scholarship_frequency: Optional[ScholarshipFrequencyEnum] = Column(
        Enum(ScholarshipFrequencyEnum),
        nullable=True
    )

    # Student Context
    university: Optional[str] = Column(String, nullable=True)
    student_status: Optional[StudentStatusEnum] = Column(
        Enum(StudentStatusEnum),
        nullable=True
    )
    visa_type: Optional[VisaTypeEnum] = Column(Enum(VisaTypeEnum), nullable=True)
    max_work_hours_per_week: Optional[int] = Column(Integer, nullable=True)
    graduation_date: Optional[date] = Column(Date, nullable=True)

    # Loan Information
    total_loan_amount: Optional[float] = Column(Numeric(10, 2), nullable=True)
    monthly_loan_payment: Optional[float] = Column(Numeric(10, 2), nullable=True)
    loan_start_date: Optional[date] = Column(Date, nullable=True)

    # Preferences
    timezone: Optional[str] = Column(String, default="UTC", nullable=True)
    notification_preferences: Optional[str] = Column(Text, nullable=True)  # JSON

    # Tracking & Security
    created_at: datetime = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at: Optional[datetime] = Column(
        DateTime(timezone=True),
        onupdate=func.now()
    )
    last_login: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)
    is_active: bool = Column(Boolean, default=True)
    email_verified: bool = Column(Boolean, default=False)

    # Relationships
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")
    forecast_contexts = relationship("ForecastContext", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_active_verified", "is_active", "email_verified"),
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, name={self.name})>"


# ==================== USER SESSIONS ====================

class UserSession(Base):
    """
    Tracks every JWT access token issued to a user.

    Enables token revocation (logout from all devices) and
    audit logging of login activity.
    """
    __tablename__ = "user_sessions"

    id: UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: UUID = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    # JWT identification
    jti: str = Column(String, unique=True, nullable=False)  # JWT ID claim
    issued_at: datetime = Column(DateTime(timezone=True), nullable=False)
    expires_at: datetime = Column(DateTime(timezone=True), nullable=False)

    # Revocation
    is_revoked: bool = Column(Boolean, default=False, nullable=False)
    revoked_at: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)

    # Optional context
    user_agent: Optional[str] = Column(String, nullable=True)
    ip_address: Optional[str] = Column(String(45), nullable=True)  # supports IPv6

    created_at: datetime = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="sessions")

    __table_args__ = (
        Index("ix_user_sessions_user_id", "user_id"),
        Index("ix_user_sessions_jti", "jti"),
        Index("ix_user_sessions_expires_at", "expires_at"),
    )

    def __repr__(self) -> str:
        return f"<UserSession(id={self.id}, user_id={self.user_id}, jti={self.jti})>"


# ==================== TRANSACTIONS ====================

class Transaction(Base):
    """
    Records every income and expense transaction for a user.

    This is the core data that drives budget tracking, forecasting,
    and AI-powered financial insights.
    """
    __tablename__ = "transactions"

    id: UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: UUID = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    # Amount & Currency
    amount: float = Column(Numeric(10, 2), nullable=False)  # Always positive
    currency: CurrencyEnum = Column(Enum(CurrencyEnum), nullable=False)
    amount_in_usd: Optional[float] = Column(
        Numeric(10, 2), nullable=True
    )  # Normalized for ML models

    # Classification
    type: TransactionTypeEnum = Column(Enum(TransactionTypeEnum), nullable=False)
    category: CategoryEnum = Column(Enum(CategoryEnum), nullable=False)
    description: Optional[str] = Column(String(500), nullable=True)

    # Timing
    transaction_date: date = Column(Date, nullable=False)
    is_recurring: bool = Column(Boolean, default=False)
    recurring_frequency: Optional[RecurringFrequencyEnum] = Column(
        Enum(RecurringFrequencyEnum), nullable=True
    )  # Only set when is_recurring=True

    # Recurring generation tracking
    recurring_parent_id: Optional[UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )  # Set on auto-generated child transactions; None on the template
    is_generated: bool = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at: datetime = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Optional[datetime] = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="transactions")

    __table_args__ = (
        Index("ix_transactions_user_id", "user_id"),
        Index("ix_transactions_date", "transaction_date"),
        Index("ix_transactions_user_date", "user_id", "transaction_date"),
        Index("ix_transactions_category", "category"),
    )

    def __repr__(self) -> str:
        return (
            f"<Transaction(id={self.id}, user_id={self.user_id}, "
            f"type={self.type}, amount={self.amount} {self.currency})>"
        )


# ==================== BUDGETS ====================

class Budget(Base):
    """
    Defines spending limits per category for a user.

    Used to calculate budget utilization, trigger alerts,
    and display progress bars in the dashboard.
    """
    __tablename__ = "budgets"

    id: UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: UUID = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    category: CategoryEnum = Column(Enum(CategoryEnum), nullable=False)
    limit_amount: float = Column(Numeric(10, 2), nullable=False)
    currency: CurrencyEnum = Column(Enum(CurrencyEnum), nullable=False)
    period: BudgetPeriodEnum = Column(
        Enum(BudgetPeriodEnum),
        default=BudgetPeriodEnum.MONTHLY,
        nullable=False
    )

    # Active date range
    start_date: date = Column(Date, nullable=False)
    end_date: Optional[date] = Column(Date, nullable=True)  # None = ongoing
    is_active: bool = Column(Boolean, default=True)

    created_at: datetime = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Optional[datetime] = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="budgets")
    alerts = relationship("Alert", back_populates="budget")

    __table_args__ = (
        Index("ix_budgets_user_id", "user_id"),
        Index("ix_budgets_user_category", "user_id", "category"),
    )

    def __repr__(self) -> str:
        return (
            f"<Budget(id={self.id}, user_id={self.user_id}, "
            f"category={self.category}, limit={self.limit_amount} {self.currency})>"
        )


# ==================== ALERTS ====================

class Alert(Base):
    """
    Rule-based notification triggers for budget monitoring.

    When a transaction pushes spending past a threshold, the system
    fires an alert (via SNS or in-app notification in future phases).
    """
    __tablename__ = "alerts"

    id: UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: UUID = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    budget_id: Optional[UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("budgets.id", ondelete="SET NULL"),
        nullable=True
    )

    alert_type: AlertTypeEnum = Column(Enum(AlertTypeEnum), nullable=False)

    # Threshold: percentage (0-100) for APPROACHING_LIMIT, or fixed amount for others
    threshold_value: float = Column(Numeric(10, 2), nullable=False)

    is_active: bool = Column(Boolean, default=True)
    last_triggered_at: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)

    created_at: datetime = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="alerts")
    budget = relationship("Budget", back_populates="alerts")

    __table_args__ = (
        Index("ix_alerts_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<Alert(id={self.id}, user_id={self.user_id}, "
            f"type={self.alert_type}, threshold={self.threshold_value})>"
        )


# ==================== FORECAST CONTEXT ====================

class ForecastContext(Base):
    """
    Monthly covariate data per user for Chronos-2 forecasting.
    One row per (user, year, month). Used to inject domain knowledge
    (rent, work hours, breaks, travel) into the ML forecast.
    """
    __tablename__ = "forecast_context"

    id: UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: UUID = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    year: int = Column(Integer, nullable=False)
    month: int = Column(Integer, nullable=False)  # 1–12

    # Covariate fields
    hours_per_week: Optional[float] = Column(Numeric(5, 1), nullable=True)
    is_working: bool = Column(Boolean, default=True, nullable=False)
    is_summer_break: bool = Column(Boolean, default=False, nullable=False)
    is_winter_break: bool = Column(Boolean, default=False, nullable=False)
    travel_home: bool = Column(Boolean, default=False, nullable=False)
    travel_cost: Optional[float] = Column(Numeric(10, 2), nullable=True)  # actual flight cost
    tuition_due: Optional[float] = Column(Numeric(10, 2), nullable=True)
    scholarship_received: Optional[float] = Column(Numeric(10, 2), nullable=True)
    exchange_rate: Optional[float] = Column(Numeric(10, 6), nullable=True)
    health_insurance: bool = Column(Boolean, default=False, nullable=False)
    rent: Optional[float] = Column(Numeric(10, 2), nullable=True)

    created_at: datetime = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Optional[datetime] = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="forecast_contexts")

    __table_args__ = (
        UniqueConstraint("user_id", "year", "month", name="uq_forecast_context_user_month"),
        Index("ix_forecast_context_user_id", "user_id"),
        Index("ix_forecast_context_user_year", "user_id", "year"),
    )

    def __repr__(self) -> str:
        return f"<ForecastContext(user={self.user_id}, {self.year}-{self.month:02d})>"


# ==================== EXCHANGE RATE CACHE ====================

class ExchangeRateCache(Base):
    """
    Caches exchange rates fetched from ExchangeRate-API.

    Avoids repeated API calls within a short window.
    The ML pipeline uses this table to normalize transaction
    amounts to USD for time-series forecasting.
    """
    __tablename__ = "exchange_rate_cache"

    id: UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_currency: str = Column(String(3), nullable=False)
    to_currency: str = Column(String(3), nullable=False)
    rate: float = Column(Numeric(18, 8), nullable=False)  # High precision for forex
    fetched_at: datetime = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("from_currency", "to_currency", name="uq_exchange_rate_pair"),
        Index("ix_exchange_rate_pair", "from_currency", "to_currency"),
        Index("ix_exchange_rate_fetched_at", "fetched_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<ExchangeRateCache({self.from_currency}->{self.to_currency} "
            f"@ {self.rate}, fetched {self.fetched_at})>"
        )
