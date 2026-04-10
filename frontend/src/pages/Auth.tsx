import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/auth.css';

const API_BASE = 'http://localhost:8000';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'signin' | 'signup';
type Step = 'form' | 'otp';

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  otp?: string;
  general?: string;
}

interface PasswordStrength {
  score: 0 | 1 | 2 | 3;   // 0=weak 1=fair 2=good 3=strong
  label: string;
  color: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPasswordStrength(pw: string): PasswordStrength {
  if (pw.length === 0) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 0, label: 'Weak', color: '#e74c3c' };
  if (score === 2) return { score: 1, label: 'Fair', color: '#e67e22' };
  if (score === 3) return { score: 2, label: 'Good', color: '#f1c40f' };
  return { score: 3, label: 'Strong', color: '#2ecc71' };
}

function validateSignupForm(
  name: string, email: string, password: string, confirmPassword: string
): FormErrors {
  const errors: FormErrors = {};
  if (!name.trim()) errors.name = 'Full name is required';
  else if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';

  if (!email) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';

  if (!password) errors.password = 'Password is required';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (!/[A-Z]/.test(password)) errors.password = 'Add at least one uppercase letter';
  else if (!/\d/.test(password)) errors.password = 'Add at least one number';
  else if (!/[^A-Za-z0-9]/.test(password)) errors.password = 'Add at least one special character (!@#$…)';

  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password';
  else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';

  return errors;
}

function validateSigninForm(email: string, password: string): FormErrors {
  const errors: FormErrors = {};
  if (!email) errors.email = 'Email is required';
  if (!password) errors.password = 'Password is required';
  return errors;
}

// ─── OTP Countdown ────────────────────────────────────────────────────────────

