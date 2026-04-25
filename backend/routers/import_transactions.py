"""
Transaction import router — Excel / CSV bulk import.

POST /api/v1/transactions/import/preview  → parse file, return detected columns + 5-row preview
POST /api/v1/transactions/import/confirm  → re-upload file with confirmed mapping, save to DB
"""
from __future__ import annotations

import io
import json
import os
import re
import datetime
from decimal import Decimal
from typing import Optional

import anthropic
import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models import Transaction, TransactionTypeEnum, CategoryEnum, CurrencyEnum
from routers.auth import get_current_user

# ---------------------------------------------------------------------------
# Lazy Anthropic client (only initialised when ANTHROPIC_API_KEY is set)
# ---------------------------------------------------------------------------
_anthropic_client: anthropic.Anthropic | None = None

def _get_anthropic() -> anthropic.Anthropic | None:
    global _anthropic_client
    if _anthropic_client is None:
        key = os.getenv("ANTHROPIC_API_KEY", "")
        if key and key != "your_anthropic_api_key_here":
            _anthropic_client = anthropic.Anthropic(api_key=key)
    return _anthropic_client

router = APIRouter(prefix="/api/v1/transactions/import", tags=["import"])


# ---------------------------------------------------------------------------
# Column alias dictionary — maps our field names to common Excel/bank headers
# ---------------------------------------------------------------------------
_ALIASES: dict[str, list[str]] = {
    "date":        ["date", "posted", "transaction date", "trans date", "value date",
                    "booking date", "trans. date", "posting date", "txn date"],
    "amount":      ["amount", "sum", "total", "price", "value", "amnt", "amt",
                    "transaction amount", "net amount"],
    "debit":       ["debit", "dr", "withdrawal", "out", "charge", "payment out",
                    "money out", "debit amount"],
    "credit":      ["credit", "cr", "deposit", "in", "payment in", "money in",
                    "credit amount"],
    "description": ["description", "desc", "memo", "note", "merchant", "payee",
                    "narration", "particulars", "details", "remarks", "reference",
                    "transaction description", "narrative", "name"],
    "category":    ["category", "cat", "tag", "spending category", "expense type",
                    "log", "label", "labels", "journal", "my category", "custom category"],
    "currency":    ["currency", "curr", "ccy", "iso currency", "currency code"],
    "type":        ["type", "transaction type", "direction", "debit/credit", "dr/cr",
                    "cr/dr", "txn type"],
}

