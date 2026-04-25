from datetime import date, datetime
from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Job, JobHoursLog
from routers.auth import get_current_user
from schemas import (
    JobCreate, JobUpdate, JobResponse, JobTotalIncome,
    JobHoursCreate, JobHoursResponse, JobMonthlySalary,
)

_WEEKS_PER_MONTH = 52 / 12

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


@router.get("", response_model=List[JobResponse])
def list_jobs(
    active_only: bool = True,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Job).filter(Job.user_id == current_user.id)
    if active_only:
        q = q.filter(Job.is_active == True)
    jobs = q.order_by(Job.created_at).all()
    return [_to_response(j) for j in jobs]


@router.get("/total-income", response_model=JobTotalIncome)
def total_income(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    jobs = db.query(Job).filter(Job.user_id == current_user.id, Job.is_active == True).all()
    job_responses = [_to_response(j) for j in jobs]
    total = sum(j.monthly_income or 0.0 for j in job_responses)
    return JobTotalIncome(total_monthly_income=round(total, 2), jobs=job_responses)


@router.post("", response_model=JobResponse, status_code=201)
def create_job(
    body: JobCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = Job(
        id=uuid.uuid4(),
        user_id=current_user.id,
        job_name=body.job_name,
        employer=body.employer,
        hourly_rate=body.hourly_rate,
        hours_per_week=body.hours_per_week,
        job_type=body.job_type,
        start_date=body.start_date,
        end_date=body.end_date,
        is_active=True,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _to_response(job)


@router.put("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: str,
    body: JobUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = _get_job(job_id, current_user.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return _to_response(job)


@router.delete("/{job_id}", status_code=200)
def delete_job(
    job_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = _get_job(job_id, current_user.id, db)
    job.is_active = False
    db.commit()


@router.get("/weekly-salary", response_model=JobMonthlySalary)
def weekly_salary(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    month_start = today.replace(day=1)
    jobs = db.query(Job).filter(Job.user_id == current_user.id, Job.is_active == True).all()
    total = 0.0
    job_summaries = []
    for job in jobs:
        logs = (
            db.query(JobHoursLog)
            .filter(
                JobHoursLog.job_id == job.id,
                JobHoursLog.week_start_date >= month_start,
                JobHoursLog.week_start_date <= today,
            )
            .all()
        )
        if logs:
            hours_this_month = sum(float(l.hours_worked) for l in logs)
        else:
            # Fall back to fixed hours_per_week × weeks elapsed this month
            days_elapsed = (today - month_start).days + 1
            hours_this_month = float(job.hours_per_week) * (days_elapsed / 7)
        monthly_earned = round(hours_this_month * float(job.hourly_rate), 2)
        total += monthly_earned
        job_summaries.append({
            "job_id": str(job.id),
            "job_name": job.job_name,
            "hours_this_month": round(hours_this_month, 1),
            "monthly_earned": monthly_earned,
        })
    return JobMonthlySalary(total_monthly_earned=round(total, 2), jobs=job_summaries)


@router.post("/{job_id}/hours", response_model=JobHoursResponse, status_code=201)
def log_hours(
    job_id: str,
    body: JobHoursCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = _get_job(job_id, current_user.id, db)
    existing = (
        db.query(JobHoursLog)
        .filter(JobHoursLog.job_id == job.id, JobHoursLog.week_start_date == body.week_start_date)
        .first()
    )
    if existing:
        existing.hours_worked = body.hours_worked
        db.commit()
        db.refresh(existing)
        entry = existing
    else:
        entry = JobHoursLog(
            id=uuid.uuid4(),
            job_id=job.id,
            week_start_date=body.week_start_date,
            hours_worked=body.hours_worked,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
    weekly_pay = round(float(entry.hours_worked) * float(job.hourly_rate), 2)
    return JobHoursResponse(
        id=entry.id,
        job_id=entry.job_id,
        week_start_date=entry.week_start_date,
        hours_worked=entry.hours_worked,
        created_at=entry.created_at,
        weekly_pay=weekly_pay,
    )


@router.get("/{job_id}/hours", response_model=List[JobHoursResponse])
def get_hours(
    job_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = _get_job(job_id, current_user.id, db)
    logs = (
        db.query(JobHoursLog)
        .filter(JobHoursLog.job_id == job.id)
        .order_by(JobHoursLog.week_start_date.desc())
        .limit(12)
        .all()
    )
    return [
        JobHoursResponse(
            id=l.id,
            job_id=l.job_id,
            week_start_date=l.week_start_date,
            hours_worked=l.hours_worked,
            created_at=l.created_at,
            weekly_pay=round(float(l.hours_worked) * float(job.hourly_rate), 2),
        )
        for l in logs
    ]


def _get_job(job_id: str, user_id, db: Session) -> Job:
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _to_response(job: Job) -> JobResponse:
    monthly = round(float(job.hourly_rate) * float(job.hours_per_week) * _WEEKS_PER_MONTH, 2)
    return JobResponse(
        id=job.id,
        user_id=job.user_id,
        job_name=job.job_name,
        employer=job.employer,
        hourly_rate=job.hourly_rate,
        hours_per_week=job.hours_per_week,
        job_type=job.job_type,
        start_date=job.start_date,
        end_date=job.end_date,
        is_active=job.is_active,
        created_at=job.created_at,
        monthly_income=monthly,
    )
