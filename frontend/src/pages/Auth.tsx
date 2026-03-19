import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
    <div style={s.container}>
      <button style={s.backButton} onClick={() => navigate('/')}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(107,26,42,0.15)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
        <ArrowLeft size={18} /> Back to Home
      </button>

      <div style={s.card} className="fade-in">
        <Link to="/" style={s.title}>Spendemic</Link>

        {/* ── OTP step ── */}
        {mode === 'signup' && step === 'otp' ? (
          <>
            <div style={s.otpHeader}>
              <ShieldCheck size={40} color="var(--brand-gold)" />
              <p style={s.subtitle}>Check your email</p>
              <p style={s.otpHint}>{successMsg}</p>
            </div>

            <form onSubmit={handleVerifyOTP} style={s.form}>
              <div style={s.inputGroup}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ ...s.otpInput, ...(errors.otp ? s.inputError : {}) }}
                  autoFocus
                />
              </div>
              {errors.otp && <p style={s.errorText}>{errors.otp}</p>}

              <div style={s.timerRow}>
                <span style={{ color: remaining > 0 ? 'var(--brand-gold)' : '#e74c3c' }}>
                  {remaining > 0 ? `Expires in ${formatted}` : 'Code expired'}
                </span>
                <button
                  type="button"
                  style={{ ...s.resendBtn, opacity: remaining > 0 ? 0.4 : 1, cursor: remaining > 0 ? 'not-allowed' : 'pointer' }}
                  onClick={handleResendOTP}
                  disabled={remaining > 0 || loading}
                >
                  Resend code
                </button>
              </div>

              <button type="submit" style={s.submitButton} disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & Create Account'}
              </button>

              <button type="button" style={s.ghostBtn}
                onClick={() => { setStep('form'); setErrors({}); setOtpCode(''); setSuccessMsg(''); }}>
                ← Back to sign up
              </button>
            </form>
          </>
        ) : (
          <>
            <p style={s.subtitle}>
              {mode === 'signin' ? 'Welcome back!' : 'Create your free account'}
            </p>

            {/* Tabs */}
            <div style={s.tabs}>
              {(['signin', 'signup'] as Mode[]).map(m => (
                <button key={m} style={{ ...s.tab, ...(mode === m ? s.tabActive : {}) }}
                  onClick={() => switchMode(m)}>
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {/* General error */}
            {errors.general && <div style={s.alertError}>{errors.general}</div>}

            <form onSubmit={mode === 'signin' ? handleSignIn : handleSignupRequest} style={s.form}>
              {/* Name — signup only */}
              {mode === 'signup' && (
                <div>
                  <div style={{ ...s.inputGroup, ...(errors.name ? s.inputGroupError : {}) }}>
                    <User size={18} style={s.inputIcon} />
                    <input type="text" placeholder="Full Name" value={name}
                      onChange={e => setName(e.target.value)}
                      style={s.input} autoComplete="name" />
                  </div>
                  {errors.name && <p style={s.errorText}>{errors.name}</p>}
                </div>
              )}

              {/* Email */}
              <div>
                <div style={{ ...s.inputGroup, ...(errors.email ? s.inputGroupError : {}) }}>
                  <Mail size={18} style={s.inputIcon} />
                  <input type="email" placeholder="Email Address" value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={s.input} autoComplete="email" />
                </div>
                {errors.email && <p style={s.errorText}>{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <div style={{ ...s.inputGroup, ...(errors.password ? s.inputGroupError : {}) }}>
                  <Lock size={18} style={s.inputIcon} />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ ...s.input, paddingRight: '44px' }}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
                  <button type="button" style={s.eyeBtn} onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p style={s.errorText}>{errors.password}</p>}

                {/* Password strength meter — signup only */}
                {mode === 'signup' && password.length > 0 && (
                  <div style={s.strengthWrap}>
                    <div style={s.strengthBar}>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{
                          ...s.strengthSegment,
                          background: i <= pwStrength.score - 1 && pwStrength.score > 0
                            ? pwStrength.color : 'rgba(255,255,255,0.1)',
                        }} />
                      ))}
                    </div>
                    <span style={{ ...s.strengthLabel, color: pwStrength.color }}>
                      {pwStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm password — signup only */}
              {mode === 'signup' && (
                <div>
                  <div style={{ ...s.inputGroup, ...(errors.confirmPassword ? s.inputGroupError : {}) }}>
                    <Lock size={18} style={s.inputIcon} />
                    <input type={showConfirm ? 'text' : 'password'} placeholder="Confirm Password"
                      value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      style={{ ...s.input, paddingRight: '44px' }} autoComplete="new-password" />
                    <button type="button" style={s.eyeBtn} onClick={() => setShowConfirm(v => !v)}
                      tabIndex={-1}>
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p style={s.errorText}>{errors.confirmPassword}</p>}
                </div>
              )}

              {/* Forgot password — signin only */}
              {mode === 'signin' && (
                <div style={{ textAlign: 'right', marginTop: '-8px' }}>
                  <span style={s.switchLink}>Forgot password?</span>
                </div>
              )}

              <button type="submit" style={s.submitButton} disabled={loading}>
                {loading
                  ? (mode === 'signin' ? 'Signing in…' : 'Sending code…')
                  : (mode === 'signin' ? 'Sign In' : 'Send Verification Code')}
              </button>
            </form>

            <div style={s.divider}>
              <span style={s.dividerLine} />
              <span style={s.dividerText}>or</span>
              <span style={s.dividerLine} />
            </div>

            <div style={s.googleWrapper}>
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => {}}
                theme="filled_black" size="large" width="320"
                text={mode === 'signin' ? 'signin_with' : 'signup_with'} shape="rectangular" />
            </div>

            <p style={s.switchText}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <span style={s.switchLink} onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '100%', padding: '40px 20px',
    position: 'relative',
  },
  backButton: {
    position: 'absolute', top: '20px', left: '20px',
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'transparent', color: 'var(--brand-gold)',
    border: '1px solid var(--brand-gold)', padding: '8px 16px',
    borderRadius: '8px', cursor: 'pointer', fontSize: '0.9em',
    transition: 'all 0.3s ease',
  },
  card: {
    background: 'linear-gradient(135deg, var(--brand-maroon) 0%, var(--brand-maroon-dark) 100%)',
    borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '420px',
    border: '1px solid var(--brand-maroon-light)',
    boxShadow: '0 15px 50px rgba(0,0,0,0.5), 0 0 30px rgba(255,215,0,0.1)',
  },
  title: {
    fontSize: '2.5em',
    background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
    margin: '0 0 5px 0', fontWeight: 800, textAlign: 'center', display: 'block',
    textDecoration: 'none',
  },
  subtitle: {
    color: 'var(--brand-rose)', textAlign: 'center',
    margin: '0 0 20px 0', fontSize: '1.1em', opacity: 0.9,
  },
  otpHeader: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '20px',
  },
  otpHint: {
    color: 'var(--brand-rose)', fontSize: '0.85em', textAlign: 'center',
    opacity: 0.8, margin: 0,
  },
  tabs: {
    display: 'flex', marginBottom: '20px', borderRadius: '10px',
    overflow: 'hidden', border: '1px solid var(--brand-maroon-light)',
  },
  tab: {
    flex: 1, padding: '12px', background: 'transparent', color: 'var(--brand-rose)',
    border: 'none', cursor: 'pointer', fontSize: '1em', fontWeight: 600,
    transition: 'all 0.3s ease',
  },
  tabActive: {
    background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    color: 'var(--brand-maroon)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  inputGroup: {
    position: 'relative', display: 'flex', alignItems: 'center',
    border: '1px solid var(--brand-maroon-light)', borderRadius: '10px',
    transition: 'border-color 0.3s ease',
  },
  inputGroupError: { borderColor: '#e74c3c' },
  inputIcon: { position: 'absolute', left: '14px', color: 'var(--brand-gold)', pointerEvents: 'none' },
  input: {
    width: '100%', padding: '14px 14px 14px 44px', borderRadius: '10px',
    border: 'none', background: 'rgba(0,0,0,0.3)', color: 'var(--text-light)',
    fontSize: '1em', fontFamily: 'inherit', outline: 'none',
  },
  eyeBtn: {
    position: 'absolute', right: '12px', background: 'transparent',
    border: 'none', color: 'var(--brand-gold)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', padding: '4px',
  },
  errorText: { color: '#e74c3c', fontSize: '0.8em', margin: '4px 0 0 4px' },
  alertError: {
    background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.4)',
    borderRadius: '8px', padding: '10px 14px', color: '#e74c3c', fontSize: '0.9em',
  },
  strengthWrap: {
    display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', paddingLeft: '4px',
  },
  strengthBar: { display: 'flex', gap: '4px', flex: 1 },
  strengthSegment: { flex: 1, height: '4px', borderRadius: '2px', transition: 'background 0.3s ease' },
  strengthLabel: { fontSize: '0.78em', fontWeight: 600, minWidth: '40px' },
  timerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: '0.85em',
  },
  resendBtn: {
    background: 'transparent', border: 'none', color: 'var(--brand-gold)',
    fontWeight: 600, fontSize: '0.85em', textDecoration: 'underline',
  },
  otpInput: {
    width: '100%', padding: '18px', textAlign: 'center' as const,
    fontSize: '2em', fontWeight: 700, letterSpacing: '12px',
    borderRadius: '10px', border: '2px solid var(--brand-maroon-light)',
    background: 'rgba(0,0,0,0.3)', color: 'var(--brand-gold)',
    fontFamily: 'monospace', outline: 'none',
  },
  inputError: { borderColor: '#e74c3c' },
  submitButton: {
    padding: '14px',
    background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    color: 'var(--brand-maroon)', border: 'none', borderRadius: '10px',
    fontSize: '1.05em', fontWeight: 700, cursor: 'pointer', marginTop: '4px',
    opacity: 1, transition: 'opacity 0.2s',
  },
  ghostBtn: {
    background: 'transparent', border: 'none', color: 'var(--brand-rose)',
    fontSize: '0.9em', cursor: 'pointer', textAlign: 'center' as const, padding: '4px',
  },
  divider: { display: 'flex', alignItems: 'center', gap: '15px', margin: '20px 0' },
  dividerLine: { flex: 1, height: '1px', background: 'var(--brand-maroon-light)' },
  dividerText: { color: 'var(--brand-rose)', fontSize: '0.9em', opacity: 0.7 },
  googleWrapper: { display: 'flex', justifyContent: 'center', marginBottom: '20px' },
  switchText: { textAlign: 'center' as const, color: 'var(--brand-rose)', fontSize: '0.9em', margin: 0 },
  switchLink: { color: 'var(--brand-gold)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' },
};