# ---------------------------------------------------------------------------
# Category keyword inference
# ---------------------------------------------------------------------------
_CATEGORY_KW: dict[str, list[str]] = {
    "HOUSING":        ["rent", "lease", "apartment", "housing", "dorm", "landlord"],
    "FOOD":           ["grocery", "groceries", "supermarket", "restaurant", "cafe",
                       "coffee", "food", "dining", "meal", "doordash", "ubereats",
                       "grubhub", "chipotle", "mcdonald", "subway", "pizza", "starbucks"],
    "TRANSPORTATION": ["uber", "lyft", "bus", "metro", "transit", "gas", "fuel",
                       "parking", "transport", "train", "amtrak", "rideshare"],
    "EDUCATION":      ["tuition", "university", "college", "textbook", "book",
                       "course", "library", "school", "exam", "registration", "chegg"],
    "HEALTHCARE":     ["pharmacy", "doctor", "hospital", "clinic", "medical",
                       "dental", "health", "insurance", "prescription", "cvs", "walgreens"],
    "ENTERTAINMENT":  ["netflix", "spotify", "hulu", "youtube", "movie", "cinema",
                       "theater", "concert", "game", "steam", "playstation", "disney"],
    "SHOPPING":       ["amazon", "target", "walmart", "mall", "store", "shop",
                       "clothing", "fashion", "ebay", "etsy", "best buy"],
    "UTILITIES":      ["electric", "electricity", "water", "internet", "wifi",
                       "phone", "mobile", "utility", "at&t", "verizon", "t-mobile", "comcast"],
    "TRAVEL":         ["flight", "airline", "hotel", "airbnb", "travel", "trip",
                       "vacation", "delta", "united", "american airlines", "booking.com"],
    "SALARY":         ["salary", "payroll", "wage", "paycheck", "direct deposit"],
    "SCHOLARSHIP":    ["scholarship", "grant", "fellowship", "financial aid"],
    "STIPEND":        ["stipend", "ta stipend", "ra stipend", "teaching assistant",
                       "research assistant"],
    "FAMILY_SUPPORT": ["family", "parents", "wire transfer", "remittance", "zelle",
                       "venmo", "transfer from"],
    "PERSONAL_CARE":  ["gym", "fitness", "workout", "yoga", "pilates", "crossfit",
                       "personal trainer", "swimming", "haircut", "salon", "spa",
                       "barber", "cosmetics", "hygiene", "laundry", "detergent"],
    "FREELANCE":      ["freelance", "gig", "contract work", "side hustle", "consulting",
                       "commission", "client payment"],
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
) -> dict:
    """
    Parse an Excel or CSV file and return:
    - detected_columns: our field names mapped to the Excel headers we matched
    - undetected: fields we couldn't find (defaults will be used at confirm)
    - preview_rows: first 5 parsed rows as they would be imported
    - total_rows: total row count in the file
    - all_columns: every column header in the file (so UI can offer corrections)
    - warnings: data quality issues
    """
    df = _read_file(file)
    detected = _detect_columns(list(df.columns))
    warnings: list[str] = []

    if detected.get("date") is None:
        raise HTTPException(
            status_code=422,
            detail="Could not find a date column. Rename a column to 'Date', 'Posted', or 'Transaction Date' and re-upload.",
        )
    has_amount = detected.get("amount") or detected.get("debit") or detected.get("credit")
    if not has_amount:
        raise HTTPException(
            status_code=422,
            detail="Could not find an amount column. Rename a column to 'Amount', 'Debit', or 'Credit' and re-upload.",
        )

    undetected = [f for f in ["description", "category", "currency", "type"] if not detected.get(f)]

    if "category" in undetected:
        warnings.append("No category column — categories will be inferred from descriptions where possible, otherwise set to 'Other'.")
    if "currency" in undetected:
        warnings.append("No currency column — all amounts will be imported as USD.")
    if "type" in undetected and not detected.get("debit") and not detected.get("credit"):
        warnings.append("No transaction type column — positive amounts = Income, negative = Expense.")

    date_col_name = detected.get("date")
    dayfirst = _detect_dayfirst(df[date_col_name]) if date_col_name else False
    if dayfirst:
        warnings.append("Dates look like DD/MM/YYYY — importing with day-first format.")

    raw_preview = [_parse_row(row, detected, dayfirst=dayfirst) for _, row in df.head(8).iterrows()]
    _apply_llm_categories(raw_preview, CategoryEnum.OTHER)
    preview = [
        {k: str(v) if isinstance(v, (datetime.date, datetime.datetime)) else v
         for k, v in r.items() if not k.startswith('_')}
        for r in raw_preview if r
    ][:5]

    return {
        "filename": file.filename,
        "total_rows": len(df),
        "detected_columns": {k: v for k, v in detected.items() if v},
        "undetected": undetected,
        "preview_rows": preview,
        "all_columns": list(df.columns),
        "warnings": warnings,
        "date_format": "DD/MM/YYYY" if dayfirst else "MM/DD/YYYY",
    }


