"""
AI Financial Planner - Authentication Endpoints
Google OAuth verification, email/password registration with OTP, and sign-in.
"""
from __future__ import annotations
import os
import uuid
import secrets
import threading
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserSession
from schemas import (
    GoogleAuthRequest,
    AuthResponse,
    UserResponse,
    RegisterRequest,
    OTPSentResponse,
    VerifyOTPRequest,
    SignInRequest,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ==================== AUTH DEPENDENCY ====================

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Extract and verify the Bearer JWT; return the corresponding User row."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub", "")
        jti: str = payload.get("jti", "")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    # Check revocation
    if jti:
        session = db.query(UserSession).filter(UserSession.jti == jti).first()
        if session and session.is_revoked:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user or not db_user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return db_user

# ==================== CONFIGURATION ====================

SECRET_KEY: str = os.getenv("SECRET_KEY", "")
GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
OTP_EXPIRE_MINUTES: int = 5

RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

GOOGLE_TOKENINFO_URL: str = "https://oauth2.googleapis.com/tokeninfo"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory OTP store:  email -> { code, expires_at, name, password_hash }
_otp_store: dict[str, dict] = {}
_otp_lock = threading.Lock()


# ==================== HELPERS ====================

def _hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_access_token(payload: dict[str, Any]) -> tuple[str, str, datetime]:
    """Returns (encoded_token, jti, expires_at)."""
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY environment variable is not set")
    jti = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = jwt.encode({**payload, "jti": jti, "exp": expires_at}, SECRET_KEY, algorithm=ALGORITHM)
    return token, jti, expires_at


def _record_session(db: Session, user_id: Any, jti: str, issued_at: datetime,
                    expires_at: datetime, request: Request) -> None:
    session = UserSession(
        user_id=user_id,
        jti=jti,
        issued_at=issued_at,
        expires_at=expires_at,
        is_revoked=False,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    db.add(session)
    db.commit()


def _send_otp_email(to_email: str, name: str, code: str) -> None:
    """Send OTP verification email via Resend. Falls back to terminal log in DEBUG mode."""
    if not RESEND_API_KEY:
        if DEBUG:
            print(f"\n{'='*50}\n[DEV] OTP for {to_email}: {code}\n{'='*50}\n", flush=True)
            return
        raise RuntimeError("RESEND_API_KEY not configured")

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <div style="background:#0e4c49;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#ffd700;margin:0;font-size:28px;">Spendemic</h1>
      </div>
      <div style="background:#f9f9f9;padding:32px;border-radius:0 0 12px 12px;border:1px solid #eee;">
        <p style="font-size:16px;color:#333;">Hi <strong>{name}</strong>,</p>
        <p style="color:#555;">Your verification code for Spendemic is:</p>
        <div style="text-align:center;margin:28px 0;">
          <span style="font-size:40px;font-weight:700;letter-spacing:10px;
                       color:#0e4c49;background:#fff3cd;padding:12px 24px;
                       border-radius:8px;border:2px dashed #ffd700;">
            {code}
          </span>
        </div>
        <p style="color:#888;font-size:13px;text-align:center;">
          This code expires in <strong>5 minutes</strong>.<br>
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </div>
    """

    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={
            "from": "Spendemic <onboarding@resend.dev>",
            "to": [to_email],
            "subject": f"{code} — Your Spendemic verification code",
            "html": html,
        },
        timeout=15,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Email send failed: {response.text}")


async def _verify_google_token(credential: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                GOOGLE_TOKENINFO_URL,
                params={"id_token": credential},
                timeout=10.0,
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not reach Google token verification service: {exc}",
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential — token rejected by Google",
        )

    token_info: dict[str, Any] = response.json()

    if GOOGLE_CLIENT_ID and token_info.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token audience mismatch",
        )

    return token_info


def _upsert_user(db: Session, token_info: dict[str, Any]) -> User:
    email: str = token_info["email"]
    name: str = token_info.get("name", email)
    now = datetime.now(timezone.utc)

    db_user: User | None = db.query(User).filter(User.email == email).first()

    if db_user is None:
        db_user = User(
            email=email,
            name=name,
            email_verified=True,
            last_login=now,
            is_active=True,
        )
        db.add(db_user)
    else:
        db_user.last_login = now
        db_user.email_verified = True
        if name:
            db_user.name = name

    db.commit()
    db.refresh(db_user)
    return db_user


# ==================== ENDPOINTS ====================

@router.post("/google", response_model=AuthResponse)
async def google_auth(
    body: GoogleAuthRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Exchange a Google ID token for a Spendemic JWT."""
    token_info = await _verify_google_token(body.credential)
    db_user = _upsert_user(db, token_info)

    now = datetime.now(timezone.utc)
    access_token, jti, expires_at = _create_access_token(
        payload={"sub": str(db_user.id), "email": db_user.email}
    )
    _record_session(db, db_user.id, jti, now, expires_at, request)

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(db_user),
    )


