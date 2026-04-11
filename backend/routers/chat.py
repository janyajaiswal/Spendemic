import json
import os
import re
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Budget, Transaction, TransactionTypeEnum, Job
from routers.auth import get_current_user
from schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

_anthropic_client = None


def _get_client():
    global _anthropic_client
    if _anthropic_client is None:
        try:
            import anthropic
            key = os.getenv("ANTHROPIC_API_KEY", "")
            if key:
                _anthropic_client = anthropic.Anthropic(api_key=key)
        except ImportError:
            pass
    return _anthropic_client


def _build_system_prompt(user, db: Session) -> str:
    today = date.today()
    month_start = today.replace(day=1)

    budgets = db.query(Budget).filter(Budget.user_id == user.id, Budget.is_active == True).all()
    budget_lines = [
        f"  - {b.category.value if hasattr(b.category, 'value') else b.category}: "
        f"${float(b.limit_amount):.2f}/{b.period.value if hasattr(b.period, 'value') else b.period}"
        for b in budgets
    ] or ["  (none set)"]

    month_txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user.id,
            Transaction.type == TransactionTypeEnum.EXPENSE,
            Transaction.transaction_date >= month_start,
            Transaction.transaction_date <= today,
        )
        .all()
    )
    total_spent = sum(float(t.amount) for t in month_txns)

    jobs = db.query(Job).filter(Job.user_id == user.id, Job.is_active == True).all()
    job_lines = [
        f"  - {j.job_name} @ ${float(j.hourly_rate)}/hr, {float(j.hours_per_week)} hrs/wk"
        for j in jobs
    ] or ["  (no active jobs)"]

    home_currency = (
        user.home_currency.value if hasattr(user.home_currency, "value")
        else (user.home_currency or "USD")
    )

    return f"""You are Spendemic Assistant, a helpful AI financial guide built into Spendemic — a budgeting app for international students at California State University, Fullerton (CSUF).

User profile:
- Name: {user.name or "Student"}
- Visa: {user.visa_type or "unknown"}
- University: {user.university or "CSUF"}
- Home currency: {home_currency}
- This month's expenses so far: ${total_spent:.2f}

Active budgets:
{chr(10).join(budget_lines)}

Active jobs:
{chr(10).join(job_lines)}

===== ACTION SYSTEM =====
You can perform actions by appending ONE JSON block at the very end of your reply.
Never put the JSON block in the middle of your text. Never output multiple JSON blocks.
Format (must be exact):
```json
{{"action":"<ACTION_NAME>", ...fields}}
```

Available actions:

1. ADD TRANSACTION — when user says they spent or received money:
```json
{{"action":"add_transaction","amount":<number>,"type":"EXPENSE" or "INCOME","category":"<CATEGORY>","description":"<short description>"}}
```
Valid categories: HOUSING, FOOD, TRANSPORTATION, EDUCATION, HEALTHCARE, ENTERTAINMENT, SHOPPING, UTILITIES, PERSONAL_CARE, TRAVEL, SAVINGS, SALARY, STIPEND, SCHOLARSHIP, FINANCIAL_AID, FAMILY_SUPPORT, FREELANCE, OTHER

2. NAVIGATE — when user wants to go to a page, asks to "show", "take me", "open", or "go to":
```json
{{"action":"navigate","path":"<PATH>"}}
```
Valid paths: /dashboard, /budgets, /transactions, /reports, /settings, /faq

3. CREATE GOAL — when user asks to make/add/set a savings goal:
```json
{{"action":"create_goal","name":"<goal name>","target_amount":<number>,"deadline":"<YYYY-MM-DD or null>"}}
```

Rules for using actions:
- ALWAYS use the navigate action instead of telling the user to "click the sidebar". Never say "go to /page" in text — just emit the navigate action.
- ALWAYS use create_goal when the user asks to create a goal — never say you can't do it.
- Only emit one action per reply.
- After emitting a navigate action, still give a one-sentence reply explaining what you're doing (e.g. "Taking you to Reports now.").
- After emitting create_goal, confirm what you're about to create (e.g. "I'll set up a PS5 Fund goal for $100.").

===== KNOWLEDGE =====
1. Financial questions for international students: F-1/J-1/OPT work-hour limits (20 hrs/wk during school, full-time on break), CPT/OPT authorization, ITIN, Form 8843, California state taxes, scholarships, health insurance, banking without SSN.
2. Living costs near CSUF/Fullerton CA: 1BR apartment $1,200–$2,000/mo, shared room $600–$900/mo, groceries $250–$450/mo, eating out $8–$15/meal, bus pass ~$60/mo.
3. Help users understand their own data — reference their budgets and spending above when relevant.

Keep replies concise (2–4 sentences). Never invent visa rules or tax law — say what you know and recommend the ISO office or irs.gov for official guidance."""


def _extract_action(text: str) -> Optional[dict]:
    match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
        if data.get("action") in ("add_transaction", "navigate", "create_goal"):
            return data
    except (json.JSONDecodeError, KeyError):
        pass
    return None


def _strip_action_block(text: str) -> str:
    return re.sub(r"```json\s*\{.*?\}\s*```", "", text, flags=re.DOTALL).strip()


@router.post("", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    client = _get_client()
    if not client:
        raise HTTPException(
            status_code=503,
            detail="Chat is unavailable: ANTHROPIC_API_KEY not configured.",
        )

    system_prompt = _build_system_prompt(current_user, db)

    messages = []
    for h in body.history[-10:]:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": body.message})

    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            system=system_prompt,
            messages=messages,
            max_tokens=600,
        )
        reply_text = resp.content[0].text if resp.content else ""
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Anthropic error: {exc}")

    action = _extract_action(reply_text)
    clean_reply = _strip_action_block(reply_text)

    return ChatResponse(reply=clean_reply, action=action)
