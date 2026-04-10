import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import '../styles/onboarding.css';

const API = 'http://localhost:8000/api/v1';

interface OnboardingData {
  name: string;
  visa_type: string;
  max_work_hours_per_week: string;
  university: string;
  graduation_date: string;
  home_currency: string;
  study_country_currency: string;
  monthly_income: string;
  hourly_rate: string;
  scholarship_amount: string;
  scholarship_frequency: string;
  rent: string;
  food_estimate: string;
}

const EMPTY: OnboardingData = {
  name: '',
  visa_type: '',
  max_work_hours_per_week: '',
  university: '',
  graduation_date: '',
  home_currency: 'USD',
  study_country_currency: 'USD',
  monthly_income: '',
  hourly_rate: '',
  scholarship_amount: '',
  scholarship_frequency: 'NONE',
  rent: '',
  food_estimate: '',
};

const VISA_OPTIONS = ['F1', 'J1', 'M1', 'H1B', 'OPT', 'CPT', 'OTHER', 'NONE'];
const SCHOLARSHIP_FREQ = ['NONE', 'MONTHLY', 'SEMESTER', 'ANNUAL', 'ONE_TIME'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CNY', 'JPY', 'CAD', 'AUD', 'AED', 'KRW', 'SGD', 'BRL', 'MXN', 'PKR', 'BDT', 'NGN'];

const TOTAL_STEPS = 8;

export default function Onboarding() {
  const { user } = useContext(AuthContext)!;
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [data, setData] = useState<OnboardingData>({ ...EMPTY, name: user?.name || '' });
  const [saving, setSaving] = useState(false);

  const token = user?.accessToken ?? localStorage.getItem('spendemic_token') ?? '';
  const authHdr = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const set = (field: keyof OnboardingData, val: string) =>
    setData(d => ({ ...d, [field]: val }));

  const next = () => {
    setDirection('forward');
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const back = () => {
    setDirection('back');
    setStep(s => Math.max(s - 1, 0));
  };

  const skip = () => next();

  const finish = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      onboarding_completed: true,
    };
    if (data.name) payload.name = data.name;
    if (data.visa_type) payload.visa_type = data.visa_type;
    if (data.max_work_hours_per_week) payload.max_work_hours_per_week = parseInt(data.max_work_hours_per_week);
    if (data.university) payload.university = data.university;
    if (data.graduation_date) payload.graduation_date = data.graduation_date;
    if (data.home_currency) payload.home_currency = data.home_currency;
    if (data.study_country_currency) payload.study_country_currency = data.study_country_currency;
    if (data.monthly_income) payload.monthly_income = parseFloat(data.monthly_income);
    if (data.scholarship_amount) payload.scholarship_amount = parseFloat(data.scholarship_amount);
    if (data.scholarship_frequency) payload.scholarship_frequency = data.scholarship_frequency;

    await fetch(`${API}/users/me`, { method: 'PUT', headers: authHdr, body: JSON.stringify(payload) });

    if (data.rent || data.food_estimate || data.hourly_rate) {
      const today = new Date();
      const ctx: Record<string, unknown> = {};
      if (data.rent) ctx.rent = parseFloat(data.rent);
      if (data.food_estimate) ctx.food_estimate = parseFloat(data.food_estimate);
      if (data.hourly_rate) ctx.hourly_rate = parseFloat(data.hourly_rate);
      await fetch(`${API}/forecast-context/${today.getFullYear()}/${today.getMonth() + 1}`, {
        method: 'PUT', headers: authHdr, body: JSON.stringify(ctx),
      });
    }

    await fetch(`${API}/users/me/notification-preferences`, {
      method: 'PATCH', headers: authHdr,
      body: JSON.stringify({ sound_enabled: true, budget_alerts: true }),
    });

    setSaving(false);
    navigate('/dashboard');
  };

  const slideClass = direction === 'forward' ? 'onboarding-slide' : 'onboarding-slide-back';

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div key={step} className={slideClass}>
            <div className="onboarding-done-icon">👋</div>
            <div className="onboarding-step-label">Welcome to Spendemic</div>
            <div className="onboarding-title">Hi, {data.name || 'there'}!</div>
            <div className="onboarding-subtitle">
              Let's take two minutes to set up your financial profile. You can go back and change anything, and skip any step you're not sure about yet.
            </div>
            <div className="onboarding-field">
              <label>Your name</label>
              <input value={data.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
            </div>
          </div>
        );

      case 1:
        return (
          <div key={step} className={slideClass}>
            <div className="onboarding-step-label">Step 1 of 6</div>
            <div className="onboarding-title">Visa & Work</div>
            <div className="onboarding-subtitle">
              Your visa type determines how many hours you can work. F-1 students are limited to 20 hours/week on campus during the academic term.
            </div>
            <div className="onboarding-field">
              <label>Visa type</label>
              <select value={data.visa_type} onChange={e => set('visa_type', e.target.value)}>
                <option value="">Select visa type</option>
                {VISA_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="onboarding-field">
              <label>Max work hours per week</label>
              <input type="number" min="0" max="168" value={data.max_work_hours_per_week}
                onChange={e => set('max_work_hours_per_week', e.target.value)}
                placeholder={data.visa_type === 'F1' ? '20 (F-1 limit)' : 'e.g. 20'} />
            </div>
          </div>
        );

      case 2:
        return (
          <div key={step} className={slideClass}>
            <div className="onboarding-step-label">Step 2 of 6</div>
            <div className="onboarding-title">University & Graduation</div>
            <div className="onboarding-subtitle">
              Your graduation date helps us set the forecast horizon and plan for end-of-program transitions.
            </div>
            <div className="onboarding-field">
              <label>University</label>
              <input value={data.university} onChange={e => set('university', e.target.value)} placeholder="e.g. California State University, Fullerton" />
            </div>
            <div className="onboarding-field">
              <label>Expected graduation date</label>
              <input type="date" value={data.graduation_date} onChange={e => set('graduation_date', e.target.value)} />
            </div>
          </div>
        );

      case 3:
        return (
          <div key={step} className={slideClass}>
            <div className="onboarding-step-label">Step 3 of 6</div>
            <div className="onboarding-title">Currencies</div>
            <div className="onboarding-subtitle">
              Set your home currency (where your family sends money from) and your study country currency (what you spend in day to day).
            </div>
            <div className="onboarding-field">
              <div className="field-row">
                <div>
                  <label>Home currency</label>
                  <select value={data.home_currency} onChange={e => set('home_currency', e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label>Study country currency</label>
                  <select value={data.study_country_currency} onChange={e => set('study_country_currency', e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div key={step} className={slideClass}>
            <div className="onboarding-step-label">Step 4 of 6</div>
            <div className="onboarding-title">Income</div>
            <div className="onboarding-subtitle">
              Enter your regular income. If you work by the hour, enter your hourly rate — we'll calculate your monthly income automatically.
            </div>
            <div className="onboarding-field">
              <label>Monthly income (USD) — leave blank if hourly</label>
              <input type="number" min="0" value={data.monthly_income}
                onChange={e => set('monthly_income', e.target.value)} placeholder="e.g. 800" />
            </div>
            <div className="onboarding-field">
              <label>Hourly rate ($/hr) — optional</label>
              <input type="number" min="0" value={data.hourly_rate}
                onChange={e => set('hourly_rate', e.target.value)} placeholder="e.g. 15" />
            </div>
          </div>
        );

      case 5:
        return (
          <div key={step} className={slideClass}>
            <div className="onboarding-step-label">Step 5 of 6</div>
            <div className="onboarding-title">Scholarship</div>
            <div className="onboarding-subtitle">
              If you receive a scholarship or financial aid, enter the amount and how often. This helps us account for it in your forecast.
            </div>
            <div className="onboarding-field">
              <label>Scholarship amount ($)</label>
              <input type="number" min="0" value={data.scholarship_amount}
                onChange={e => set('scholarship_amount', e.target.value)} placeholder="e.g. 5000" />
            </div>
            <div className="onboarding-field">
              <label>Frequency</label>
              <select value={data.scholarship_frequency} onChange={e => set('scholarship_frequency', e.target.value)}>
                {SCHOLARSHIP_FREQ.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        );

      case 6:
        return (
          <div key={step} className={slideClass}>
            <div className="onboarding-step-label">Step 6 of 6</div>
            <div className="onboarding-title">Monthly Costs</div>
            <div className="onboarding-subtitle">
              Your rent and food estimate are the most important inputs for an accurate forecast. Even rough numbers help.
            </div>
            <div className="onboarding-field">
              <label>Monthly rent ($/month)</label>
              <input type="number" min="0" value={data.rent}
                onChange={e => set('rent', e.target.value)} placeholder="e.g. 900" />
            </div>
            <div className="onboarding-field">
              <label>Monthly food estimate ($/month)</label>
              <input type="number" min="0" value={data.food_estimate}
                onChange={e => set('food_estimate', e.target.value)} placeholder="e.g. 300" />
            </div>
          </div>
        );

      case 7:
        return (
          <div key={step} className={slideClass}>
            <div className="onboarding-done-icon"></div>
            <div className="onboarding-title">You're all set!</div>
            <div className="onboarding-subtitle">
              Your profile is ready. You can update any of these details at any time in the Settings page. Let's start tracking your finances.
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding-root">
      <div className="onboarding-card">
        <div className="onboarding-progress-dots">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`onboarding-dot${i === step ? ' active' : i < step ? ' done' : ''}`}
            />
          ))}
        </div>

        {renderStep()}

        <div className="onboarding-actions">
          {step > 0 ? (
            <button className="onboarding-btn-back" onClick={back}>← Back</button>
          ) : (
            <span />
          )}

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {step < TOTAL_STEPS - 1 && step > 0 && (
              <button className="onboarding-btn-skip" onClick={skip}>Skip</button>
            )}
            {step < TOTAL_STEPS - 1 ? (
              <button className="onboarding-btn-next" onClick={next}>Next →</button>
            ) : (
              <button className="onboarding-btn-next" onClick={finish} disabled={saving}>
                {saving ? 'Saving...' : 'Go to Dashboard →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
