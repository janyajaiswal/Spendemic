"""
Quick script to show database information
"""
import os
from sqlalchemy import create_engine, inspect, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/financial_planner"
)

print("=" * 60)
print("DATABASE OVERVIEW")
print("=" * 60)

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

# Database connection info
with engine.connect() as conn:
    db_name = conn.execute(text("SELECT current_database()")).scalar()
    db_user = conn.execute(text("SELECT current_user")).scalar()
    db_size_result = conn.execute(text(
        "SELECT pg_size_pretty(pg_database_size(current_database()))"
    )).scalar()
    
    print(f"\n📊 Database Name: {db_name}")
    print(f"👤 User: {db_user}")
    print(f"💾 Size: {db_size_result}")

# Tables
print(f"\n📁 Tables:")
tables = inspector.get_table_names()
for table in tables:
    with engine.connect() as conn:
        count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
        print(f"   - {table} ({count} rows)")

# Users table schema
print(f"\n🗂️  Users Table Schema:")
columns = inspector.get_columns('users')
for col in columns:
    nullable = "NULL" if col['nullable'] else "NOT NULL"
    print(f"   - {col['name']:<30} {str(col['type']):<25} {nullable}")

# Sample users
print(f"\n👥 Sample Users (first 3):")
with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT email, name, home_currency, study_country_currency, 
               university, student_status, is_active, created_at
        FROM users 
        LIMIT 3
    """))
    
    for row in result:
        print(f"\n   Email: {row.email}")
        print(f"   Name: {row.name}")
        print(f"   Home Currency: {row.home_currency}")
        print(f"   Study Currency: {row.study_country_currency}")
        print(f"   University: {row.university or 'Not set'}")
        print(f"   Status: {row.student_status or 'Not set'}")
        print(f"   Active: {row.is_active}")
        print(f"   Created: {row.created_at}")

# Enum types
print(f"\n📋 Custom Enum Types:")
with engine.connect() as conn:
    enums = conn.execute(text("""
        SELECT t.typname as enum_name, 
               string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname LIKE '%enum'
        GROUP BY t.typname
        ORDER BY t.typname
    """))
    
    for enum in enums:
        print(f"   - {enum.enum_name}")
        values = enum.values.split(', ')
        if len(values) > 10:
            print(f"     {', '.join(values[:10])} ... ({len(values)} total)")
        else:
            print(f"     {enum.values}")

print("\n" + "=" * 60)
