from datetime import date
from decimal import Decimal
from sqlalchemy.exc import IntegrityError
from database import SessionLocal, engine, Base
from models import (User,CurrencyEnum,IncomeFrequencyEnum,ScholarshipFrequencyEnum,StudentStatusEnum,VisaTypeEnum)


def create_tables():
    """Create all database tables if they don't exist."""
    print("📋 Creating database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully!\n")
    except Exception as e:
        print(f"❌ Error creating tables: {e}\n")
        raise


def create_test_user():
    #creating a database session
    db = SessionLocal()
    try:
        #new user instance
        test_user = User(
            email = "test.student@csu.fullerton.edu",
            name = "Test Student",
            home_currency = CurrencyEnum.INR,
            study_country_currency = CurrencyEnum.USD,
            monthly_income = Decimal("800.00"),
            income_frequency=IncomeFrequencyEnum.BI_WEEKLY,
            scholarship_amount=Decimal("5000.00"),
            scholarship_frequency=ScholarshipFrequencyEnum.SEMESTER,
            university="California State University Fullerton",
            student_status=StudentStatusEnum.GRADUATE,
            visa_type=VisaTypeEnum.F1,
            max_work_hours_per_week=20,
            graduation_date=date(2026, 5, 15),
            total_loan_amount=Decimal("30000.00"),
            monthly_loan_payment=Decimal("350.00"),
            loan_start_date=date(2026, 6, 1),
            timezone="America/Los_Angeles"
        )
        
        #add to session and commit
        db.add(test_user)
        db.commit()
        
        db.refresh(test_user)
        
        #all success messages
        
        print("User Created Successfully!\n")
        print(f"User ID: {test_user.id}")
        print(f"Email:{test_user.email}")
        print(f"Name: {test_user.name}")
        print(f"Home Currency: {test_user.home_currency.value}")
        print(f"Study Country Currency: {test_user.study_country_currency.value}")
        print(f"Monthly Income: ${test_user.monthly_income}")
        print(f"Income Frequency: {test_user.income_frequency.value}")
        print(f"Scholarship Amount: ${test_user.scholarship_amount}")
        print(f"Scholarship Frequency: {test_user.scholarship_frequency.value}")
        print(f"University: {test_user.university}")
        print(f"Student Status: {test_user.student_status.value}")
        print(f"Visa Type: {test_user.visa_type.value}")
        print(f"Max Work Hours/Week: {test_user.max_work_hours_per_week}")
        print(f"Graduation Date: {test_user.graduation_date}")
        print(f"Total Loan Amount: ${test_user.total_loan_amount}")
        print(f"Monthly Loan Payment: ${test_user.monthly_loan_payment}")
        print(f"Loan Start Date: {test_user.loan_start_date}")
        print(f"Created At: {test_user.created_at}")
        print(f"Is Active: {test_user.is_active}")
        print(f"Email Verified: {test_user.email_verified}")
        
        print("\n" + "="*60)
        print("Now query the database to verify:")
        print(f"psql -U financial_planner_user -d financial_planner_db -c 'SELECT * FROM users;'")
        print("="*60)
        
        return test_user
        
    except IntegrityError as e:
        db.rollback()
        print("❌ Error: User with this email already exists!")
        print(f"Details: {e}")
        return None
        
    except Exception as e:
        db.rollback()
        print(f"❌ Unexpected error: {e}")
        return None
        
    finally:
        # Always close the session
        db.close()


def query_all_users():
    """Query and display all users from the database."""
    
    db = SessionLocal()
    
    try:
        users = db.query(User).all()
        
        print(f"\n📊 Total users in database: {len(users)}\n")
        
        for user in users:
            print(f"• {user.name} ({user.email}) - {user.student_status.value if user.student_status else 'N/A'}")
            
    except Exception as e:
        print(f"❌ Error querying users: {e}")
        
    finally:
        db.close()


if __name__ == "__main__":
    print("="*60)
    print("TESTING USER CREATION")
    print("="*60 + "\n")
    
    # Create database tables first
    create_tables()
    
    # Create a test user
    user = create_test_user()
    
    if user:
        # Query all users to verify
        query_all_users()
    
    print("\n✨ Test complete!")
