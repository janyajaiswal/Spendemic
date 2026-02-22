"""
Seed script to add randomized test users to the database
"""
from datetime import date
from decimal import Decimal
from database import SessionLocal
from models import (
    User,
    CurrencyEnum,
    IncomeFrequencyEnum,
    ScholarshipFrequencyEnum,
    StudentStatusEnum,
    VisaTypeEnum
)


def seed_users():
    """Create and insert 4 randomized test users"""
    db = SessionLocal()
    
    try:
        # User 1: Graduate student from India
        user1 = User(
            email="priya.sharma@csuf.edu",
            name="Priya Sharma",
            home_currency=CurrencyEnum.INR,
            study_country_currency=CurrencyEnum.USD,
            monthly_income=Decimal("1200.00"),
            income_frequency=IncomeFrequencyEnum.BI_WEEKLY,
            scholarship_amount=Decimal("8000.00"),
            scholarship_frequency=ScholarshipFrequencyEnum.SEMESTER,
            university="California State University Fullerton",
            student_status=StudentStatusEnum.MASTERS,
            visa_type=VisaTypeEnum.F1,
            max_work_hours_per_week=20,
            graduation_date=date(2026, 12, 15),
            total_loan_amount=Decimal("25000.00"),
            monthly_loan_payment=Decimal("300.00"),
            loan_start_date=date(2027, 1, 1),
            timezone="America/Los_Angeles"
        )
        
        # User 2: PhD student from China with no loans
        user2 = User(
            email="wei.zhang@csuf.edu",
            name="Wei Zhang",
            home_currency=CurrencyEnum.CNY,
            study_country_currency=CurrencyEnum.USD,
            monthly_income=Decimal("2000.00"),
            income_frequency=IncomeFrequencyEnum.MONTHLY,
            scholarship_amount=Decimal("15000.00"),
            scholarship_frequency=ScholarshipFrequencyEnum.ANNUAL,
            university="California State University Fullerton",
            student_status=StudentStatusEnum.PHD,
            visa_type=VisaTypeEnum.J1,
            max_work_hours_per_week=20,
            graduation_date=date(2028, 5, 20),
            total_loan_amount=Decimal("0.00"),
            monthly_loan_payment=Decimal("0.00"),
            loan_start_date=None,
            timezone="America/Los_Angeles"
        )
        
        # User 3: Undergraduate from Mexico with part-time work
        user3 = User(
            email="carlos.rodriguez@csuf.edu",
            name="Carlos Rodriguez",
            home_currency=CurrencyEnum.MXN,
            study_country_currency=CurrencyEnum.USD,
            monthly_income=Decimal("800.00"),
            income_frequency=IncomeFrequencyEnum.BI_WEEKLY,
            scholarship_amount=Decimal("3000.00"),
            scholarship_frequency=ScholarshipFrequencyEnum.SEMESTER,
            university="California State University Fullerton",
            student_status=StudentStatusEnum.UNDERGRADUATE,
            visa_type=VisaTypeEnum.F1,
            max_work_hours_per_week=15,
            graduation_date=date(2027, 5, 15),
            total_loan_amount=Decimal("18000.00"),
            monthly_loan_payment=Decimal("250.00"),
            loan_start_date=date(2027, 6, 1),
            timezone="America/Los_Angeles"
        )
        
        # User 4: US Citizen graduate student
        user4 = User(
            email="sarah.johnson@csuf.edu",
            name="Sarah Johnson",
            home_currency=CurrencyEnum.USD,
            study_country_currency=CurrencyEnum.USD,
            monthly_income=Decimal("2500.00"),
            income_frequency=IncomeFrequencyEnum.MONTHLY,
            scholarship_amount=Decimal("5000.00"),
            scholarship_frequency=ScholarshipFrequencyEnum.SEMESTER,
            university="California State University Fullerton",
            student_status=StudentStatusEnum.GRADUATE,
            visa_type=VisaTypeEnum.CITIZEN,
            max_work_hours_per_week=40,
            graduation_date=date(2026, 8, 30),
            total_loan_amount=Decimal("35000.00"),
            monthly_loan_payment=Decimal("400.00"),
            loan_start_date=date(2026, 9, 1),
            timezone="America/Los_Angeles"
        )
        
        # Add all users to session
        users = [user1, user2, user3, user4]
        db.add_all(users)
        db.commit()
        
        print("✅ Successfully added 4 users to the database!\n")
        print("="*60)
        
        # Display created users
        for user in users:
            db.refresh(user)
            print(f"\n📝 {user.name}")
            print(f"   Email: {user.email}")
            print(f"   Status: {user.student_status.value}")
            print(f"   Visa: {user.visa_type.value}")
            print(f"   Home Currency: {user.home_currency.value}")
            print(f"   Monthly Income: ${user.monthly_income}")
            print(f"   Scholarship: ${user.scholarship_amount} ({user.scholarship_frequency.value})")
            print(f"   Graduation: {user.graduation_date}")
        
        print("\n" + "="*60)
        print(f"Total users in database: {db.query(User).count()}")
        print("="*60)
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding users: {e}")
        
    finally:
        db.close()


if __name__ == "__main__":
    print("="*60)
    print("SEEDING DATABASE WITH TEST USERS")
    print("="*60 + "\n")
    seed_users()
    print("\n✨ Seeding complete!")