function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback((from = seconds) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRemaining(from);
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [seconds]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return { remaining, formatted: `${mm}:${ss}`, start };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Auth() {
  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<Step>('form');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const navigate = useNavigate();
  const { login, loginDirect } = useAuth();
  const { remaining, formatted, start: startCountdown } = useCountdown(300);
  const pwStrength = getPasswordStrength(password);

  // Reset state when switching modes
  const switchMode = (m: Mode) => {
    setMode(m);
    setStep('form');
    setErrors({});
    setSuccessMsg('');
    setName(''); setEmail(''); setPassword(''); setConfirmPassword(''); setOtpCode('');
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────

  const handleGoogleSuccess = async (response: CredentialResponse): Promise<void> => {
    if (response.credential) {
      await login(response.credential);
      navigate('/dashboard');
    }
  };

  // ── Sign In ───────────────────────────────────────────────────────────────

  const handleSignIn = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const errs = validateSigninForm(email, password);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Sign in failed');
      loginDirect({ sub: data.user.id, email: data.user.email, name: data.user.name, picture: '', accessToken: data.access_token });
      navigate('/dashboard');
    } catch (err: unknown) {
      setErrors({ general: err instanceof Error ? err.message : 'Sign in failed' });
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up: Step 1 ───────────────────────────────────────────────────────

  const handleSignupRequest = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const errs = validateSignupForm(name, email, password, confirmPassword);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Could not send verification email');
      setStep('otp');
      setSuccessMsg(`A 6-digit code was sent to ${email}`);
      startCountdown(300);
    } catch (err: unknown) {
      setErrors({ general: err instanceof Error ? err.message : 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up: Step 2 (OTP) ─────────────────────────────────────────────────

  const handleVerifyOTP = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (otpCode.length !== 6) { setErrors({ otp: 'Enter the 6-digit code' }); return; }
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp_code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Verification failed');
      loginDirect({ sub: data.user.id, email: data.user.email, name: data.user.name, picture: '', accessToken: data.access_token });
      navigate('/dashboard');
    } catch (err: unknown) {
      setErrors({ otp: err instanceof Error ? err.message : 'Verification failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (remaining > 0) return;
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Could not resend code');
      setOtpCode('');
      setSuccessMsg('A new code was sent to your email');
      startCountdown(300);
    } catch (err: unknown) {
      setErrors({ general: err instanceof Error ? err.message : 'Resend failed' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="auth-container">
      <button className="auth-back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={18} /> Back to Home
      </button>

      <div className="auth-card fade-in">
        <Link to="/" className="auth-title">Spendemic</Link>

        {mode === 'signup' && step === 'otp' ? (
          <>
            <div className="auth-otp-header">
              <ShieldCheck size={40} color="var(--brand-gold)" />
              <p className="auth-subtitle">Check your email</p>
              <p className="auth-otp-hint">{successMsg}</p>
            </div>

            <form onSubmit={handleVerifyOTP} className="auth-form">
              <div className="auth-input-group">
                <input
                  type="text" inputMode="numeric" maxLength={6} placeholder="000000"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`auth-otp-input${errors.otp ? ' has-error' : ''}`}
                  autoFocus
                />
              </div>
              {errors.otp && <p className="auth-error-text">{errors.otp}</p>}

              <div className="auth-timer-row">
                <span style={{ color: remaining > 0 ? 'var(--brand-gold)' : '#e74c3c' }}>
                  {remaining > 0 ? `Expires in ${formatted}` : 'Code expired'}
                </span>
                <button type="button" className="auth-resend-btn"
                  style={{ opacity: remaining > 0 ? 0.4 : 1, cursor: remaining > 0 ? 'not-allowed' : 'pointer' }}
                  onClick={handleResendOTP} disabled={remaining > 0 || loading}>
                  Resend code
                </button>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & Create Account'}
              </button>

              <button type="button" className="auth-ghost-btn"
                onClick={() => { setStep('form'); setErrors({}); setOtpCode(''); setSuccessMsg(''); }}>
                ← Back to sign up
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="auth-subtitle">
              {mode === 'signin' ? 'Welcome back!' : 'Create your free account'}
            </p>

            <div className="auth-tabs">
              {(['signin', 'signup'] as Mode[]).map(m => (
                <button key={m} className={`auth-tab${mode === m ? ' active' : ''}`}
                  onClick={() => switchMode(m)}>
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {errors.general && <div className="auth-alert-error">{errors.general}</div>}

            <form onSubmit={mode === 'signin' ? handleSignIn : handleSignupRequest} className="auth-form">
              {mode === 'signup' && (
                <div>
                  <div className={`auth-input-group${errors.name ? ' has-error' : ''}`}>
                    <span className="auth-input-icon"><User size={18} /></span>
                    <input type="text" placeholder="Full Name" value={name}
                      onChange={e => setName(e.target.value)}
                      className="auth-input" autoComplete="name" />
                  </div>
                  {errors.name && <p className="auth-error-text">{errors.name}</p>}
                </div>
              )}

              <div>
                <div className={`auth-input-group${errors.email ? ' has-error' : ''}`}>
                  <span className="auth-input-icon"><Mail size={18} /></span>
                  <input type="email" placeholder="Email Address" value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="auth-input" autoComplete="email" />
                </div>
                {errors.email && <p className="auth-error-text">{errors.email}</p>}
              </div>

              <div>
                <div className={`auth-input-group${errors.password ? ' has-error' : ''}`}>
                  <span className="auth-input-icon"><Lock size={18} /></span>
                  <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="auth-input" style={{ paddingRight: '44px' }}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="auth-error-text">{errors.password}</p>}

                {mode === 'signup' && password.length > 0 && (
                  <div className="auth-strength-wrap">
                    <div className="auth-strength-bar">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="auth-strength-segment" style={{
                          background: i <= pwStrength.score - 1 && pwStrength.score > 0
                            ? pwStrength.color : 'rgba(255,255,255,0.1)',
                        }} />
                      ))}
                    </div>
                    <span className="auth-strength-label" style={{ color: pwStrength.color }}>
                      {pwStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {mode === 'signup' && (
                <div>
                  <div className={`auth-input-group${errors.confirmPassword ? ' has-error' : ''}`}>
                    <span className="auth-input-icon"><Lock size={18} /></span>
                    <input type={showConfirm ? 'text' : 'password'} placeholder="Confirm Password"
                      value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className="auth-input" style={{ paddingRight: '44px' }} autoComplete="new-password" />
                    <button type="button" className="auth-eye-btn" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="auth-error-text">{errors.confirmPassword}</p>}
                </div>
              )}

              {mode === 'signin' && (
                <div style={{ textAlign: 'right', marginTop: '-8px' }}>
                  <button type="button" className="auth-switch-link">Forgot password?</button>
                </div>
              )}

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading
                  ? (mode === 'signin' ? 'Signing in…' : 'Sending code…')
                  : (mode === 'signin' ? 'Sign In' : 'Send Verification Code')}
              </button>
            </form>

            <div className="auth-divider">
              <span className="auth-divider-line" />
              <span className="auth-divider-text">or</span>
              <span className="auth-divider-line" />
            </div>

            <div className="auth-google-wrapper">
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => {}}
                theme="filled_black" size="large" width="320"
                text={mode === 'signin' ? 'signin_with' : 'signup_with'} shape="rectangular" />
            </div>

            <p className="auth-switch-text">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button className="auth-switch-link" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