@router.post("/confirm")
async def confirm_import(
    file: UploadFile = File(...),
    date_col: str = Form(...),
    amount_col: Optional[str] = Form(None),
    debit_col: Optional[str] = Form(None),
    credit_col: Optional[str] = Form(None),
    description_col: Optional[str] = Form(None),
    category_col: Optional[str] = Form(None),
    currency_col: Optional[str] = Form(None),
    type_col: Optional[str] = Form(None),
    default_currency: str = Form(default="USD"),
    default_category: str = Form(default="OTHER"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Re-upload the file with the confirmed column mapping and save all valid rows.
    Returns counts of imported / skipped rows and up to 20 per-row errors.
    """
    df = _read_file(file)

    try:
        def_currency = CurrencyEnum(default_currency)
    except ValueError:
        def_currency = CurrencyEnum.USD
    try:
        def_category = CategoryEnum(default_category)
    except ValueError:
        def_category = CategoryEnum.OTHER

    col_map = {
        "date": date_col, "amount": amount_col, "debit": debit_col,
        "credit": credit_col, "description": description_col,
        "category": category_col, "currency": currency_col, "type": type_col,
    }

    # Detect date format once for the whole file
    dayfirst = _detect_dayfirst(df[date_col]) if date_col else False

    # Parse all rows with keyword matching, then upgrade ambiguous categories via LLM
    all_rows = list(df.iterrows())
    parsed_rows: list[dict | None] = [
        _parse_row(row, col_map, def_currency, def_category, dayfirst=dayfirst)
        for _, row in all_rows
    ]
    _apply_llm_categories(parsed_rows, def_category)

    imported = skipped = 0
    errors: list[str] = []
    imported_dates: list = []

    for idx, parsed in enumerate(parsed_rows, start=2):
        if parsed is None:
            skipped += 1
            continue
        try:
            parsed.pop("_slang_label", None)  # internal key — strip before use
            db.add(Transaction(
                user_id=current_user.id,
                amount=Decimal(str(parsed["amount"])),
                currency=CurrencyEnum(parsed["currency"]),
                type=TransactionTypeEnum(parsed["type"]),
                category=CategoryEnum(parsed["category"]),
                description=parsed.get("description"),
                transaction_date=parsed["date"],
                is_recurring=False,
                is_generated=False,
            ))
            imported_dates.append(parsed["date"])
            imported += 1
        except Exception as exc:
            errors.append(f"Row {idx}: {exc}")
            skipped += 1

    if imported > 0:
        db.commit()

    date_range = None
    if imported_dates:
        date_range = {"min": str(min(imported_dates)), "max": str(max(imported_dates))}

    return {"imported": imported, "skipped": skipped, "errors": errors[:20], "date_range": date_range}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _detect_dayfirst(date_series: pd.Series) -> bool:
    """
    Scan the date column to determine whether day comes first (DD/MM/YYYY).

    Strategy:
    - If any value has a first component > 12, it can only be a day → day-first.
    - If any value has a second component > 12, it can only be a day → month-first (US).
    - If values are already datetime objects (Excel auto-parsed), trust pandas → not day-first.
    - Majority vote wins; defaults to False (US) when truly ambiguous.
    """
    dayfirst_votes = 0
    monthfirst_votes = 0

    for val in date_series.dropna():
        # Already a proper datetime — pandas/Excel parsed it correctly
        if isinstance(val, (pd.Timestamp, datetime.date, datetime.datetime)):
            return False

        s = str(val).strip()
        # Split on common separators: / - .
        parts = re.split(r'[/\-\.]', s)
        if len(parts) < 2:
            continue
        try:
            a, b = int(parts[0]), int(parts[1])
        except ValueError:
            continue

        if a > 12:
            dayfirst_votes += 1   # first component can't be a month → day-first
        elif b > 12:
            monthfirst_votes += 1  # second component can't be a month → month is first

    return dayfirst_votes > monthfirst_votes


def _parse_date(val, dayfirst: bool) -> datetime.date | None:
    """Parse a date value using the detected format. Falls back through multiple strategies."""
    if _isna(val):
        return None
    # Already a datetime-like object
    if isinstance(val, (pd.Timestamp, datetime.datetime)):
        return val.date()
    if isinstance(val, datetime.date):
        return val
    s = str(val).strip()
    if not s:
        return None
    # Try pandas with the detected dayfirst setting
    try:
        return pd.to_datetime(s, dayfirst=dayfirst).date()
    except Exception:
        pass
    # Try dateutil as a fallback (more permissive)
    try:
        from dateutil import parser as du_parser
        return du_parser.parse(s, dayfirst=dayfirst).date()
    except Exception:
        pass
    # Last resort: pandas without dayfirst hint
    try:
        return pd.to_datetime(s).date()
    except Exception:
        return None


def _read_file(file: UploadFile) -> pd.DataFrame:
    content = file.file.read()
    fname = (file.filename or "").lower()
    try:
        df = pd.read_excel(io.BytesIO(content)) if fname.endswith((".xlsx", ".xls")) else pd.read_csv(io.BytesIO(content))
    except Exception:
        try:
            df = pd.read_csv(io.BytesIO(content), encoding="latin-1")
        except Exception:
            df = pd.read_excel(io.BytesIO(content))
    return df.dropna(how="all").reset_index(drop=True)


def _alias_matches(alias: str, norm: str) -> bool:
    """Match alias against normalized column name.
    Short aliases (≤3 chars) require whole-word match to avoid false positives
    like 'cr' matching 'description'.
    """
    if alias == norm:
        return True
    if len(alias) <= 3:
        return bool(re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", norm))
    return alias in norm or norm in alias


def _detect_columns(columns: list[str]) -> dict[str, str | None]:
    normalized = {col: col.lower().strip().replace("_", " ") for col in columns}
    result: dict[str, str | None] = {}
    for field, aliases in _ALIASES.items():
        result[field] = next(
            (col for col, norm in normalized.items()
             if any(_alias_matches(alias, norm) for alias in aliases)),
            None,
        )
    return result


_INCOME_CATEGORIES: frozenset[CategoryEnum] = frozenset({
    CategoryEnum.SALARY, CategoryEnum.SCHOLARSHIP, CategoryEnum.STIPEND,
    CategoryEnum.FINANCIAL_AID, CategoryEnum.FAMILY_SUPPORT, CategoryEnum.FREELANCE,
})


def _parse_row(
    row,
    col_map: dict,
    default_currency: CurrencyEnum = CurrencyEnum.USD,
    default_category: CategoryEnum = CategoryEnum.OTHER,
    dayfirst: bool = False,
) -> dict | None:
    # Date (required)
    date_col = col_map.get("date")
    if not date_col or _isna(row.get(date_col)):
        return None
    tx_date = _parse_date(row[date_col], dayfirst)
    if tx_date is None:
        return None

    # Description (early — needed for category/type inference)
    desc = None
    desc_col = col_map.get("description")
    if desc_col and not _isna(row.get(desc_col)):
        desc = str(row[desc_col]).strip()[:500]

    # Category (early — needed to infer transaction type for single-amount columns)
    category = default_category
    slang_label: str | None = None
    cat_col = col_map.get("category")
    if cat_col and not _isna(row.get(cat_col)):
        try:
            category = CategoryEnum(str(row[cat_col]).upper().strip().replace(" ", "_"))
        except ValueError:
            # Category column has a non-enum value (e.g. slang labels).
            # Prefer description-based inference — it's more reliable than user slang.
            # Fall back to slang-based inference, then default.
            slang_label = str(row[cat_col]).strip()
            # Use description for keyword inference — slang is too unreliable
            # (e.g. "Uber robbed me again" matching TRANSPORTATION for a food purchase).
            # If description has no keyword match, fall back to OTHER so the LLM
            # gets a chance to classify it from both the description and slang label.
            category = (desc and _infer_category(desc)) or default_category
    elif desc:
        category = _infer_category(desc) or default_category

    # Amount + type
    amount: float | None = None
    tx_type = TransactionTypeEnum.EXPENSE
    debit_col, credit_col, amount_col = col_map.get("debit"), col_map.get("credit"), col_map.get("amount")

    if debit_col and credit_col:
        debit  = _to_float(row.get(debit_col))
        credit = _to_float(row.get(credit_col))
        if credit and credit > 0:
            amount, tx_type = abs(credit), TransactionTypeEnum.INCOME
        elif debit and debit > 0:
            amount, tx_type = abs(debit), TransactionTypeEnum.EXPENSE
    elif amount_col:
        raw = _to_float(row.get(amount_col))
        if raw is None:
            return None
        amount = abs(raw)
        if raw < 0:
            # Explicit negative sign → expense regardless of category
            tx_type = TransactionTypeEnum.EXPENSE
        else:
            # Most bank exports list all amounts as positive; use category to determine type.
            # Salary, scholarship, stipend, etc. → INCOME; everything else → EXPENSE.
            tx_type = TransactionTypeEnum.INCOME if category in _INCOME_CATEGORIES else TransactionTypeEnum.EXPENSE

    if not amount or amount <= 0:
        return None

    # Override type from explicit type column (highest priority)
    type_col = col_map.get("type")
    if type_col and not _isna(row.get(type_col)):
        raw_t = str(row[type_col]).upper()
        if any(k in raw_t for k in ["CR", "CREDIT", "IN", "INCOME", "DEPOSIT"]):
            tx_type = TransactionTypeEnum.INCOME
        elif any(k in raw_t for k in ["DR", "DEBIT", "OUT", "EXPENSE", "WITHDRAWAL", "CHARGE"]):
            tx_type = TransactionTypeEnum.EXPENSE

    # Currency
    currency = default_currency
    curr_col = col_map.get("currency")
    if curr_col and not _isna(row.get(curr_col)):
        try:
            currency = CurrencyEnum(str(row[curr_col]).upper().strip())
        except ValueError:
            pass

    result: dict = {
        "date": tx_date,
        "amount": round(amount, 2),
        "type": tx_type.value,
        "category": category.value,
        "currency": currency.value,
        "description": desc,
    }
    if slang_label:
        result["_slang_label"] = slang_label
    return result


def _isna(val) -> bool:
    if val is None:
        return True
    try:
        return bool(pd.isna(val))
    except Exception:
        return False


def _to_float(val) -> float | None:
    if _isna(val):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        pass
    try:
        cleaned = str(val).replace(",", "").replace("$", "").replace("£", "").replace("€", "").strip()
        if cleaned.startswith("(") and cleaned.endswith(")"):
            cleaned = "-" + cleaned[1:-1]   # accounting-style negatives: (100) → -100
        return float(cleaned)
    except (ValueError, TypeError):
        return None


_VALID_CATS = [e.value for e in CategoryEnum]


def _llm_infer_categories(descriptions: list[str]) -> list[dict]:
    """
    Batch-classify transaction descriptions using Claude Haiku.
    Returns a list of dicts with 'category' and optional 'description' (a clean
    human-readable label derived from slang when the original description was absent).
    Falls back to {"category": "OTHER"} for any item that can't be classified.
    """
    client = _get_anthropic()
    if client is None or not descriptions:
        return [{"category": "OTHER"}] * len(descriptions)

    numbered = "\n".join(f"{i + 1}. {d}" for i, d in enumerate(descriptions))
    prompt = f"""You are a financial transaction classifier for an international student budgeting app.

Each input is either:
- A plain description: "Late night snacks"
- A description + informal label: "Late night snacks (label: Uber be taxing fr)"
- A label only (no real description): "(label: Phone bill jump scare)"

For each transaction return:
1. "category" — one value from: {json.dumps(_VALID_CATS)}
2. "description" — Write a clean 3-5 word description when:
   - Input is label-only "(label: ...)" — interpret the label into plain English (e.g. "Phone bill payment")
   - Input has both a description AND a label — if the label provides more specific context than the description, return a better description combining both (e.g. description="New hobby try", label="Gym arc loading" → "Gym session"). Otherwise omit it.

Categorization rules:
- When both a description and label are present, base the category on the DESCRIPTION, not the label.
- FOOD: food, drink, restaurant, delivery, grocery, café, snack, "grub", "eats", munchies, etc.
- HOUSING: rent, dorm, lease, landlord, roommate, sublet, etc.
- TRANSPORTATION: ride-share, transit, gas, parking, toll, cab, scooter, etc.
- EDUCATION: tuition, textbook, course, library, university fees, etc.
- HEALTHCARE: pharmacy, doctor, dental, therapy, insurance co-pay, etc.
- ENTERTAINMENT: streaming, games, concerts, bars, sports, etc.
- SHOPPING: clothing, electronics, online shopping, household goods, etc.
- UTILITIES: electricity, internet, phone bill, mobile bill, gas bill, trash, etc.
- PERSONAL_CARE: gym, fitness, workout, yoga, haircut, salon, spa, cosmetics, hygiene, laundry, etc.
- TRAVEL: flights, hotels, car rental, vacation, Airbnb, etc.
- SALARY / SCHOLARSHIP / STIPEND / FINANCIAL_AID / FAMILY_SUPPORT / FREELANCE: income sources
- SAVINGS: transfers to savings accounts or investment platforms
- OTHER: genuinely ambiguous — use sparingly

Return ONLY a JSON array, one object per input, same order, no explanation:
[{{"category": "CATEGORY1"}}, {{"category": "CATEGORY2", "description": "Phone bill payment"}}, ...]

Transactions:
{numbered}"""

    try:
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=768,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        raw = re.sub(r"^```[a-z]*\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        parsed = json.loads(raw)
        result = []
        for item in parsed:
            cat = str(item.get("category", "OTHER")).upper().strip().replace(" ", "_")
            entry: dict = {"category": cat if cat in _VALID_CATS else "OTHER"}
            if item.get("description"):
                entry["description"] = str(item["description"]).strip()[:200]
            result.append(entry)
        while len(result) < len(descriptions):
            result.append({"category": "OTHER"})
        return result[: len(descriptions)]
    except Exception:
        return [{"category": "OTHER"}] * len(descriptions)


def _apply_llm_categories(
    parsed_rows: list[dict | None],
    default_category: CategoryEnum,
) -> list[dict | None]:
    """
    For rows where category == default_category, batch-call the LLM to infer
    category, enrich vague descriptions using slang label context, and flip
    type to INCOME when an income category is assigned.
    Mutates and returns the list in-place.
    """
    indices: list[int] = []
    descs: list[str] = []
    for i, row in enumerate(parsed_rows):
        if row and row.get("category") == default_category.value:
            desc = row.get("description")
            slang = row.get("_slang_label")
            # Need at least one text signal to send to LLM
            if not desc and not slang:
                continue
            indices.append(i)
            if desc and slang:
                text = f'{desc} (label: {slang})'
            elif desc:
                text = desc
            else:
                text = f'(label: {slang})'  # slang only — no description
            descs.append(text)

    if not descs:
        return parsed_rows

    llm_results = _llm_infer_categories(descs)
    for idx, result in zip(indices, llm_results):
        cat = result["category"]
        parsed_rows[idx]["category"] = cat  # type: ignore[index]
        # Use LLM description if:
        # - row had no description (slang-only), OR
        # - row had a slang label (meaning description was too vague) and LLM suggests a better one
        had_slang = bool(parsed_rows[idx].get("_slang_label"))  # type: ignore[index]
        if result.get("description") and (not parsed_rows[idx].get("description") or had_slang):  # type: ignore[index]
            parsed_rows[idx]["description"] = result["description"]  # type: ignore[index]
        # Re-evaluate type: if LLM assigned an income category, flip to INCOME
        try:
            if CategoryEnum(cat) in _INCOME_CATEGORIES:
                parsed_rows[idx]["type"] = TransactionTypeEnum.INCOME.value  # type: ignore[index]
        except ValueError:
            pass

    return parsed_rows


def _infer_category(text: str) -> CategoryEnum | None:
    lower = text.lower()
    for cat_name, keywords in _CATEGORY_KW.items():
        if any(kw in lower for kw in keywords):
            try:
                return CategoryEnum(cat_name)
            except ValueError:
                pass
    return None
