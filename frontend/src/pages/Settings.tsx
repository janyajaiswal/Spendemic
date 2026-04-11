import { useState, useRef, useEffect } from 'react';
import { User, MapPin, BookOpen, Save, CheckCircle, AlertCircle, Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/settings.css';

const API_BASE = 'http://localhost:8000';

type Tab = 'profile' | 'address' | 'academic' | 'jobs';

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
  graduation_date: string;
  monthly_income: string;
  scholarship_amount: string;
  scholarship_frequency: string;
  visa_type: string;
  max_work_hours_per_week: string;
  summer_break_start: string;
  summer_break_end: string;
  winter_break_start: string;
  winter_break_end: string;
}

const EMPTY: ProfileData = {
  name: '', bio: '', phone_number: '', profile_picture_url: '',
  country: '', city: '', state_province: '', postal_code: '',
  university: '', timezone: 'UTC',
  home_currency: 'USD', study_country_currency: 'USD',
  graduation_date: '', monthly_income: '',
  scholarship_amount: '', scholarship_frequency: 'NONE',
  visa_type: 'NONE', max_work_hours_per_week: '',
  summer_break_start: '', summer_break_end: '',
  winter_break_start: '', winter_break_end: '',
};

const CURRENCIES = [
  'USD','EUR','GBP','INR','CAD','AUD','JPY','CNY','SGD','AED',
  'MXN','BRL','KRW','THB','PHP','NGN','PKR','BDT','ZAR','TRY',
];

interface Job {
  id: string;
  job_name: string;
  employer: string | null;
  hourly_rate: string;
  hours_per_week: string;
  job_type: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  monthly_income: number;
}

interface JobForm {
  job_name: string;
  employer: string;
  hourly_rate: string;
  hours_per_week: string;
  job_type: string;
  start_date: string;
  end_date: string;
}

const EMPTY_JOB_FORM: JobForm = {
  job_name: '', employer: '', hourly_rate: '', hours_per_week: '',
  job_type: 'ON_CAMPUS', start_date: '', end_date: '',
};

const JOB_TYPES: Record<string, string> = {
  ON_CAMPUS: 'On-Campus', INTERNSHIP: 'Internship', CO_OP: 'Co-op',
  FREELANCE: 'Freelance', OTHER: 'Other',
};

interface HoursEntry {
  id: string;
  job_id: string;
  week_start_date: string;
  hours_worked: number;
  weekly_pay: number;
}

function getMondayOfCurrentWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

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

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [editJobId, setEditJobId] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<JobForm>(EMPTY_JOB_FORM);
  const [jobSaving, setJobSaving] = useState(false);
  const [jobError, setJobError] = useState('');

  // Weekly hours log state
  const [hoursModalJobId, setHoursModalJobId] = useState<string | null>(null);
  const [hoursModalJobName, setHoursModalJobName] = useState('');
  const [hoursWeekStart, setHoursWeekStart] = useState(getMondayOfCurrentWeek());
  const [hoursWorked, setHoursWorked] = useState('');
  const [hoursSaving, setHoursSaving] = useState(false);
  const [jobHoursMap, setJobHoursMap] = useState<Record<string, HoursEntry[]>>({});

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
          graduation_date: data.graduation_date ?? '',
          monthly_income: data.monthly_income != null ? String(data.monthly_income) : '',
          scholarship_amount: data.scholarship_amount != null ? String(data.scholarship_amount) : '',
          scholarship_frequency: data.scholarship_frequency ?? 'NONE',
          visa_type: data.visa_type ?? 'NONE',
          max_work_hours_per_week: data.max_work_hours_per_week != null ? String(data.max_work_hours_per_week) : '',
          summer_break_start: data.summer_break_start ?? '',
          summer_break_end: data.summer_break_end ?? '',
          winter_break_start: data.winter_break_start ?? '',
          winter_break_end: data.winter_break_end ?? '',
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
    // Graduation date is required on the Academic tab
    if (tab === 'academic' && !form.graduation_date) {
      showToast('error', 'Expected graduation date is required for forecasting accuracy.');
      return;
    }
    setLoading(true);
    try {
      // Save profile fields (avatar is already uploaded on selection)
      const payload: Record<string, unknown> = {
        name: form.name,
        bio: form.bio || undefined,
        phone_number: form.phone_number || undefined,
        country: form.country || undefined,
        city: form.city || undefined,
        state_province: form.state_province || undefined,
        postal_code: form.postal_code || undefined,
        university: form.university || undefined,
        timezone: form.timezone,
        home_currency: form.home_currency,
        study_country_currency: form.study_country_currency,
        graduation_date: form.graduation_date || undefined,
        monthly_income: form.monthly_income ? parseFloat(form.monthly_income) : undefined,
        summer_break_start: form.summer_break_start || undefined,
        summer_break_end: form.summer_break_end || undefined,
        winter_break_start: form.winter_break_start || undefined,
        winter_break_end: form.winter_break_end || undefined,
        scholarship_amount: form.scholarship_amount ? parseFloat(form.scholarship_amount) : undefined,
        scholarship_frequency: form.scholarship_frequency !== 'NONE' ? form.scholarship_frequency : undefined,
        visa_type: form.visa_type !== 'NONE' ? form.visa_type : undefined,
        max_work_hours_per_week: form.max_work_hours_per_week ? parseInt(form.max_work_hours_per_week) : undefined,
      };
      // Remove undefined keys
      Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

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

  // ── Jobs ───────────────────────────────────────────────────────────────────

  const loadJobs = async () => {
    setJobsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/jobs`, { headers: authHeaders });
      if (res.ok) setJobs(await res.json());
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => { if (tab === 'jobs') loadJobs(); }, [tab]);

  const openAddJob = () => {
    setJobForm(EMPTY_JOB_FORM); setEditJobId(null); setJobError(''); setShowJobModal(true);
  };

  const openEditJob = (j: Job) => {
    setJobForm({
      job_name: j.job_name, employer: j.employer ?? '',
      hourly_rate: j.hourly_rate, hours_per_week: j.hours_per_week,
      job_type: j.job_type, start_date: j.start_date ?? '', end_date: j.end_date ?? '',
    });
    setEditJobId(j.id); setJobError(''); setShowJobModal(true);
  };

  const handleSaveJob = async () => {
    if (!jobForm.job_name || !jobForm.hourly_rate || !jobForm.hours_per_week) {
      setJobError('Job name, hourly rate, and hours/week are required'); return;
    }
    setJobSaving(true); setJobError('');
    const payload: Record<string, unknown> = {
      job_name: jobForm.job_name,
      employer: jobForm.employer || null,
      hourly_rate: parseFloat(jobForm.hourly_rate),
      hours_per_week: parseFloat(jobForm.hours_per_week),
      job_type: jobForm.job_type,
      start_date: jobForm.start_date || null,
      end_date: jobForm.end_date || null,
    };
    const url = editJobId ? `${API_BASE}/api/v1/jobs/${editJobId}` : `${API_BASE}/api/v1/jobs`;
    const method = editJobId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(payload) });
    if (!res.ok) {
      const d = await res.json();
      setJobError(typeof d.detail === 'string' ? d.detail : 'Save failed');
      setJobSaving(false); return;
    }
    setShowJobModal(false); loadJobs();
    setJobSaving(false);
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm('Remove this job?')) return;
    await fetch(`${API_BASE}/api/v1/jobs/${id}`, { method: 'DELETE', headers: authHeaders });
    loadJobs();
  };

  const openHoursModal = async (j: Job) => {
    setHoursModalJobId(j.id);
    setHoursModalJobName(j.job_name);
    setHoursWeekStart(getMondayOfCurrentWeek());
    setHoursWorked('');
    if (!jobHoursMap[j.id]) {
      try {
        const res = await fetch(`${API_BASE}/api/v1/jobs/${j.id}/hours`, { headers: authHeaders });
        if (res.ok) {
          const data = await res.json() as HoursEntry[];
          setJobHoursMap(prev => ({ ...prev, [j.id]: data }));
        }
      } catch { /* ignore */ }
    }
  };

  const closeHoursModal = () => {
    setHoursModalJobId(null);
    setHoursWorked('');
  };

  const handleSaveHours = async () => {
    if (!hoursModalJobId || !hoursWorked) return;
    setHoursSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/jobs/${hoursModalJobId}/hours`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ week_start_date: hoursWeekStart, hours_worked: parseFloat(hoursWorked) }),
      });
      if (res.ok) {
        const entry = await res.json() as HoursEntry;
        setJobHoursMap(prev => {
          const existing = (prev[hoursModalJobId] || []).filter(e => e.week_start_date !== entry.week_start_date);
          return { ...prev, [hoursModalJobId]: [entry, ...existing].slice(0, 12) };
        });
        setHoursWorked('');
        showToast('success', 'Hours logged!');
      }
    } finally {
      setHoursSaving(false);
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
              +
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
          {avatarUploading && <p style={s.avatarPending}>Uploading…</p>}
        </div>

        {/* ── Form panel ── */}
        <div style={s.formPanel}>
          {/* Tabs */}
          <div style={s.tabs}>
            {([
              { id: 'profile', label: 'Profile', Icon: User },
              { id: 'address', label: 'Address', Icon: MapPin },
              { id: 'academic', label: 'Academic', Icon: BookOpen },
              { id: 'jobs', label: 'Jobs', Icon: Briefcase },
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

            {/* ── Jobs tab ── */}
            {tab === 'jobs' && (
              <div>
                {/* Hours log modal */}
                {hoursModalJobId && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
                    <div style={{ background: 'var(--bg-secondary, #1e1a2e)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '24px', width: '340px', maxWidth: '92vw' }}>
                      <h3 style={{ margin: '0 0 16px', color: 'var(--brand-gold)', fontSize: '1em' }}>Log Hours — {hoursModalJobName}</h3>
                      <Field label="Week starting (Monday)">
                        <input style={s.input} type="date" value={hoursWeekStart} onChange={e => setHoursWeekStart(e.target.value)} />
                      </Field>
                      <Field label="Hours worked this week">
                        <input style={s.input} type="number" min="0" max="168" step="0.5" value={hoursWorked}
                          onChange={e => setHoursWorked(e.target.value)} placeholder="e.g. 20" />
                      </Field>
                      {jobHoursMap[hoursModalJobId]?.length > 0 && (
                        <div style={{ marginTop: '12px', marginBottom: '8px' }}>
                          <p style={{ margin: '0 0 6px', fontSize: '0.78em', color: 'var(--brand-rose)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent weeks</p>
                          <table style={{ width: '100%', fontSize: '0.8em', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                                <th style={{ paddingBottom: '4px', fontWeight: 500 }}>Week of</th>
                                <th style={{ paddingBottom: '4px', fontWeight: 500 }}>Hours</th>
                                <th style={{ paddingBottom: '4px', fontWeight: 500, textAlign: 'right' }}>Pay</th>
                              </tr>
                            </thead>
                            <tbody>
                              {jobHoursMap[hoursModalJobId].slice(0, 4).map(e => (
                                <tr key={e.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                  <td style={{ padding: '5px 0', color: 'var(--text-primary, #e8e3d8)' }}>{e.week_start_date}</td>
                                  <td style={{ padding: '5px 0', color: 'var(--text-primary, #e8e3d8)' }}>{e.hours_worked}h</td>
                                  <td style={{ padding: '5px 0', textAlign: 'right', color: '#2dd4bf', fontWeight: 600 }}>${e.weekly_pay.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <button style={{ ...s.saveBtn, flex: 1 }} onClick={handleSaveHours} disabled={hoursSaving || !hoursWorked}>
                          {hoursSaving ? 'Saving…' : 'Log Hours'}
                        </button>
                        <button style={{ ...s.cancelBtn, flex: 1 }} onClick={closeHoursModal}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <p style={{ margin: 0, fontSize: '0.88em', color: 'var(--brand-rose)', opacity: 0.7 }}>
                    Track your jobs and log weekly hours.
                  </p>
                  <button style={s.saveBtn} onClick={openAddJob}>+ Add Job</button>
                </div>
                {jobsLoading ? (
                  <p style={{ color: 'var(--brand-rose)', opacity: 0.5 }}>Loading jobs…</p>
                ) : jobs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--brand-rose)', opacity: 0.5 }}>
                    <p style={{ margin: 0 }}>No jobs added yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {jobs.map(j => (
                      <div key={j.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--brand-gold)', fontSize: '1em' }}>{j.job_name}</p>
                            {j.employer && <p style={{ margin: '0 0 4px', fontSize: '0.85em', color: 'var(--brand-rose)', opacity: 0.7 }}>{j.employer}</p>}
                            <p style={{ margin: 0, fontSize: '0.82em', color: 'var(--brand-rose)', opacity: 0.55 }}>
                              {JOB_TYPES[j.job_type] ?? j.job_type} · ${parseFloat(j.hourly_rate).toFixed(2)}/hr · {parseFloat(j.hours_per_week).toFixed(1)} hrs/wk
                            </p>
                            {(j.start_date || j.end_date) && (
                              <p style={{ margin: '4px 0 0', fontSize: '0.78em', color: 'var(--brand-rose)', opacity: 0.45 }}>
                                {j.start_date ?? '—'} → {j.end_date ?? 'ongoing'}
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            <p style={{ margin: 0, fontWeight: 700, color: '#2dd4bf', fontSize: '0.95em' }}>
                              ${j.monthly_income.toFixed(2)}/mo
                            </p>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button style={{ ...s.iconBtnSmall, fontSize: '0.72em', padding: '4px 8px' }}
                                onClick={() => openHoursModal(j)}>Log Hours</button>
                              <button style={s.iconBtnSmall} onClick={() => openEditJob(j)}>Edit</button>
                              <button style={s.iconBtnSmall} onClick={() => handleDeleteJob(j.id)}>Remove</button>
                            </div>
                          </div>
                        </div>
                        {jobHoursMap[j.id]?.length > 0 && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <p style={{ margin: '0 0 4px', fontSize: '0.73em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent weeks</p>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {jobHoursMap[j.id].slice(0, 4).map(e => (
                                <div key={e.id} style={{ background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.15)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75em' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{e.week_start_date.slice(5)}</span>
                                  <span style={{ color: '#2dd4bf', fontWeight: 600, marginLeft: '6px' }}>{e.hours_worked}h · ${e.weekly_pay.toFixed(0)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{ marginTop: '8px', padding: '14px', background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9em', color: 'var(--brand-rose)', fontWeight: 600 }}>Total Monthly Income (est.)</span>
                      <span style={{ fontSize: '1.1em', fontWeight: 700, color: '#2dd4bf' }}>
                        ${jobs.reduce((acc, j) => acc + j.monthly_income, 0).toFixed(2)}/mo
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Academic tab ── */}
            {tab === 'academic' && (
              <>
                {/* Graduation date missing warning */}
                {!form.graduation_date && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.35)', marginBottom: '4px' }}>
                    <p style={{ color: '#f87171', fontSize: '0.84em', margin: 0 }}>
                      ⚠ Expected graduation date is required — it anchors your forecast timeline.
                    </p>
                  </div>
                )}
                {/* 3-month graduation countdown */}
                {(() => {
                  if (!form.graduation_date) return null;
                  const grad = new Date(form.graduation_date + 'T00:00:00');
                  const today = new Date();
                  const daysLeft = Math.ceil((grad.getTime() - today.getTime()) / 86400000);
                  if (daysLeft > 0 && daysLeft <= 90) {
                    return (
                      <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)', marginBottom: '4px' }}>
                        <p style={{ color: '#fbbf24', fontSize: '0.84em', margin: 0, fontWeight: 600 }}>
                          Graduation in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — are you still on track?
                        </p>
                        <p style={{ color: '#fbbf24', fontSize: '0.78em', margin: '4px 0 0', opacity: 0.8 }}>
                          If your date has changed, update it here so your forecast stays accurate.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}

                <Field label="University">
                  <input style={s.input} value={form.university} onChange={set('university')}
                    placeholder="e.g. Cal State Fullerton" />
                </Field>
                <div style={s.row}>
                  <Field label="Home Currency" required>
                    <select style={{ ...s.input, ...s.select }} value={form.home_currency} onChange={set('home_currency')}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Study Country Currency" required>
                    <select style={{ ...s.input, ...s.select }} value={form.study_country_currency} onChange={set('study_country_currency')}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={s.row}>
                  <Field label="Expected Graduation Date" required>
                    <input style={{ ...s.input, borderColor: !form.graduation_date ? 'rgba(248,113,113,0.5)' : undefined }}
                      type="date" value={form.graduation_date} onChange={set('graduation_date')} />
                  </Field>
                  <Field label="Monthly Job Income (USD)">
                    <input style={s.input} type="number" min="0" value={form.monthly_income}
                      onChange={set('monthly_income')} placeholder="e.g. 800" />
                  </Field>
                </div>
                <div style={s.row}>
                  <Field label="Scholarship Amount (USD/period)">
                    <input style={s.input} type="number" min="0" value={form.scholarship_amount}
                      onChange={set('scholarship_amount')} placeholder="e.g. 2500" />
                  </Field>
                  <Field label="Scholarship Frequency">
                    <select style={{ ...s.input, ...s.select }} value={form.scholarship_frequency} onChange={set('scholarship_frequency')}>
                      <option value="NONE">None</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="SEMESTER">Per Semester</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="ANNUAL">Annual</option>
                    </select>
                  </Field>
                </div>
                <div style={s.row}>
                  <Field label="Visa Type">
                    <select style={{ ...s.input, ...s.select }} value={form.visa_type} onChange={set('visa_type')}>
                      <option value="NONE">Select visa type</option>
                      <option value="F1">F-1 (Student)</option>
                      <option value="J1">J-1 (Exchange)</option>
                      <option value="M1">M-1 (Vocational)</option>
                      <option value="OPT">OPT</option>
                      <option value="CPT">CPT</option>
                      <option value="H1B">H-1B</option>
                      <option value="CITIZEN">US Citizen / PR</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </Field>
                  <Field label="Max Work Hours / Week">
                    <input style={s.input} type="number" min="0" max="168" value={form.max_work_hours_per_week}
                      onChange={set('max_work_hours_per_week')} placeholder="F-1 on-campus: 20" />
                  </Field>
                </div>
                {form.visa_type === 'F1' && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)', marginTop: '-6px' }}>
                    <p style={{ color: 'var(--brand-gold)', fontSize: '0.82em', margin: 0 }}>
                      F-1 students are limited to 20 hrs/week on-campus during the academic term. Your forecast setup will warn you if you exceed this.
                    </p>
                  </div>
                )}
                <div style={s.infoBox}>
                  <p style={{ ...s.infoText, fontWeight: 600, marginBottom: 6 }}>Academic Break Schedule</p>
                  <p style={s.infoText}>
                    Break dates are auto-flagged in your forecast. After graduation: tuition and work income are zeroed out — only living expenses continue.
                  </p>
                </div>
                <div style={s.row}>
                  <Field label="Summer Break Start">
                    <input style={s.input} type="date" value={form.summer_break_start} onChange={set('summer_break_start')} />
                  </Field>
                  <Field label="Summer Break End">
                    <input style={s.input} type="date" value={form.summer_break_end} onChange={set('summer_break_end')} />
                  </Field>
                </div>
                <div style={s.row}>
                  <Field label="Winter Break Start">
                    <input style={s.input} type="date" value={form.winter_break_start} onChange={set('winter_break_start')} />
                  </Field>
                  <Field label="Winter Break End">
                    <input style={s.input} type="date" value={form.winter_break_end} onChange={set('winter_break_end')} />
                  </Field>
                </div>
              </>
            )}
          </div>

          {tab !== 'jobs' && (
            <div style={s.saveRow}>
              <button style={{ ...s.saveBtn, opacity: loading ? 0.7 : 1 }} onClick={handleSave} disabled={loading}>
                <Save size={16} />
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Job modal */}
      {showJobModal && (
        <div style={s.jobOverlay} onClick={() => setShowJobModal(false)}>
          <div style={s.jobModal} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px', fontSize: '1.2em', fontWeight: 700, color: 'var(--brand-gold)' }}>
              {editJobId ? 'Edit Job' : 'Add Job'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field label="Job Title *">
                <input style={s.input} placeholder="e.g. Research Assistant" value={jobForm.job_name}
                  onChange={e => setJobForm(f => ({ ...f, job_name: e.target.value }))} />
              </Field>
              <Field label="Employer">
                <input style={s.input} placeholder="e.g. Cal State Fullerton" value={jobForm.employer}
                  onChange={e => setJobForm(f => ({ ...f, employer: e.target.value }))} />
              </Field>
              <div style={s.row}>
                <Field label="Hourly Rate ($/hr) *">
                  <input style={s.input} type="number" min="0.01" step="0.01" placeholder="15.00" value={jobForm.hourly_rate}
                    onChange={e => setJobForm(f => ({ ...f, hourly_rate: e.target.value }))} />
                </Field>
                <Field label="Hours / Week *">
                  <input style={s.input} type="number" min="0.5" max="168" step="0.5" placeholder="20" value={jobForm.hours_per_week}
                    onChange={e => setJobForm(f => ({ ...f, hours_per_week: e.target.value }))} />
                </Field>
              </div>
              <Field label="Job Type">
                <select style={{ ...s.input, ...s.select }} value={jobForm.job_type}
                  onChange={e => setJobForm(f => ({ ...f, job_type: e.target.value }))}>
                  {Object.entries(JOB_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <div style={s.row}>
                <Field label="Start Date">
                  <input style={s.input} type="date" value={jobForm.start_date}
                    onChange={e => setJobForm(f => ({ ...f, start_date: e.target.value }))} />
                </Field>
                <Field label="End Date">
                  <input style={s.input} type="date" value={jobForm.end_date}
                    onChange={e => setJobForm(f => ({ ...f, end_date: e.target.value }))} />
                </Field>
              </div>
              {jobForm.hourly_rate && jobForm.hours_per_week && (
                <p style={{ margin: 0, fontSize: '0.85em', color: '#4ade80', fontWeight: 600 }}>
                  Monthly income: ${(parseFloat(jobForm.hourly_rate) * parseFloat(jobForm.hours_per_week) * (52 / 12)).toFixed(2)}
                </p>
              )}
              {jobError && <p style={{ margin: 0, color: '#f87171', fontSize: '0.85em' }}>{jobError}</p>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button style={s.cancelBtnJob} onClick={() => setShowJobModal(false)}>Cancel</button>
                <button style={s.saveBtn} onClick={handleSaveJob} disabled={jobSaving}>
                  {jobSaving ? 'Saving…' : editJobId ? 'Save Changes' : 'Add Job'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  iconBtnSmall: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '0.9em', padding: '4px', opacity: 0.7,
  },
  jobOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  jobModal: {
    background: 'var(--brand-maroon-dark)', border: '1px solid rgba(255,215,0,0.2)',
    borderRadius: '16px', padding: '32px', width: '460px', maxWidth: '95vw',
    maxHeight: '90vh', overflowY: 'auto',
  },
  cancelBtnJob: {
    padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px', color: 'var(--brand-rose)', cursor: 'pointer',
  },
  cancelBtn: {
    padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.88em',
  },
};