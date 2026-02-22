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
    notification_preferences: Optional[str] = Column(
        Text,
        nullable=True
    )  # Stores JSON

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

    # Relationships (models to be created later)
    # Commented out until Transaction, Budget, Goal, Alert models are created
    # transactions = relationship(
    #     "Transaction",
    #     back_populates="user",
    #     cascade="all, delete-orphan"
    # )
    # budgets = relationship(
    #     "Budget",
    #     back_populates="user",
    #     cascade="all, delete-orphan"
    # )
    # goals = relationship(
    #     "Goal",
    #     back_populates="user",
    #     cascade="all, delete-orphan"
    # )
    # alerts = relationship(
    #     "Alert",
    #     back_populates="user",
    #     cascade="all, delete-orphan"
    # )

    # Table Constraints
    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_active_verified", "is_active", "email_verified"),
    )

    def __repr__(self) -> str:
        """String representation of User instance."""
        return f"<User(id={self.id}, email={self.email}, name={self.name})>"