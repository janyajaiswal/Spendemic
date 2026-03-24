/**
 * Budgets page — set monthly/weekly spending limits per category,
 * track live spend vs limit with colour-coded progress bars.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API = 'http://localhost:8000/api/v1';

type Period = 'MONTHLY' | 'WEEKLY';

const CATEGORY_EMOJI: Record<string, string> = {
  FOOD: '🍔', RENT: '🏠', TRANSPORT: '🚌', UTILITIES: '💡',
  HEALTHCARE: '🏥', EDUCATION: '📚', ENTERTAINMENT: '🎮',
  CLOTHING: '👗', PERSONAL_CARE: '💄', SAVINGS: '💰',
  INVESTMENT: '📈', SALARY: '💼', FREELANCE: '🖥️',
  SCHOLARSHIP: '🎓', FAMILY_SUPPORT: '👨‍👩‍👧', CALFRESH: '🌾',
  WORK_STUDY: '🏫', SIDE_HUSTLE: '⚡', OTHER: '📦',
};

const CATEGORIES = [
  'FOOD','RENT','TRANSPORT','UTILITIES','HEALTHCARE','EDUCATION',
  'ENTERTAINMENT','CLOTHING','PERSONAL_CARE','OTHER',
];

const CAT_LABEL: Record<string, string> = {
  FOOD: 'Food & Dining', RENT: 'Rent & Housing', TRANSPORT: 'Transportation',
  UTILITIES: 'Utilities', HEALTHCARE: 'Healthcare', EDUCATION: 'Education',
  ENTERTAINMENT: 'Entertainment', CLOTHING: 'Clothing', PERSONAL_CARE: 'Personal Care',
  OTHER: 'Other',
};

interface Budget {
  id: string;
  category: string;
  limit_amount: string;
  currency: string;
  period: Period;
  start_date: string;
  is_active: boolean;
  spent: string;
  utilization: number;
}

interface FormState {
  category: string;
  limit_amount: string;
  currency: string;
  period: Period;
  start_date: string;
}

const EMPTY_FORM: FormState = {
  category: 'FOOD', limit_amount: '', currency: 'USD',
  period: 'MONTHLY', start_date: new Date().toISOString().slice(0, 10),
};

const CURRENCIES = ['USD','EUR','GBP','INR','CAD','AUD','JPY','CNY','SGD','MXN','BRL','NGN','KES','PKR','BDT','PHP','VND'];

export default function Budgets() {
  const { user } = useAuth();
  const token = user?.accessToken ?? localStorage.getItem('spendemic_token') ?? '';
  const authHdr = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/budgets?active_only=true`, { headers: authHdr });
      if (res.ok) setBudgets(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setFormError(''); setShowModal(true); };

  const openEdit = (b: Budget) => {
    setForm({
      category: b.category, limit_amount: b.limit_amount,
      currency: b.currency, period: b.period, start_date: b.start_date,
    });
    setEditId(b.id); setFormError(''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.limit_amount || Number(form.limit_amount) <= 0) { setFormError('Limit must be > 0'); return; }
    setSaving(true); setFormError('');
    const payload = {
      category: form.category, limit_amount: parseFloat(form.limit_amount),
      currency: form.currency, period: form.period, start_date: form.start_date,
    };
    const url = editId ? `${API}/budgets/${editId}` : `${API}/budgets`;
    const method = editId ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, { method, headers: authHdr, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail;
        const msg = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map((e: { msg: string }) => e.msg).join(', ')
          : 'Save failed';
        setFormError(msg); return;
      }
      setShowModal(false); load();
    } catch { setFormError('Network error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    setDeletingId(id);
    await fetch(`${API}/budgets/${id}`, { method: 'DELETE', headers: authHdr });
    setDeletingId(null); load();
  };

  const barColor = (u: number) => {
    if (u >= 1) return '#f87171';       // over budget — red
    if (u >= 0.8) return '#fbbf24';     // 80%+ — amber
    return '#4ade80';                   // healthy — green
  };

  const totalLimit = budgets.reduce((s, b) => s + Number(b.limit_amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);
  const overCount = budgets.filter(b => b.utilization >= 1).length;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Budgets</h1>
          <p style={s.subtitle}>Set spending limits · track what you've used</p>
        </div>
        <button style={s.addBtn} onClick={openAdd}>+ New Budget</button>
      </div>

      {/* Summary strip */}
      <div style={s.strip}>
        <div style={s.stripCard}>
          <span style={s.stripLabel}>Total Limit</span>
          <span style={s.stripValue}>
            {totalLimit.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
          </span>
        </div>
        <div style={s.stripCard}>
          <span style={s.stripLabel}>Total Spent</span>
          <span style={{ ...s.stripValue, color: totalSpent > totalLimit ? '#f87171' : '#4ade80' }}>
            {totalSpent.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
          </span>
        </div>
        <div style={s.stripCard}>
          <span style={s.stripLabel}>Remaining</span>
          <span style={s.stripValue}>
            {Math.max(0, totalLimit - totalSpent).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
          </span>
        </div>
        <div style={s.stripCard}>
          <span style={s.stripLabel}>Over Budget</span>
          <span style={{ ...s.stripValue, color: overCount > 0 ? '#f87171' : '#4ade80' }}>
            {overCount} {overCount === 1 ? 'category' : 'categories'}
          </span>
        </div>
      </div>

      {/* Budget cards */}
      {loading ? (
        <p style={s.empty}>Loading budgets…</p>
      ) : budgets.length === 0 ? (
        <div style={s.emptyState}>
          <p style={s.emptyIcon}>💼</p>
          <p style={s.emptyTitle}>No budgets yet</p>
          <p style={s.emptyHint}>Set a limit for a spending category to start tracking.</p>
          <button style={s.addBtn} onClick={openAdd}>Create your first budget</button>
        </div>
      ) : (
        <div style={s.grid}>
          {budgets.map(b => {
            const pct = Math.min(b.utilization, 1);
            const spent = Number(b.spent);
            const limit = Number(b.limit_amount);
            const remaining = limit - spent;
            const color = barColor(b.utilization);
            return (
              <div key={b.id} style={s.card}>
                <div style={s.cardTop}>
                  <span style={s.cardEmoji}>{CATEGORY_EMOJI[b.category] ?? '📦'}</span>
                  <div style={s.cardMeta}>
                    <span style={s.cardCat}>{CAT_LABEL[b.category] ?? b.category}</span>
                    <span style={s.cardPeriod}>{b.period}</span>
                  </div>
                  <div style={s.cardActions}>
                    <button style={s.iconBtn} onClick={() => openEdit(b)}>✏️</button>
                    <button style={s.iconBtn} onClick={() => handleDelete(b.id)}
                      disabled={deletingId === b.id}>🗑️</button>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={s.barTrack}>
                  <div style={{ ...s.barFill, width: `${pct * 100}%`, background: color }} />
                </div>

                <div style={s.cardNums}>
                  <span style={{ color }}>
                    {b.currency} {spent.toFixed(2)} spent
                  </span>
                  <span style={s.cardLimit}>of {b.currency} {limit.toFixed(2)}</span>
                </div>

                {b.utilization >= 1 ? (
                  <div style={{ ...s.statusBadge, background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                    Over budget by {b.currency} {Math.abs(remaining).toFixed(2)}
                  </div>
                ) : b.utilization >= 0.8 ? (
                  <div style={{ ...s.statusBadge, background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                    {Math.round(b.utilization * 100)}% used — watch out
                  </div>
                ) : (
                  <div style={{ ...s.statusBadge, background: 'rgba(74,222,128,0.08)', color: '#4ade80' }}>
                    {b.currency} {remaining.toFixed(2)} remaining
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>{editId ? 'Edit Budget' : 'New Budget'}</h2>

            <div style={s.formGroup}>
              <label style={s.label}>Category</label>
              <select style={s.input} value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_EMOJI[c]} {CAT_LABEL[c]}</option>
                ))}
              </select>
            </div>

            <div style={s.row}>
              <div style={{ ...s.formGroup, flex: 1 }}>
                <label style={s.label}>Limit Amount *</label>
                <input style={s.input} type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={form.limit_amount}
                  onChange={e => setForm(f => ({ ...f, limit_amount: e.target.value }))} />
              </div>
              <div style={{ ...s.formGroup, width: '100px' }}>
                <label style={s.label}>Currency</label>
                <select style={s.input} value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>Period</label>
              <div style={s.toggle}>
                {(['MONTHLY', 'WEEKLY'] as Period[]).map(p => (
                  <button key={p} style={{ ...s.toggleBtn, ...(form.period === p ? s.toggleActive : {}) }}
                    onClick={() => setForm(f => ({ ...f, period: p }))}>
                    {p === 'MONTHLY' ? '📅 Monthly' : '📆 Weekly'}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>Start Date</label>
              <input style={s.input} type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>

            {formError && <p style={s.error}>{formError}</p>}

            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Budget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '1.8em', fontWeight: 700, color: 'var(--brand-gold)', margin: 0 },
  subtitle: { fontSize: '0.9em', color: 'var(--brand-rose)', opacity: 0.6, margin: '4px 0 0' },
  addBtn: {
    padding: '10px 20px', background: 'linear-gradient(135deg, var(--brand-gold), var(--brand-gold-dark))',
    color: 'var(--brand-maroon)', border: 'none', borderRadius: '8px', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.95em',
  },
  strip: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' },
  stripCard: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  stripLabel: { fontSize: '0.78em', color: 'var(--brand-rose)', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.05em' },
  stripValue: { fontSize: '1.4em', fontWeight: 700, color: 'var(--brand-gold)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '18px' },
  card: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: '12px' },
  cardEmoji: { fontSize: '1.8em', flexShrink: 0 },
  cardMeta: { flex: 1, display: 'flex', flexDirection: 'column' },
  cardCat: { fontWeight: 600, color: 'var(--brand-rose)', fontSize: '1em' },
  cardPeriod: { fontSize: '0.72em', color: 'var(--brand-rose)', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em' },
  cardActions: { display: 'flex', gap: '4px' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1em', padding: '4px', opacity: 0.7 },
  barTrack: { height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '4px', transition: 'width 0.4s ease' },
  cardNums: { display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', fontWeight: 600 },
  cardLimit: { color: 'var(--brand-rose)', opacity: 0.5 },
  statusBadge: { fontSize: '0.78em', fontWeight: 600, padding: '5px 10px', borderRadius: '6px', textAlign: 'center' },
  empty: { color: 'var(--brand-rose)', opacity: 0.5, textAlign: 'center', marginTop: '60px' },
  emptyState: { textAlign: 'center', marginTop: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
  emptyIcon: { fontSize: '3em', margin: 0 },
  emptyTitle: { fontSize: '1.2em', fontWeight: 600, color: 'var(--brand-rose)', margin: 0 },
  emptyHint: { color: 'var(--brand-rose)', opacity: 0.5, fontSize: '0.9em', margin: 0 },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  modal: {
    background: 'var(--brand-maroon-dark)', border: '1px solid rgba(255,215,0,0.2)',
    borderRadius: '16px', padding: '32px', width: '420px', display: 'flex', flexDirection: 'column', gap: '16px',
  },
  modalTitle: { fontSize: '1.3em', fontWeight: 700, color: 'var(--brand-gold)', margin: 0 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.82em', color: 'var(--brand-rose)', opacity: 0.7, fontWeight: 500 },
  input: {
    padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px', color: 'var(--brand-rose)', fontSize: '0.95em', outline: 'none',
  },
  row: { display: 'flex', gap: '12px' },
  toggle: { display: 'flex', gap: '8px' },
  toggleBtn: {
    flex: 1, padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px', color: 'var(--brand-rose)', cursor: 'pointer', fontSize: '0.9em',
  },
  toggleActive: {
    background: 'rgba(255,215,0,0.15)', border: '1px solid var(--brand-gold)',
    color: 'var(--brand-gold)', fontWeight: 600,
  },
  error: { color: '#f87171', fontSize: '0.85em', margin: 0 },
  modalBtns: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' },
  cancelBtn: {
    padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px', color: 'var(--brand-rose)', cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 24px', background: 'linear-gradient(135deg, var(--brand-gold), var(--brand-gold-dark))',
    color: 'var(--brand-maroon)', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
  },
};
