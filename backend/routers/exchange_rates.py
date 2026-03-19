"""
Exchange rate router.
GET /api/v1/exchange-rates/{base} — returns rates for a base currency,
fetched from ExchangeRate-API and cached in DB for 1 hour.
Falls back to a minimal hardcoded table when no API key is configured.
"""
import os
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException  # Depends kept for db injection
from sqlalchemy.orm import Session

from database import get_db
from models import ExchangeRateCache

router = APIRouter(prefix="/api/v1/exchange-rates", tags=["exchange-rates"])

_API_KEY = os.getenv("EXCHANGE_RATE_API_KEY", "")
_PLACEHOLDER = {"", "your_api_key_here"}
_CACHE_TTL = timedelta(hours=1)

# Hardcoded approximate rates vs USD for offline/dev mode (updated periodically)
_FALLBACK_RATES: dict[str, float] = {
    "USD": 1.0, "EUR": 0.92, "GBP": 0.79, "JPY": 149.5, "CNY": 7.24,
    "INR": 83.1, "CAD": 1.36, "AUD": 1.53, "CHF": 0.90, "SEK": 10.42,
    "NZD": 1.63, "SGD": 1.34, "HKD": 7.82, "NOK": 10.55, "KRW": 1325.0,
    "MXN": 17.15, "BRL": 4.97, "ZAR": 18.63, "TRY": 32.15, "PLN": 3.98,
    "DKK": 6.89, "THB": 35.1, "IDR": 15700.0, "MYR": 4.72, "PHP": 56.5,
    "CZK": 23.2, "HUF": 357.0, "ILS": 3.66, "AED": 3.67, "SAR": 3.75,
    "EGP": 30.9, "PKR": 278.0, "BDT": 110.0, "VND": 24500.0, "NGN": 1550.0,
    "KES": 130.0, "ARS": 870.0, "COP": 3900.0, "PEN": 3.72, "QAR": 3.64,
    "KWD": 0.308,
}


def _api_configured() -> bool:
    return _API_KEY not in _PLACEHOLDER


def _convert_fallback(base: str, target: str) -> float:
    """Cross-rate via USD when API is unavailable."""
    base_usd = _FALLBACK_RATES.get(base.upper(), 1.0)
    target_usd = _FALLBACK_RATES.get(target.upper(), 1.0)
    return target_usd / base_usd


async def get_rates(base: str, db: Session) -> dict[str, float]:
    """
    Return a dict of {currency: rate} where each rate converts 1 base unit.
    Checks DB cache first; fetches from API if stale / missing.
    Falls back to hardcoded rates when API key not configured.
    """
    base = base.upper()
    now = datetime.now(timezone.utc)
    cutoff = now - _CACHE_TTL

    # Try cached rows
    cached = (
        db.query(ExchangeRateCache)
        .filter(
            ExchangeRateCache.from_currency == base,
            ExchangeRateCache.fetched_at >= cutoff,
        )
        .all()
    )
    if cached:
        return {r.to_currency: float(r.rate) for r in cached}

    # Fetch from API
    if _api_configured():
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"https://v6.exchangerate-api.com/v6/{_API_KEY}/latest/{base}"
                )
            data = resp.json()
            if data.get("result") == "success":
                rates: dict[str, float] = data["conversion_rates"]
                # Upsert into cache
                for to_cur, rate in rates.items():
                    existing = (
                        db.query(ExchangeRateCache)
                        .filter(
                            ExchangeRateCache.from_currency == base,
                            ExchangeRateCache.to_currency == to_cur,
                        )
                        .first()
                    )
                    if existing:
                        existing.rate = rate
                        existing.fetched_at = now
                    else:
                        db.add(ExchangeRateCache(
                            from_currency=base,
                            to_currency=to_cur,
                            rate=rate,
                            fetched_at=now,
                        ))
                db.commit()
                return rates
        except Exception:
            pass  # Fall through to fallback

    # Offline fallback
    return {cur: _convert_fallback(base, cur) for cur in _FALLBACK_RATES}


@router.get("/{base_currency}")
async def exchange_rates(
    base_currency: str,
    db: Session = Depends(get_db),
) -> dict:
    base = base_currency.upper()
    if len(base) != 3:
        raise HTTPException(status_code=400, detail="Currency must be a 3-letter code")
    rates = await get_rates(base, db)
    return {
        "base": base,
        "rates": rates,
        "source": "api" if _api_configured() else "fallback",
    }