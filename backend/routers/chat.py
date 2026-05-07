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
    university = user.university or "your university"

    budgets = db.query(Budget).filter(Budget.user_id == user.id, Budget.is_active == True).all()
    budget_lines = [
        f"  - {b.category.value if hasattr(b.category, 'value') else b.category}: "
        f"${float(b.limit_amount):.2f}/{b.period.value if hasattr(b.period, 'value') else b.period}"
        f"  (spent: ${float(b.spent) if hasattr(b, 'spent') else 0:.2f})"
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

    return f"""You are Spendemic Assistant, a helpful AI financial guide built into Spendemic — a budgeting app for international students.

User profile:
- Name: {user.name or "Student"}
- Visa: {user.visa_type or "unknown"}
- University: {university}
- Home currency: {home_currency}
- This month's expenses so far: ${total_spent:.2f}

Active budgets:
{chr(10).join(budget_lines)}

Active jobs:
{chr(10).join(job_lines)}

===== APP NAVIGATION =====
The app has these pages. Use navigate actions INSTEAD of telling the user to click anything.

| Page | Path | What's there |
|------|------|--------------|
| Dashboard – Overview tab | /dashboard | Monthly snapshot, recent transactions, budget health |
| Dashboard – Financial Health tab | /dashboard?tab=health | Income/expense charts, budget progress bars |
| Dashboard – Visa & Work tab | /dashboard?tab=visa | Weekly work-hours tracker, visa compliance rules |
| Dashboard – Resources tab | /dashboard?tab=resources | Banking, scholarships, tax, health insurance links |
| Transactions | /transactions | Add/view/filter/import/export all transactions |
| Budgets & Goals | /budgets | Monthly spending caps + savings goals |
| AI Forecast / Reports | /reports | Chronos-2 spending forecast, savings outlook, loan chart |
| Settings | /settings | Profile, academic info, jobs, notification preferences |
| FAQ | /faq | Frequently asked questions for international students |

===== ACTION SYSTEM =====
You can perform actions by appending ONE JSON block at the very end of your reply.
IMPORTANT: Always write at least one sentence of text BEFORE the JSON block. Never emit ONLY a JSON block.
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
Valid paths: /dashboard, /dashboard?tab=health, /dashboard?tab=visa, /dashboard?tab=resources, /budgets, /transactions, /reports, /settings, /faq

3. CREATE GOAL — when user asks to make/add/set a savings goal:
```json
{{"action":"create_goal","name":"<goal name>","target_amount":<number>,"deadline":"<YYYY-MM-DD or null>"}}
```

4. CREATE BUDGET — when user asks to create/set/add a budget with a specific category and amount:
```json
{{"action":"create_budget","category":"<CATEGORY>","limit_amount":<number>,"period":"monthly" or "weekly"}}
```
Valid budget categories: HOUSING, FOOD, TRANSPORTATION, EDUCATION, HEALTHCARE, ENTERTAINMENT, SHOPPING, UTILITIES, PERSONAL_CARE, TRAVEL, SAVINGS, OTHER

Rules for using actions:
- ALWAYS use navigate instead of saying "go to" or "click". Never describe how to navigate — just emit the action.
- ALWAYS include at least one sentence of text before the JSON block.
- ALWAYS use create_goal when user asks to create a goal.
- ALWAYS use create_budget when user asks to create a budget with a clear category and amount.
- Only emit one action per reply.
- For visa/work info: navigate to /dashboard?tab=visa — never just describe it in text.
- For forecast/reports: navigate to /reports.

===== KNOWLEDGE =====
1. Visa work rules: F-1/J-1 max 20 hrs/wk on-campus during school, full-time during official breaks. CPT tied to coursework; OPT is post-graduation authorization (up to 12 months, STEM extension 24 months). Never fabricate limits — recommend the international student office for specifics.
2. Taxes: F-1/J-1 students file as non-residents (Form 1040-NR + Form 8843). Sprintax is the recommended software. ITIN needed if no SSN. Many countries have US tax treaties reducing withholding on scholarships.
3. Living costs near {university}: 1BR apartment $1,200–$2,000/mo, shared room $600–$900/mo, groceries $250–$450/mo, eating out $8–$15/meal, bus pass ~$60/mo (adjust if outside CA).
4. Help users understand their own data — reference their budgets and spending above when relevant.

Keep replies concise (2–4 sentences). When you don't know something specific, say so and point to irs.gov or the ISSS office."""


def _extract_action(text: str) -> Optional[dict]:
    match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
        if data.get("action") in ("add_transaction", "navigate", "create_goal", "create_budget"):
            return data
    except (json.JSONDecodeError, KeyError):
        pass
    return None


def _strip_action_block(text: str) -> str:
    stripped = re.sub(r"```json\s*\{.*?\}\s*```", "", text, flags=re.DOTALL).strip()
    return stripped if stripped else "Done!"


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