@router.post("/register/request", response_model=OTPSentResponse, status_code=202)
async def register_request(body: RegisterRequest, db: Session = Depends(get_db)) -> OTPSentResponse:
    """
    Step 1 — validate signup details and send a 6-digit OTP to the email.
    The user is NOT created yet; creation happens after OTP verification.
    """
    # Check if email already taken
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in.",
        )

    # Generate OTP and store pending registration
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)

    with _otp_lock:
        _otp_store[body.email] = {
            "code": code,
            "expires_at": expires_at,
            "name": body.name,
            "password_hash": _hash_password(body.password),
        }

    # Send email — raises 503 if SMTP not configured
    try:
        _send_otp_email(body.email, body.name, code)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to send verification email: {exc}",
        )

    return OTPSentResponse(
        message=f"Verification code sent to {body.email}",
        expires_in_seconds=OTP_EXPIRE_MINUTES * 60,
    )


@router.post("/register/verify", response_model=AuthResponse, status_code=201)
async def register_verify(
    body: VerifyOTPRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """
    Step 2 — verify the OTP and create the user account.
    Issues a JWT on success so the user is immediately signed in.
    """
    with _otp_lock:
        pending = _otp_store.get(body.email)

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending registration found for this email. Please request a new code.",
        )

    if datetime.now(timezone.utc) > pending["expires_at"]:
        with _otp_lock:
            _otp_store.pop(body.email, None)
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Verification code has expired. Please sign up again.",
        )

    if body.otp_code != pending["code"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect verification code. Please try again.",
        )

    # OTP valid — create the user
    with _otp_lock:
        _otp_store.pop(body.email, None)

    # Guard against duplicate (race condition)
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    now = datetime.now(timezone.utc)
    new_user = User(
        email=body.email,
        name=pending["name"],
        password_hash=pending["password_hash"],
        email_verified=True,
        last_login=now,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token, jti, expires_at = _create_access_token(
        payload={"sub": str(new_user.id), "email": new_user.email}
    )
    _record_session(db, new_user.id, jti, now, expires_at, request)

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user),
    )


@router.post("/signin", response_model=AuthResponse)
async def signin(
    body: SignInRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Authenticate with email and password."""
    db_user: User | None = db.query(User).filter(User.email == body.email).first()

    if not db_user or not db_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not _verify_password(body.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is disabled. Please contact support.",
        )

    now = datetime.now(timezone.utc)
    db_user.last_login = now
    db.commit()
    db.refresh(db_user)

    access_token, jti, expires_at = _create_access_token(
        payload={"sub": str(db_user.id), "email": db_user.email}
    )
    _record_session(db, db_user.id, jti, now, expires_at, request)

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(db_user),
    )


@router.post("/logout", status_code=200)
async def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Revoke the current JWT so it cannot be reused after logout."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.split(" ", 1)[1] if " " in auth_header else ""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti: str = payload.get("jti", "")
        if jti:
            session = db.query(UserSession).filter(UserSession.jti == jti).first()
            if session:
                session.is_revoked = True
                session.revoked_at = datetime.now(timezone.utc)
                db.commit()
    except Exception:
        pass