import { useState, useRef, useEffect } from 'react';
import { User, MapPin, BookOpen, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = 'http://localhost:8000';

type Tab = 'profile' | 'address' | 'academic';

interface ProfileData {
  name: string;
  bio: string;
  phone_number: string;
  profile_picture_url: string;
  // address
  country: string;
  city: string;
  state_province: string;
  postal_code: string;
  // academic / financial
  university: string;
  timezone: string;
  home_currency: string;
  study_country_currency: string;
}

const EMPTY: ProfileData = {
  name: '', bio: '', phone_number: '', profile_picture_url: '',
  country: '', city: '', state_province: '', postal_code: '',
  university: '', timezone: 'UTC',
  home_currency: 'USD', study_country_currency: 'USD',
};

const CURRENCIES = [
  'USD','EUR','GBP','INR','CAD','AUD','JPY','CNY','SGD','AED',
  'MXN','BRL','KRW','THB','PHP','NGN','PKR','BDT','ZAR','TRY',
];

export default function Settings() {
  const { user, loginDirect } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [form, setForm] = useState<ProfileData>(EMPTY);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = user?.accessToken;

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token ?? ''}`,
  };

  // ── Load profile on mount ──────────────────────────────────────────────────

  useEffect(() => {
    if (!token) { setFetchLoading(false); return; }
    fetch(`${API_BASE}/api/v1/users/me`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        setForm({
          name: data.name ?? '',
          bio: data.bio ?? '',
          phone_number: data.phone_number ?? '',
          profile_picture_url: data.profile_picture_url ?? '',
          country: data.country ?? '',
          city: data.city ?? '',
          state_province: data.state_province ?? '',
          postal_code: data.postal_code ?? '',
          university: data.university ?? '',
          timezone: data.timezone ?? 'UTC',
          home_currency: data.home_currency ?? 'USD',
          study_country_currency: data.study_country_currency ?? 'USD',
        });
        if (data.profile_picture_url) setAvatarPreview(data.profile_picture_url);
      })
      .catch(() => {})
      .finally(() => setFetchLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const set = (field: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  // ── Avatar handling ────────────────────────────────────────────────────────

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('error', 'Image must be under 5 MB'); return; }
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/api/v1/users/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const newUrl = data.profile_picture_url ?? null;
      setForm(prev => ({ ...prev, profile_picture_url: newUrl ?? prev.profile_picture_url }));
      if (user) loginDirect({ ...user, picture: newUrl ?? user.picture });
      showToast('success', 'Photo updated!');
    } catch {
      showToast('error', 'Photo upload failed');
      setAvatarPreview(form.profile_picture_url || user?.picture || '');
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Save profile ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!token) { showToast('error', 'You must be signed in to save changes'); return; }
    setLoading(true);
    try {
      // Save profile fields (avatar is already uploaded on selection)
      const payload: Record<string, string> = {
        name: form.name,
        bio: form.bio,
        phone_number: form.phone_number,
        country: form.country,
        city: form.city,
        state_province: form.state_province,
        postal_code: form.postal_code,
        university: form.university,
        timezone: form.timezone,
        home_currency: form.home_currency,
        study_country_currency: form.study_country_currency,
      };
      // Remove empty strings so they don't overwrite existing data with nulls
      Object.keys(payload).forEach(k => { if (!payload[k]) delete payload[k]; });

      const res = await fetch(`${API_BASE}/api/v1/users/me`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail;
        const msg = typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((e: { msg: string }) => e.msg).join(', ')
            : 'Save failed';
        throw new Error(msg);
      }

      // 3. Update AuthContext so Sidebar name reflects changes
      if (user) {
        loginDirect({ ...user, name: data.name });
      }
      showToast('success', 'Profile saved successfully!');
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (fetchLoading) {
    return <div style={s.loadingWrap}><div style={s.spinner} /></div>;
  }

  if (!user) {
    return (
      <div style={s.loadingWrap}>
        <p style={{ color: 'var(--brand-rose)' }}>Please sign in to access your profile settings.</p>
      </div>
    );
  }

  const displayAvatar = avatarPreview || user.picture;

  return (
    <div style={s.page}>
      {/* Toast */}
      {toast && (
        <div style={{ ...s.toast, ...(toast.type === 'success' ? s.toastSuccess : s.toastError) }}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <h1 style={s.pageTitle}>Settings</h1>

      <div style={s.layout}>
        {/* ── Avatar card ── */}
        <div style={s.avatarCard}>
          <div style={s.avatarWrap}>
            {displayAvatar
              ? <img src={displayAvatar} alt="avatar" style={s.avatarImg} />
              : <div style={s.avatarFallback}>{(form.name || user.email)[0]?.toUpperCase()}</div>
            }
            <button style={s.cameraBtn} onClick={() => fileInputRef.current?.click()} title="Change photo">
              📷
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>
          <p style={s.avatarName}>{form.name || user.email}</p>
          <p style={s.avatarEmail}>{user.email}</p>
          <p style={s.avatarHint}>JPG, PNG, GIF or WebP · max 5 MB</p>
          {avatarUploading && <p style={s.avatarPending}>⬆ Uploading…</p>}
        </div>

        {/* ── Form panel ── */}
        <div style={s.formPanel}>
          {/* Tabs */}
          <div style={s.tabs}>
            {([
              { id: 'profile', label: 'Profile', Icon: User },
              { id: 'address', label: 'Address', Icon: MapPin },
              { id: 'academic', label: 'Academic', Icon: BookOpen },
            ] as { id: Tab; label: string; Icon: React.FC<{ size?: number }> }[]).map(({ id, label, Icon }) => (
              <button
                key={id}
                style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }}
                onClick={() => setTab(id)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          <div style={s.fields}>
            {/* ── Profile tab ── */}
            {tab === 'profile' && (
              <>
                <Field label="Full Name" required>
                  <input style={s.input} value={form.name} onChange={set('name')} placeholder="Your full name" />
                </Field>
                <Field label="Bio">
                  <textarea
                    style={{ ...s.input, ...s.textarea }}
                    value={form.bio}
                    onChange={set('bio')}
                    placeholder="A short bio about yourself…"
                    maxLength={500}
                    rows={3}
                  />
                  <span style={s.charCount}>{form.bio.length}/500</span>
                </Field>
                <Field label="Phone Number">
                  <input style={s.input} value={form.phone_number} onChange={set('phone_number')}
                    placeholder="+1 555 000 0000" type="tel" />
                </Field>
                <Field label="Timezone">
                  <select style={{ ...s.input, ...s.select }} value={form.timezone} onChange={set('timezone')}>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </Field>
              </>
            )}

            {/* ── Address tab ── */}
            {tab === 'address' && (
              <>
                <Field label="Country">
                  <input style={s.input} value={form.country} onChange={set('country')} placeholder="e.g. United States" />
                </Field>
                <div style={s.row}>
                  <Field label="City">
                    <input style={s.input} value={form.city} onChange={set('city')} placeholder="e.g. Fullerton" />
                  </Field>
                  <Field label="State / Province">
                    <input style={s.input} value={form.state_province} onChange={set('state_province')} placeholder="e.g. California" />
                  </Field>
                </div>
                <Field label="Postal Code">
                  <input style={s.input} value={form.postal_code} onChange={set('postal_code')} placeholder="e.g. 92831" />
                </Field>
              </>
            )}

            {/* ── Academic tab ── */}
            {tab === 'academic' && (
              <>
                <Field label="University">
                  <input style={s.input} value={form.university} onChange={set('university')}
                    placeholder="e.g. Cal State Fullerton" />
                </Field>
                <Field label="Home Currency" required>
                  <select style={{ ...s.input, ...s.select }} value={form.home_currency} onChange={set('home_currency')}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Working Currency (Country of Study)" required>
                  <select style={{ ...s.input, ...s.select }} value={form.study_country_currency} onChange={set('study_country_currency')}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <div style={s.infoBox}>
                  <p style={s.infoText}>
                    Home currency is used to show equivalent amounts from your home country.
                    Working currency is your primary currency for budgeting in your study country.
                  </p>
                </div>
              </>
            )}
          </div>

          <div style={s.saveRow}>
            <button style={{ ...s.saveBtn, opacity: loading ? 0.7 : 1 }} onClick={handleSave} disabled={loading}>
              <Save size={16} />
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helper component ─────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={s.label}>
        {label} {required && <span style={{ color: '#e74c3c' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Timezones list ─────────────────────────────────────────────────────────

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Toronto', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo',
  'Asia/Seoul', 'Asia/Singapore', 'Australia/Sydney', 'Pacific/Auckland',
];

// ── Styles ─────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '32px',
    maxWidth: '960px',
    margin: '0 auto',
    color: 'var(--text-light)',
  },
  pageTitle: {
    fontSize: '1.8em',
    fontWeight: 700,
    color: 'var(--brand-gold)',
    margin: '0 0 28px 0',
  },
  loadingWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '60vh',
  },
  spinner: {
    width: '36px', height: '36px', borderRadius: '50%',
    border: '3px solid var(--brand-maroon-light)',
    borderTopColor: 'var(--brand-gold)',
    animation: 'spin 0.8s linear infinite',
  },
  toast: {
    position: 'fixed', top: '20px', right: '24px', zIndex: 9999,
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 18px', borderRadius: '10px',
    fontSize: '0.9em', fontWeight: 500,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  },
  toastSuccess: { background: '#1a472a', border: '1px solid #2ecc71', color: '#2ecc71' },
  toastError: { background: '#4a1010', border: '1px solid #e74c3c', color: '#e74c3c' },
  layout: {
    display: 'flex', gap: '28px', alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
  },
  avatarCard: {
    background: 'linear-gradient(135deg, var(--brand-maroon) 0%, var(--brand-maroon-dark) 100%)',
    border: '1px solid var(--brand-maroon-light)',
    borderRadius: '16px', padding: '28px 24px',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    gap: '8px', minWidth: '200px', flexShrink: 0,
  },
  avatarWrap: { position: 'relative', width: '100px', height: '100px', marginBottom: '8px' },
  avatarImg: { width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand-gold)' },
  avatarFallback: {
    width: '100px', height: '100px', borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '2.5em', fontWeight: 700, color: 'var(--brand-maroon)',
    border: '3px solid var(--brand-gold)',
  },
  cameraBtn: {
    position: 'absolute', bottom: 2, right: 2,
    background: '#111827', border: '2px solid var(--brand-gold)',
    borderRadius: '50%', width: '32px', height: '32px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--brand-gold)',
    boxShadow: '0 2px 10px rgba(0,0,0,0.8)',
  },
  avatarName: { fontWeight: 700, fontSize: '1em', margin: 0, textAlign: 'center', color: 'var(--text-light)' },
  avatarEmail: { fontSize: '0.78em', color: 'var(--brand-rose)', margin: 0, textAlign: 'center', opacity: 0.8 },
  avatarHint: { fontSize: '0.72em', color: 'var(--brand-rose)', margin: '4px 0 0 0', opacity: 0.6, textAlign: 'center' },
  avatarPending: { fontSize: '0.75em', color: 'var(--brand-gold)', margin: 0, fontWeight: 600 },
  formPanel: {
    flex: 1, minWidth: '300px',
    background: 'linear-gradient(135deg, var(--brand-maroon) 0%, var(--brand-maroon-dark) 100%)',
    border: '1px solid var(--brand-maroon-light)',
    borderRadius: '16px', overflow: 'hidden',
  },
  tabs: { display: 'flex', borderBottom: '1px solid var(--brand-maroon-light)' },
  tab: {
    flex: 1, padding: '14px 8px', background: 'transparent',
    border: 'none', color: 'var(--brand-rose)', cursor: 'pointer',
    fontSize: '0.85em', fontWeight: 600, display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '6px',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: 'rgba(255,215,0,0.1)',
    color: 'var(--brand-gold)',
    borderBottom: '2px solid var(--brand-gold)',
  },
  fields: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' },
  label: { fontSize: '0.82em', fontWeight: 600, color: 'var(--brand-rose)', letterSpacing: '0.5px', textTransform: 'uppercase' },
  input: {
    width: '100%', padding: '11px 14px', borderRadius: '8px',
    border: '1px solid var(--brand-maroon-light)',
    background: 'rgba(0,0,0,0.25)', color: 'var(--text-light)',
    fontSize: '0.95em', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  },
  textarea: { resize: 'vertical', minHeight: '80px' },
  select: { cursor: 'pointer' },
  charCount: { fontSize: '0.73em', color: 'var(--brand-rose)', opacity: 0.6, textAlign: 'right' },
  row: { display: 'flex', gap: '14px' },
  infoBox: {
    background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.2)',
    borderRadius: '8px', padding: '14px',
  },
  infoText: { margin: 0, fontSize: '0.88em', color: 'var(--brand-rose)', lineHeight: 1.5 },
  saveRow: {
    padding: '16px 24px',
    borderTop: '1px solid var(--brand-maroon-light)',
    display: 'flex', justifyContent: 'flex-end',
  },
  saveBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '11px 28px',
    background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-dark) 100%)',
    color: 'var(--brand-maroon)', border: 'none', borderRadius: '8px',
    fontWeight: 700, fontSize: '0.95em', cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
};