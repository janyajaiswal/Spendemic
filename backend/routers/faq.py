import json
import os
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import FAQSubmission, FAQStatusEnum, User
from routers.auth import get_current_user
from schemas import FAQSubmissionCreate, FAQSubmissionReview, FAQSubmissionResponse

router = APIRouter(prefix="/api/v1/faq", tags=["faq"])

_FAQ_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "faq_data.json")


def _is_admin(user: User, db: Session) -> bool:
    if user.email.endswith("@fullerton.edu"):
        return True
    first = db.query(User).order_by(User.created_at).first()
    return first and first.id == user.id


@router.get("", response_model=List[dict])
def list_faq(db: Session = Depends(get_db)):
    with open(_FAQ_PATH, "r") as f:
        static_items = json.load(f)
    for item in static_items:
        item["source"] = "static"

    approved = (
        db.query(FAQSubmission)
        .filter(FAQSubmission.status == FAQStatusEnum.APPROVED)
        .order_by(FAQSubmission.created_at.desc())
        .all()
    )
    community_items = [
        {
            "id": str(s.id),
            "question": s.question,
            "answer": s.answer or "",
            "category": s.category or "General",
            "source": "community",
        }
        for s in approved
    ]

    return static_items + community_items


@router.post("/submit", response_model=FAQSubmissionResponse, status_code=201)
def submit_question(
    body: FAQSubmissionCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = FAQSubmission(
        id=uuid.uuid4(),
        user_id=current_user.id,
        question=body.question,
        category=body.category,
        status=FAQStatusEnum.PENDING,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return _to_response(submission)


@router.get("/my-submissions", response_model=List[FAQSubmissionResponse])
def my_submissions(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subs = (
        db.query(FAQSubmission)
        .filter(FAQSubmission.user_id == current_user.id)
        .order_by(FAQSubmission.created_at.desc())
        .all()
    )
    return [_to_response(s) for s in subs]


@router.get("/pending", response_model=List[FAQSubmissionResponse])
def pending_submissions(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _is_admin(current_user, db):
        raise HTTPException(status_code=403, detail="Admin access required")
    subs = (
        db.query(FAQSubmission)
        .filter(FAQSubmission.status == FAQStatusEnum.PENDING)
        .order_by(FAQSubmission.created_at)
        .all()
    )
    return [_to_response(s) for s in subs]


@router.patch("/submissions/{submission_id}/review", response_model=FAQSubmissionResponse)
def review_submission(
    submission_id: str,
    body: FAQSubmissionReview,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _is_admin(current_user, db):
        raise HTTPException(status_code=403, detail="Admin access required")
    sub = db.query(FAQSubmission).filter(FAQSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.status = FAQStatusEnum.APPROVED if body.status == "approved" else FAQStatusEnum.REJECTED
    if body.answer:
        sub.answer = body.answer
    db.commit()
    db.refresh(sub)
    return _to_response(sub)


def _to_response(s: FAQSubmission) -> FAQSubmissionResponse:
    return FAQSubmissionResponse(
        id=s.id,
        user_id=s.user_id,
        question=s.question,
        answer=s.answer,
        category=s.category,
        status=s.status.value if hasattr(s.status, "value") else s.status,
        created_at=s.created_at,
    )
