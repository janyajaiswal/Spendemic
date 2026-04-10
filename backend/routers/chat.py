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

_openai_client = None


def _get_openai():
    global _openai_client
    if _openai_client is None:
        try:
            import openai
            key = os.getenv("OPENAI_API_KEY", "")
            if key and key not in ("", "your_openai_api_key_here"):
                _openai_client = openai.OpenAI(api_key=key)
        except ImportError:
            pass
    return _openai_client


def _build_system_prompt(user, db: Session) -> str:
    today = date.today()
    month_start = today.replace(day=1)

    budgets = db.query(Budget).filter(Budget.user_id == user.id, Budget.is_active == True).all()
    budget_lines = [
        f"  - {b.category.value}: ${float(b.limit_amount):.2f}/{b.period.value}"
        for b in budgets
    ] or ["  (none set)"]

    month_spend = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user.id,
            Transaction.type == TransactionTypeEnum.EXPENSE,
            Transaction.transaction_date >= month_start,
            Transaction.transaction_date <= today,
        )
        .all()
    )
    total_spent = sum(float(t.amount) for t in month_spend)

    jobs = db.query(Job).filter(Job.user_id == user.id, Job.is_active == True).all()
    job_lines = [
        f"  - {j.job_name} @ ${float(j.hourly_rate)}/hr, {float(j.hours_per_week)} hrs/wk"
        for j in jobs
    ] or ["  (no active jobs)"]

    return f"""You are Spendemic Assistant, an AI financial guide embedded inside the Spendemic app — a budgeting tool for international students at California State University, Fullerton (CSUF).

User profile:
- Name: {user.name}
- Visa: {user.visa_type or "unknown"}
- University: {user.university or "CSUF"}
- Home currency: {user.home_currency.value if user.home_currency else "USD"}

This month's spending so far: ${total_spent:.2f}

Active budgets:
{chr(10).join(budget_lines)}

Active jobs:
{chr(10).join(job_lines)}

App pages you can direct users to:
- /dashboard — overview, financial health, visa rules, resources
- /budgets — budgets and savings goals
- /expenses or /transactions — log and view transactions
- /reports — AI spending forecast (Chronos-2), loan repayment chart
- /settings — profile, address, academic, jobs with weekly hour logs
- /faq — frequently asked questions, submit new questions

Capabilities:
1. Answer financial questions for international students (taxes, visa work-hour limits, banking, scholarships, FAFSA, state taxes in California, rent near Fullerton CA, etc.).
2. Help users navigate the app — if they ask how to do something, explain which page and what button to click.
3. Add transactions on behalf of the user. When a user says they spent money or received money, output a JSON block at the END of your reply in this exact format (nothing else after it):
```json
{{"action":"add_transaction","amount":<number>,"type":"EXPENSE" or "INCOME","category":"<CATEGORY>","description":"<short description>"}}
```
Valid categories: HOUSING, FOOD, TRANSPORTATION, EDUCATION, HEALTHCARE, ENTERTAINMENT, SHOPPING, UTILITIES, PERSONAL_CARE, TRAVEL, SAVINGS, SALARY, STIPEND, SCHOLARSHIP, FINANCIAL_AID, FAMILY_SUPPORT, FREELANCE, OTHER

4. For living cost questions near CSUF/Fullerton, CA: answer from your knowledge (typical rent $1200-$2000/mo for a 1BR near Fullerton, food $300-$500/mo, etc.).

Keep answers concise and student-friendly. Do NOT invent financial regulations — cite what you know and recommend the ISO office or irs.gov for official guidance."""


def _extract_action(text: str) -> Optional[dict]:
    match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
        if data.get("action") == "add_transaction":
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
    client = _get_openai()
    if not client:
        raise HTTPException(
            status_code=503,
            detail="Chat is unavailable: OPENAI_API_KEY not configured.",
        )

    system_prompt = _build_system_prompt(current_user, db)

    messages = [{"role": "system", "content": system_prompt}]
    for h in body.history[-10:]:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": body.message})

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=600,
            temperature=0.4,
        )
        reply_text = resp.choices[0].message.content or ""
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {exc}")

    action = _extract_action(reply_text)
    clean_reply = _strip_action_block(reply_text)

    return ChatResponse(reply=clean_reply, action=action)
