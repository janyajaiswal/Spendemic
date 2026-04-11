import json
import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import FAQAnswer, FAQSubmission, FAQStatusEnum, User
from routers.auth import get_current_user
from schemas import FAQAnswerCreate, FAQAnswerResponse, FAQSubmissionCreate, FAQSubmissionReview, FAQSubmissionResponse

router = APIRouter(prefix="/api/v1/faq", tags=["faq"])

_FAQ_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "faq_data.json")


# ── Moderation ────────────────────────────────────────────────────────────────

# Hardcoded blocklist — works with no external dependencies.
# Covers common profanity, slurs, and hate-speech terms.
_BLOCKLIST = {
    "fuck", "fucker", "fucking", "fucked", "fucks", "f**k", "f***",
    "shit", "shitting", "shitty", "bullshit",
    "ass", "asses", "asshole", "assholes",
    "bitch", "bitches", "bitching",
    "cunt", "cunts",
    "dick", "dicks", "dickhead",
    "cock", "cocks",
    "pussy", "pussies",
    "nigger", "niggers", "nigga", "niggas",
    "faggot", "faggots", "fag", "fags",
    "retard", "retarded", "retards",
    "whore", "whores",
    "slut", "sluts",
    "bastard", "bastards",
    "damn", "goddamn",
    "piss", "pissed",
    "crap",
    "stupid", "idiot", "moron", "dumbass", "dumb",
    "hate", "kill", "die", "murder",
}

# Characters substituted to evade filters → normalize before checking
_LEET = str.maketrans({
    "@": "a", "0": "o", "1": "i", "3": "e",
    "$": "s", "!": "i", "+": "t", "4": "a",
})


def _blocklist_hit(text: str) -> bool:
    normalized = text.lower().translate(_LEET)
    words = set(w.strip(".,!?;:'\"()[]") for w in normalized.split())
    return bool(words & _BLOCKLIST)


def _check_moderation(text: str) -> Optional[str]:
    """
    Returns an error message string if content is flagged, None if clean.
    Layer 1: built-in blocklist (zero dependencies, always runs).
    Layer 2: better-profanity library (if installed).
    Layer 3: OpenAI Moderation API (if API key is available).
    """
    # Layer 1 — always runs
    if _blocklist_hit(text):
        return "Your message contains inappropriate language. Please keep the community respectful."

    # Layer 2 — better-profanity (optional)
    try:
        from better_profanity import profanity
        profanity.load_censor_words()
        if profanity.contains_profanity(text):
            return "Your message contains inappropriate language. Please keep the community respectful."
    except Exception:
        pass

    # Layer 3 — OpenAI Moderation API (optional, free endpoint)
    try:
        import openai
        response = openai.moderations.create(input=text)
        result = response.results[0]
        if result.flagged:
            categories = result.categories
            flagged = [
                name.replace("_", " ")
                for name, flagged_val in vars(categories).items()
                if flagged_val
            ]
            label = flagged[0] if flagged else "inappropriate content"
            return f"Your message was flagged for {label}. Please keep the community respectful."
    except Exception:
        pass

    return None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_admin(user: User, db: Session) -> bool:
    if user.email.endswith("@fullerton.edu"):
        return True
    first = db.query(User).order_by(User.created_at).first()
    return first and first.id == user.id


def _question_to_response(s: FAQSubmission) -> FAQSubmissionResponse:
    return FAQSubmissionResponse(
        id=s.id,
        user_id=s.user_id,
        question=s.question,
        answer=s.answer,
        category=s.category,
        status=s.status.value if hasattr(s.status, "value") else s.status,
        created_at=s.created_at,
        answers=[
            FAQAnswerResponse(
                id=a.id,
                question_id=a.question_id,
                user_id=a.user_id,
                author_name=a.author_name,
                answer_text=a.answer_text,
                created_at=a.created_at,
            )
            for a in (s.answers or [])
        ],
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[dict])
def list_faq(db: Session = Depends(get_db)):
    """Returns static FAQ items + all open/approved community questions with their answers."""
    with open(_FAQ_PATH, "r") as f:
        static_items = json.load(f)
    for item in static_items:
        item["source"] = "static"

    community_qs = (
        db.query(FAQSubmission)
        .options(joinedload(FAQSubmission.answers))
        .filter(FAQSubmission.status.in_([FAQStatusEnum.OPEN, FAQStatusEnum.APPROVED]))
        .order_by(FAQSubmission.created_at.desc())
        .all()
    )

    community_items = []
    for s in community_qs:
        community_items.append({
            "id": str(s.id),
            "question": s.question,
            "answer": s.answer or "",
            "category": s.category or "Community",
            "source": "community",
            "answers": [
                {
                    "id": str(a.id),
                    "user_id": str(a.user_id),
                    "author_name": a.author_name or "Anonymous",
                    "answer_text": a.answer_text,
                    "created_at": a.created_at.isoformat(),
                }
                for a in s.answers
            ],
        })

    return static_items + community_items


@router.post("/submit", response_model=FAQSubmissionResponse, status_code=201)
def submit_question(
    body: FAQSubmissionCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a question — appears immediately for everyone to see and answer."""
    error = _check_moderation(body.question)
    if error:
        raise HTTPException(status_code=422, detail=error)

    submission = FAQSubmission(
        id=uuid.uuid4(),
        user_id=current_user.id,
        question=body.question,
        category=body.category,
        status=FAQStatusEnum.OPEN,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return _question_to_response(submission)


@router.post("/questions/{question_id}/answer", response_model=FAQAnswerResponse, status_code=201)
def post_answer(
    question_id: str,
    body: FAQAnswerCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Any logged-in user can post an answer to an open community question."""
    q = db.query(FAQSubmission).filter(FAQSubmission.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    if q.status == FAQStatusEnum.REJECTED:
        raise HTTPException(status_code=403, detail="This question is no longer available")

    error = _check_moderation(body.answer_text)
    if error:
        raise HTTPException(status_code=422, detail=error)

    author_name = current_user.name or current_user.email.split("@")[0]
    answer = FAQAnswer(
        id=uuid.uuid4(),
        question_id=q.id,
        user_id=current_user.id,
        author_name=author_name,
        answer_text=body.answer_text,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return FAQAnswerResponse(
        id=answer.id,
        question_id=answer.question_id,
        user_id=answer.user_id,
        author_name=answer.author_name,
        answer_text=answer.answer_text,
        created_at=answer.created_at,
    )


@router.delete("/answers/{answer_id}", status_code=204)
def delete_answer(
    answer_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Answer author (or admin) can delete their own answer."""
    answer = db.query(FAQAnswer).filter(FAQAnswer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    if answer.user_id != current_user.id and not _is_admin(current_user, db):
        raise HTTPException(status_code=403, detail="You can only delete your own answers")
    db.delete(answer)
    db.commit()


@router.get("/my-submissions", response_model=List[FAQSubmissionResponse])
def my_submissions(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subs = (
        db.query(FAQSubmission)
        .options(joinedload(FAQSubmission.answers))
        .filter(FAQSubmission.user_id == current_user.id)
        .order_by(FAQSubmission.created_at.desc())
        .all()
    )
    return [_question_to_response(s) for s in subs]


@router.get("/pending", response_model=List[FAQSubmissionResponse])
def pending_submissions(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: list all open questions (for moderation / rejection)."""
    if not _is_admin(current_user, db):
        raise HTTPException(status_code=403, detail="Admin access required")
    subs = (
        db.query(FAQSubmission)
        .options(joinedload(FAQSubmission.answers))
        .filter(FAQSubmission.status == FAQStatusEnum.OPEN)
        .order_by(FAQSubmission.created_at)
        .all()
    )
    return [_question_to_response(s) for s in subs]


@router.patch("/submissions/{submission_id}/review", response_model=FAQSubmissionResponse)
def review_submission(
    submission_id: str,
    body: FAQSubmissionReview,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: reject a question (removes it from community view) or re-approve a rejected one."""
    if not _is_admin(current_user, db):
        raise HTTPException(status_code=403, detail="Admin access required")
    sub = (
        db.query(FAQSubmission)
        .options(joinedload(FAQSubmission.answers))
        .filter(FAQSubmission.id == submission_id)
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.status = FAQStatusEnum.APPROVED if body.status == "approved" else FAQStatusEnum.REJECTED
    if body.answer:
        sub.answer = body.answer
    db.commit()
    db.refresh(sub)
    return _question_to_response(sub)
