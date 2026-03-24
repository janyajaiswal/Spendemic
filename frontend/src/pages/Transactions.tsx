import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, X, Check,
  ChevronDown, FlaskConical, ChevronRight, Upload,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API = 'http://localhost:8000/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FcData {
  hours_per_week: string;
  is_working: boolean;
  is_summer_break: boolean;
  is_winter_break: boolean;
  travel_home: boolean;
  travel_cost: string;
  tuition_due: string;
  scholarship_received: string;
  rent: string;
}

const EMPTY_FC: FcData = {
  hours_per_week: '', is_working: true, is_summer_break: false,
  is_winter_break: false, travel_home: false, travel_cost: '',
  tuition_due: '', scholarship_received: '', rent: '',
};

type TxType = 'INCOME' | 'EXPENSE';
type RecurFreq = 'DAILY' | 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

type Category =
  | 'HOUSING' | 'FOOD' | 'TRANSPORTATION' | 'EDUCATION' | 'HEALTHCARE'
  | 'ENTERTAINMENT' | 'SHOPPING' | 'UTILITIES' | 'PERSONAL_CARE' | 'TRAVEL'
  | 'SAVINGS' | 'SALARY' | 'STIPEND' | 'SCHOLARSHIP' | 'FINANCIAL_AID'
  | 'FAMILY_SUPPORT' | 'FREELANCE' | 'OTHER';

interface Transaction {
  id: string;
  amount: string;
  currency: string;
  type: TxType;
  category: Category;
  description: string | null;
  transaction_date: string;
  is_recurring: boolean;
  recurring_frequency: RecurFreq | null;
  recurring_parent_id: string | null;
  is_generated: boolean;
  created_at: string;
}

interface FormState {
  amount: string;
  currency: string;
  type: TxType;
  category: Category;
  description: string;
  transaction_date: string;
  is_recurring: boolean;
  recurring_frequency: RecurFreq;
}

// Scenario = same shape as FormState but no id; purely in React state
interface Scenario extends FormState {
  scenarioId: string;
  label: string; // e.g. "If I get a scholarship"
}

// ─── Constants ────────────────────────────────────────────────────────────────
const INCOME_CATS: Category[] = ['SALARY', 'STIPEND', 'SCHOLARSHIP', 'FINANCIAL_AID', 'FAMILY_SUPPORT', 'FREELANCE', 'OTHER'];
const EXPENSE_CATS: Category[] = ['HOUSING', 'FOOD', 'TRANSPORTATION', 'EDUCATION', 'HEALTHCARE', 'ENTERTAINMENT', 'SHOPPING', 'UTILITIES', 'PERSONAL_CARE', 'TRAVEL', 'SAVINGS', 'OTHER'];

const CAT_LABEL: Record<Category, string> = {
  HOUSING: 'Housing', FOOD: 'Food', TRANSPORTATION: 'Transportation', EDUCATION: 'Education',
  HEALTHCARE: 'Healthcare', ENTERTAINMENT: 'Entertainment', SHOPPING: 'Shopping',
  UTILITIES: 'Utilities', PERSONAL_CARE: 'Personal Care', TRAVEL: 'Travel', SAVINGS: 'Savings',
  SALARY: 'Salary', STIPEND: 'Stipend', SCHOLARSHIP: 'Scholarship', FINANCIAL_AID: 'Financial Aid',
  FAMILY_SUPPORT: 'Family Support', FREELANCE: 'Freelance', OTHER: 'Other',
};
const CAT_EMOJI: Record<Category, string> = {
  HOUSING: '🏠', FOOD: '🍔', TRANSPORTATION: '🚌', EDUCATION: '📚', HEALTHCARE: '💊',
  ENTERTAINMENT: '🎬', SHOPPING: '🛍️', UTILITIES: '💡', PERSONAL_CARE: '💈', TRAVEL: '✈️',
  SAVINGS: '🏦', SALARY: '💼', STIPEND: '🎓', SCHOLARSHIP: '🏆', FINANCIAL_AID: '🤝',
  FAMILY_SUPPORT: '👨‍👩‍👧', FREELANCE: '💻', OTHER: '📌',
};
const FREQ_LABEL: Record<RecurFreq, string> = {
  DAILY: 'Daily', WEEKLY: 'Weekly', BI_WEEKLY: 'Bi-weekly',
  MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', ANNUALLY: 'Annually',
};
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED', 'MXN', 'BRL', 'KRW', 'THB', 'PHP', 'NGN', 'PKR', 'BDT'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const EMPTY_FORM: FormState = {
  amount: '', currency: 'USD', type: 'EXPENSE', category: 'FOOD',
  description: '', transaction_date: new Date().toISOString().slice(0, 10),
  is_recurring: false, recurring_frequency: 'MONTHLY',
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Transactions() {
  const { user } = useAuth();
  const token = user?.accessToken ?? '';
  const authHdr = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const today = new Date();
  const [filterType, setFilterType] = useState<TxType | 'ALL'>('ALL');
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Currency settings  (pulled from user profile)
  const [workingCurrency, setWorkingCurrency] = useState('USD');
  const [homeCurrency, setHomeCurrency] = useState('USD');
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesBase, setRatesBase] = useState('USD');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Scenario planner
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioForm, setScenarioForm] = useState<FormState & { label: string }>({ ...EMPTY_FORM, label: '' });
  const [scenarioFormOpen, setScenarioFormOpen] = useState(false);
  const [scenarioError, setScenarioError] = useState('');
  const scenarioIdRef = useRef(0);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Forecast Setup state ─────────────────────────────────────────��──────────
  const [fcOpen, setFcOpen] = useState(false);
  const [fcYear, setFcYear] = useState(today.getFullYear());
  const [fcMonth, setFcMonth] = useState(today.getMonth() + 1);
  const [fcContexts, setFcContexts] = useState<Record<string, FcData>>({});
  const [fcForm, setFcForm] = useState<FcData>(EMPTY_FC);
  const [fcSaving, setFcSaving] = useState(false);
  const [fcCopyOpen, setFcCopyOpen] = useState(false);
  const [fcCopyYear, setFcCopyYear] = useState(today.getFullYear());
  const [fcCopyMonths, setFcCopyMonths] = useState<boolean[]>(Array(12).fill(false));

  // ── Import state ───────────────────────────────────────────────────────────
  type ImportStep = 'upload' | 'review' | 'done';
  interface ImportPreview {
    filename: string;
    total_rows: number;
    detected_columns: Record<string, string>;
    undetected: string[];
    preview_rows: Array<Record<string, unknown>>;
    all_columns: string[];
    warnings: string[];
  }
  interface ImportResult { imported: number; skipped: number; errors: string[]; date_range?: { min: string; max: string } | null; }
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importColMap, setImportColMap] = useState<Record<string, string>>({});
  const [importDefCurrency, setImportDefCurrency] = useState('USD');
  const [importDefCategory, setImportDefCategory] = useState('OTHER');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // ── Forecast Context helpers ───────────────────────────────────────────────
  const fetchFcContexts = useCallback(async (year: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/forecast-context?year=${year}`, { headers: authHdr });
      if (!res.ok) return;
      const data = await res.json() as Array<Record<string, unknown>>;
      const map: Record<string, FcData> = {};
      for (const item of data) {
        map[`${item.year}-${item.month}`] = {
          hours_per_week: item.hours_per_week != null ? String(item.hours_per_week) : '',
          is_working: Boolean(item.is_working),
          is_summer_break: Boolean(item.is_summer_break),
          is_winter_break: Boolean(item.is_winter_break),
          travel_home: Boolean(item.travel_home),
          travel_cost: item.travel_cost != null ? String(item.travel_cost) : '',
          tuition_due: item.tuition_due != null ? String(item.tuition_due) : '',
          scholarship_received: item.scholarship_received != null ? String(item.scholarship_received) : '',
          rent: item.rent != null ? String(item.rent) : '',
        };
      }
      setFcContexts(map);
    } catch { /* silent */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { if (fcOpen) fetchFcContexts(fcYear); }, [fcOpen, fcYear, fetchFcContexts]);

  const handleFcMonthSelect = (m: number) => {
    setFcMonth(m);
    const key = `${fcYear}-${m}`;
    setFcForm(fcContexts[key] ?? { ...EMPTY_FC });
  };

  const handleFcSave = async () => {
    setFcSaving(true);
    const payload = {
      hours_per_week: fcForm.hours_per_week ? parseFloat(fcForm.hours_per_week) : null,
      is_working: fcForm.is_working,
      is_summer_break: fcForm.is_summer_break,
      is_winter_break: fcForm.is_winter_break,
      travel_home: fcForm.travel_home,
      travel_cost: fcForm.travel_cost ? parseFloat(fcForm.travel_cost) : null,
      tuition_due: fcForm.tuition_due ? parseFloat(fcForm.tuition_due) : null,
      scholarship_received: fcForm.scholarship_received ? parseFloat(fcForm.scholarship_received) : null,
      rent: fcForm.rent ? parseFloat(fcForm.rent) : null,
    };
    try {
      const res = await fetch(`${API}/forecast-context/${fcYear}/${fcMonth}`, {
        method: 'PUT', headers: authHdr, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setFcContexts(prev => ({ ...prev, [`${fcYear}-${fcMonth}`]: { ...fcForm } }));
      showToast('Forecast context saved', true);
    } catch { showToast('Failed to save', false); }
    finally { setFcSaving(false); }
  };

  const handleFcCopy = async () => {
    const targets = fcCopyMonths
      .map((checked, i) => checked ? { year: fcCopyYear, month: i + 1 } : null)
      .filter(Boolean);
    if (!targets.length) { showToast('Select at least one month', false); return; }
    setFcSaving(true);
    // Auto-save source month first so the DB row exists for bulk-copy to read
    const savePayload = {
      hours_per_week: fcForm.hours_per_week ? parseFloat(fcForm.hours_per_week) : null,
      is_working: fcForm.is_working, is_summer_break: fcForm.is_summer_break,
      is_winter_break: fcForm.is_winter_break, travel_home: fcForm.travel_home,
      travel_cost: fcForm.travel_cost ? parseFloat(fcForm.travel_cost) : null,
      tuition_due: fcForm.tuition_due ? parseFloat(fcForm.tuition_due) : null,
      scholarship_received: fcForm.scholarship_received ? parseFloat(fcForm.scholarship_received) : null,
      rent: fcForm.rent ? parseFloat(fcForm.rent) : null,
    };
    await fetch(`${API}/forecast-context/${fcYear}/${fcMonth}`, {
      method: 'PUT', headers: authHdr, body: JSON.stringify(savePayload),
    }).catch(() => {});
    try {
      const res = await fetch(`${API}/forecast-context/bulk-copy`, {
        method: 'POST', headers: authHdr,
        body: JSON.stringify({ source_year: fcYear, source_month: fcMonth, targets }),
      });
      if (!res.ok) throw new Error();
      showToast(`Copied to ${targets.length} month${targets.length > 1 ? 's' : ''}`, true);
      setFcCopyOpen(false);
      setFcCopyMonths(Array(12).fill(false));
      if (fcCopyYear === fcYear) fetchFcContexts(fcYear);
    } catch { showToast('Copy failed', false); }
    finally { setFcSaving(false); }
  };

  // ── Import handlers ────────────────────────────────────────────────────────
  const handleImportFile = async (file: File) => {
    setImportFile(file);
    setImportLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/transactions/import/preview`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Preview failed');
      setImportPreview(data as ImportPreview);
      setImportColMap({ ...data.detected_columns });
      setImportStep('review');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Preview failed', false);
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!importFile || !importPreview) return;
    setImportLoading(true);
    const fd = new FormData();
    fd.append('file', importFile);
    fd.append('date_col', importColMap['date'] ?? '');
    fd.append('amount_col', importColMap['amount'] ?? '');
    fd.append('debit_col', importColMap['debit'] ?? '');
    fd.append('credit_col', importColMap['credit'] ?? '');
    fd.append('description_col', importColMap['description'] ?? '');
    fd.append('category_col', importColMap['category'] ?? '');
    fd.append('currency_col', importColMap['currency'] ?? '');
    fd.append('type_col', importColMap['type'] ?? '');
    fd.append('default_currency', importDefCurrency);
    fd.append('default_category', importDefCategory);
    try {
      const res = await fetch(`${API}/transactions/import/confirm`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Import failed');
      const result = data as ImportResult;
      setImportResult(result);
      setImportStep('done');
      // Navigate to the month containing the most recent imported transaction
      if (result.date_range?.max) {
        const d = new Date(result.date_range.max + 'T00:00:00');
        setFilterYear(d.getFullYear());
        setFilterMonth(d.getMonth() + 1);
      } else {
        fetchTransactions();
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Import failed', false);
    } finally {
      setImportLoading(false);
    }
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportStep('upload');
    setImportFile(null);
    setImportPreview(null);
    setImportResult(null);
    setImportColMap({});
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const convert = useCallback((amount: number, from: string, to: string): number => {
    if (from === to) return amount;
    // Convert via base currency of loaded rates
    const fromRate = rates[from] ?? 1;
    const toRate = rates[to] ?? 1;
    if (ratesBase === from) return amount * toRate;
    if (ratesBase === to) return amount / fromRate;
    // Cross-rate
    return (amount / fromRate) * toRate;
  }, [rates, ratesBase]);

  const fmt = (amount: number, currency: string) =>
    `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Load rates & user currencies ──────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const loadRates = async (baseCurrency: string) => {
      // Exchange rates endpoint is public — no auth needed
      const ratesRes = await fetch(`${API}/exchange-rates/${baseCurrency}`);
      if (!ratesRes.ok) throw new Error(`Rates fetch failed: ${ratesRes.status}`);
      const data = await ratesRes.json() as { base: string; rates: Record<string, number> };
      setRates(data.rates);
      setRatesBase(data.base);
    };

    (async () => {
      try {
        // Fetch user profile for currency preferences
        const profileRes = await fetch(`${API}/users/me`, { headers: authHdr });
        if (profileRes.ok) {
          const profile = await profileRes.json() as { study_country_currency?: string; home_currency?: string };
          const wc = profile.study_country_currency ?? 'USD';
          const hc = profile.home_currency ?? 'USD';
          setWorkingCurrency(wc);
          setHomeCurrency(hc);
          await loadRates(wc);
        } else {
          // Profile unavailable — still load USD rates
          await loadRates('USD');
        }
      } catch (err) {
        console.error('[Transactions] Failed to load exchange rates:', err);
        // Load USD rates as fallback
        try { await loadRates('USD'); } catch { /* truly offline */ }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Fetch transactions ─────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(filterYear), month: String(filterMonth), limit: '200' });
      if (filterType !== 'ALL') params.set('type', filterType);
      const res = await fetch(`${API}/transactions?${params}`, { headers: authHdr });
      if (!res.ok) throw new Error();
      setTransactions(await res.json() as Transaction[]);
    } catch {
      showToast('Failed to load transactions', false);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterType, filterMonth, filterYear]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openAdd = () => { setEditingId(null); setForm({ ...EMPTY_FORM, currency: workingCurrency }); setFormError(''); setModalOpen(true); };
  const openEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setForm({
      amount: tx.amount, currency: tx.currency, type: tx.type, category: tx.category,
      description: tx.description ?? '', transaction_date: tx.transaction_date,
      is_recurring: tx.is_recurring, recurring_frequency: tx.recurring_frequency ?? 'MONTHLY',
    });
    setFormError(''); setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditingId(null); };

  const handleTypeChange = (t: TxType) => {
    const cats = t === 'INCOME' ? INCOME_CATS : EXPENSE_CATS;
    setForm(f => ({ ...f, type: t, category: cats[0] }));
  };

  // ── Save transaction ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) { setFormError('Amount must be > 0'); return; }
    if (!form.transaction_date) { setFormError('Date is required'); return; }
    setFormError(''); setSaving(true);
    const payload = {
      amount: parseFloat(form.amount), currency: form.currency, type: form.type,
      category: form.category, description: form.description || null,
      transaction_date: form.transaction_date, is_recurring: form.is_recurring,
      recurring_frequency: form.is_recurring ? form.recurring_frequency : null,
    };
    try {
      const url = editingId ? `${API}/transactions/${editingId}` : `${API}/transactions`;
      const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: authHdr, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json() as { detail?: string }; throw new Error(e.detail ?? 'Failed'); }
      showToast(editingId ? 'Updated' : 'Transaction added', true);
      closeModal(); fetchTransactions();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${API}/transactions/${id}`, { method: 'DELETE', headers: authHdr });
      if (!res.ok) throw new Error();
      showToast('Deleted', true);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch { showToast('Failed to delete', false); }
    finally { setDeletingId(null); }
  };

  // ── Scenario helpers ───────────────────────────────────────────────────────
  const handleScenarioTypeChange = (t: TxType) => {
    const cats = t === 'INCOME' ? INCOME_CATS : EXPENSE_CATS;
    setScenarioForm(f => ({ ...f, type: t, category: cats[0] }));
  };

  const addScenario = () => {
    if (!scenarioForm.amount || Number(scenarioForm.amount) <= 0) { setScenarioError('Amount must be > 0'); return; }
    if (!scenarioForm.label.trim()) { setScenarioError('Give this scenario a label'); return; }
    setScenarioError('');
    const id = String(++scenarioIdRef.current);
    setScenarios(prev => [...prev, { ...scenarioForm, scenarioId: id }]);
    setScenarioForm({ ...EMPTY_FORM, currency: workingCurrency, label: '' });
    setScenarioFormOpen(false);
  };

  const removeScenario = (id: string) => setScenarios(prev => prev.filter(s => s.scenarioId !== id));

  // ── Totals ─────────────────────────────────────────────────────────────────
  const actualIncome = transactions.filter(t => t.type === 'INCOME')
    .reduce((s, t) => s + convert(parseFloat(t.amount), t.currency, workingCurrency), 0);
  const actualExpenses = transactions.filter(t => t.type === 'EXPENSE')
    .reduce((s, t) => s + convert(parseFloat(t.amount), t.currency, workingCurrency), 0);
  const actualNet = actualIncome - actualExpenses;

  const scenarioIncome = scenarios.filter(s => s.type === 'INCOME')
    .reduce((sum, s) => sum + convert(parseFloat(s.amount), s.currency, workingCurrency), 0);
  const scenarioExpenses = scenarios.filter(s => s.type === 'EXPENSE')
    .reduce((sum, s) => sum + convert(parseFloat(s.amount), s.currency, workingCurrency), 0);
  const simNet = actualNet + scenarioIncome - scenarioExpenses;

  const currentCats = form.type === 'INCOME' ? INCOME_CATS : EXPENSE_CATS;
  const yearOptions = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);

  if (!token) {
    return <div style={s.centered}><p style={{ color: 'var(--brand-rose)' }}>Please sign in to view transactions.</p></div>;
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* Toast */}
      {toast && (
        <div style={{ ...s.toast, background: toast.ok ? '#1a4a2a' : '#4a1a1a', borderColor: toast.ok ? '#2d7a4a' : '#7a2d2d' }}>
          {toast.ok ? <Check size={14} /> : <X size={14} />} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Transactions</h1>
          <p style={s.subtitle}>{MONTHS[filterMonth - 1]} {filterYear} · Working: <strong>{workingCurrency}</strong> · Home: <strong>{homeCurrency}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ ...s.addBtn, background: 'transparent', border: '1px solid var(--brand-gold)', color: 'var(--brand-gold)' }}
            onClick={() => setImportOpen(true)}>
            <Upload size={16} /> Import
          </button>
          <button style={s.addBtn} onClick={openAdd}><Plus size={18} /> Add Transaction</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={s.cards}>
        <div style={{ ...s.card, borderColor: '#2d7a4a' }}>
          <div style={s.cardLabel}><TrendingUp size={14} style={{ color: '#4ade80' }} /> Income</div>
          <div style={{ ...s.cardValue, color: '#4ade80' }}>{fmt(actualIncome, workingCurrency)}</div>
        </div>
        <div style={{ ...s.card, borderColor: '#7a2d2d' }}>
          <div style={s.cardLabel}><TrendingDown size={14} style={{ color: '#f87171' }} /> Expenses</div>
          <div style={{ ...s.cardValue, color: '#f87171' }}>{fmt(actualExpenses, workingCurrency)}</div>
        </div>
        <div style={{ ...s.card, borderColor: actualNet >= 0 ? '#2d4a7a' : '#7a4a2d' }}>
          <div style={s.cardLabel}>Net Savings</div>
          <div style={{ ...s.cardValue, color: actualNet >= 0 ? '#60a5fa' : '#fb923c' }}>
            {actualNet >= 0 ? '+' : ''}{fmt(actualNet, workingCurrency)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={s.filters}>
        <div style={s.tabs}>
          {(['ALL', 'INCOME', 'EXPENSE'] as const).map(t => (
            <button key={t} style={{ ...s.tab, ...(filterType === t ? s.tabActive : {}) }} onClick={() => setFilterType(t)}>
              {t === 'ALL' ? 'All' : t === 'INCOME' ? 'Income' : 'Expenses'}
            </button>
          ))}
        </div>
        <div style={s.dateFilters}>
          <div style={s.selectWrap}>
            <select style={s.select} value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <ChevronDown size={13} style={s.chevron} />
          </div>
          <div style={s.selectWrap}>
            <select style={s.select} value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={13} style={s.chevron} />
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div style={s.list}>
        {loading ? (
          <div style={s.centered}><span style={{ color: 'var(--brand-rose)', opacity: 0.5 }}>Loading…</span></div>
        ) : transactions.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>📊</div>
            <p style={s.emptyText}>No transactions for this period.</p>
            <button style={s.addBtnSm} onClick={openAdd}><Plus size={14} /> Add one</button>
          </div>
        ) : (
          transactions.map(tx => {
            const origAmt = parseFloat(tx.amount);
            const workingAmt = convert(origAmt, tx.currency, workingCurrency);
            const homeAmt = convert(origAmt, tx.currency, homeCurrency);
            const showOrig = tx.currency !== workingCurrency;
            const showHome = homeCurrency !== workingCurrency && tx.currency !== homeCurrency;
            return (
              <div key={tx.id} style={s.txRow}>
                <div style={s.txEmoji}>{CAT_EMOJI[tx.category]}</div>
                <div style={s.txMeta}>
                  <span style={s.txCategory}>{CAT_LABEL[tx.category]}</span>
                  {tx.description && <span style={s.txDesc}>{tx.description}</span>}
                  <div style={s.txBadges}>
                    <span style={s.txDate}>
                      {new Date(tx.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {tx.is_recurring && (
                      <span style={s.recurBadge}>
                        ↻ {tx.recurring_frequency ? FREQ_LABEL[tx.recurring_frequency] : 'recurring'}
                      </span>
                    )}
                    {tx.is_generated && (
                      <span style={s.genBadge}>auto</span>
                    )}
                    {showOrig && (
                      <span style={s.origBadge}>{tx.currency} {origAmt.toFixed(2)}</span>
                    )}
                    {showHome && (
                      <span style={s.homeBadge}>≈ {homeCurrency} {homeAmt.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div style={s.txRight}>
                  <span style={{ ...s.txAmount, color: tx.type === 'INCOME' ? '#4ade80' : '#f87171' }}>
                    {tx.type === 'INCOME' ? '+' : '−'}{fmt(workingAmt, workingCurrency)}
                  </span>
                  <div style={s.txActions}>
                    <button style={s.iconBtn} onClick={() => openEdit(tx)} title="Edit"><Pencil size={13} /></button>
                    <button style={{ ...s.iconBtn, color: '#f87171' }} onClick={() => handleDelete(tx.id)} disabled={deletingId === tx.id} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── Scenario Planner ─── */}
      <div style={s.scenarioSection}>
        <button style={s.scenarioToggle} onClick={() => setScenarioOpen(o => !o)}>
          <FlaskConical size={16} style={{ color: '#a78bfa' }} />
          <span>What-If Scenario Planner</span>
          {scenarios.length > 0 && <span style={s.scenarioBadge}>{scenarios.length}</span>}
          <ChevronRight size={14} style={{ marginLeft: 'auto', transform: scenarioOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', opacity: 0.6 }} />
        </button>

        {scenarioOpen && (
          <div style={s.scenarioBody}>
            <p style={s.scenarioHint}>
              Simulate hypothetical transactions to see how they'd affect your balance — without saving them.
              Scenarios are never included in your actual data.
            </p>

            {/* Simulated summary */}
            {scenarios.length > 0 && (
              <div style={s.simCards}>
                <div style={s.simCard}>
                  <span style={s.simLabel}>Simulated Net</span>
                  <span style={{ ...s.simValue, color: simNet >= 0 ? '#a78bfa' : '#fb923c' }}>
                    {simNet >= 0 ? '+' : ''}{fmt(simNet, workingCurrency)}
                  </span>
                </div>
                <div style={s.simCard}>
                  <span style={s.simLabel}>Change from actual</span>
                  <span style={{ ...s.simValue, color: (simNet - actualNet) >= 0 ? '#4ade80' : '#f87171' }}>
                    {(simNet - actualNet) >= 0 ? '+' : ''}{fmt(simNet - actualNet, workingCurrency)}
                  </span>
                </div>
              </div>
            )}

            {/* Scenario list */}
            {scenarios.map(sc => {
              const amt = convert(parseFloat(sc.amount), sc.currency, workingCurrency);
              return (
                <div key={sc.scenarioId} style={s.scenarioRow}>
                  <span style={s.scenarioRowEmoji}>{CAT_EMOJI[sc.category]}</span>
                  <div style={s.scenarioRowMeta}>
                    <span style={s.scenarioRowLabel}>{sc.label}</span>
                    <span style={s.scenarioRowSub}>{CAT_LABEL[sc.category]}</span>
                  </div>
                  <span style={{ ...s.scenarioRowAmt, color: sc.type === 'INCOME' ? '#4ade80' : '#f87171' }}>
                    {sc.type === 'INCOME' ? '+' : '−'}{fmt(amt, workingCurrency)}
                  </span>
                  <button style={{ ...s.iconBtn, color: '#f87171', marginLeft: '8px' }} onClick={() => removeScenario(sc.scenarioId)}>
                    <X size={13} />
                  </button>
                </div>
              );
            })}

            {/* Add scenario button / form */}
            {!scenarioFormOpen ? (
              <button style={s.addScenarioBtn} onClick={() => { setScenarioFormOpen(true); setScenarioForm({ ...EMPTY_FORM, currency: workingCurrency, label: '' }); }}>
                <Plus size={14} /> Add Scenario
              </button>
            ) : (
              <div style={s.scenarioFormCard}>
                <div style={s.formGroup}>
                  <label style={s.label}>Scenario label *</label>
                  <input style={s.input} type="text" placeholder='e.g. "If I get a scholarship"' value={scenarioForm.label}
                    onChange={e => setScenarioForm(f => ({ ...f, label: e.target.value }))} />
                </div>
                <div style={s.typeToggle}>
                  <button style={{ ...s.typeBtn, ...(scenarioForm.type === 'EXPENSE' ? s.typeBtnExpense : s.typeBtnInactive) }} onClick={() => handleScenarioTypeChange('EXPENSE')}>
                    <TrendingDown size={13} /> Expense
                  </button>
                  <button style={{ ...s.typeBtn, ...(scenarioForm.type === 'INCOME' ? s.typeBtnIncome : s.typeBtnInactive) }} onClick={() => handleScenarioTypeChange('INCOME')}>
                    <TrendingUp size={13} /> Income
                  </button>
                </div>
                <div style={s.formRow}>
                  <div style={{ ...s.formGroup, flex: 2 }}>
                    <label style={s.label}>Amount *</label>
                    <input style={s.input} type="number" min="0.01" step="0.01" placeholder="0.00" value={scenarioForm.amount}
                      onChange={e => setScenarioForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div style={{ ...s.formGroup, flex: 1 }}>
                    <label style={s.label}>Currency</label>
                    <select style={s.input} value={scenarioForm.currency} onChange={e => setScenarioForm(f => ({ ...f, currency: e.target.value }))}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Category</label>
                  <select style={s.input} value={scenarioForm.category}
                    onChange={e => setScenarioForm(f => ({ ...f, category: e.target.value as Category }))}>
                    {(scenarioForm.type === 'INCOME' ? INCOME_CATS : EXPENSE_CATS).map(c => (
                      <option key={c} value={c}>{CAT_EMOJI[c]} {CAT_LABEL[c]}</option>
                    ))}
                  </select>
                </div>
                {scenarioError && <p style={s.errorText}>{scenarioError}</p>}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button style={s.cancelBtn} onClick={() => setScenarioFormOpen(false)}>Cancel</button>
                  <button style={s.saveBtn} onClick={addScenario}>Add to Simulation</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Forecast Setup ─── */}
      <div style={s.fcSection}>
        <button style={s.fcToggle} onClick={() => setFcOpen(o => !o)}>
          <span>📅</span>
          <span>Forecast Setup</span>
          <span style={{ fontSize: '0.78em', opacity: 0.55, fontWeight: 400, marginLeft: '6px' }}>
            — tell Chronos-2 about upcoming expenses &amp; breaks
          </span>
          <ChevronRight size={14} style={{ marginLeft: 'auto', transform: fcOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', opacity: 0.5 }} />
        </button>

        {fcOpen && (
          <div style={s.fcBody}>
            {/* Year picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <span style={s.fcLabel}>Year:</span>
              <div style={s.selectWrap}>
                <select style={s.select} value={fcYear} onChange={e => setFcYear(Number(e.target.value))}>
                  {Array.from({ length: 4 }, (_, i) => today.getFullYear() - 1 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown size={13} style={s.chevron} />
              </div>
              <span style={{ fontSize: '0.78em', color: 'var(--brand-rose)', opacity: 0.45 }}>
                Click a month to edit its forecast inputs
              </span>
            </div>

            {/* Month grid */}
            <div style={s.fcMonthGrid}>
              {MONTHS.map((name, i) => {
                const m = i + 1;
                const key = `${fcYear}-${m}`;
                const hasSaved = Boolean(fcContexts[key]);
                const isSelected = fcMonth === m;
                return (
                  <button
                    key={m}
                    style={{
                      ...s.fcMonthBtn,
                      ...(isSelected ? s.fcMonthBtnActive : {}),
                      ...(hasSaved && !isSelected ? s.fcMonthBtnSaved : {}),
                    }}
                    onClick={() => handleFcMonthSelect(m)}
                  >
                    {name.slice(0, 3)}
                    {hasSaved && <span style={s.fcDot} />}
                  </button>
                );
              })}
            </div>

            {/* Form for selected month */}
            <div style={s.fcFormCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ color: 'var(--brand-gold)', fontWeight: 700, fontSize: '0.95em' }}>
                  {MONTHS[fcMonth - 1]} {fcYear}
                </span>
                <button style={s.fcCopyBtn} onClick={() => { setFcCopyOpen(true); setFcCopyYear(fcYear); setFcCopyMonths(Array(12).fill(false)); }}>
                  Copy to months…
                </button>
              </div>

              <div style={s.fcGrid}>
                <div style={s.formGroup}>
                  <label style={s.label}>Hours/week working</label>
                  <input style={s.input} type="number" min="0" max="168" placeholder="e.g. 20"
                    value={fcForm.hours_per_week}
                    onChange={e => setFcForm(f => ({ ...f, hours_per_week: e.target.value }))} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Rent this month ($)</label>
                  <input style={s.input} type="number" min="0" placeholder="e.g. 750"
                    value={fcForm.rent}
                    onChange={e => setFcForm(f => ({ ...f, rent: e.target.value }))} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Tuition due ($)</label>
                  <input style={s.input} type="number" min="0" placeholder="0 if none"
                    value={fcForm.tuition_due}
                    onChange={e => setFcForm(f => ({ ...f, tuition_due: e.target.value }))} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Scholarship received ($)</label>
                  <input style={s.input} type="number" min="0" placeholder="0 if none"
                    value={fcForm.scholarship_received}
                    onChange={e => setFcForm(f => ({ ...f, scholarship_received: e.target.value }))} />
                </div>
                {fcForm.travel_home && (
                  <div style={{ ...s.formGroup, gridColumn: '1 / -1' }}>
                    <label style={s.label}>✈️ Flight + travel cost this month ($)</label>
                    <input style={s.input} type="number" min="0" placeholder="e.g. 1400"
                      value={fcForm.travel_cost}
                      onChange={e => setFcForm(f => ({ ...f, travel_cost: e.target.value }))} />
                  </div>
                )}
              </div>

              <div style={s.fcCheckRow}>
                {([
                  ['is_working', 'Have income this month'],
                  ['is_summer_break', 'Summer break (May–Aug)'],
                  ['is_winter_break', 'Winter break (Dec–Jan)'],
                  ['travel_home', '✈️ Flying home this month'],
                ] as [keyof FcData, string][]).map(([key, label]) => (
                  <label key={key} style={s.checkRow}>
                    <input type="checkbox"
                      checked={fcForm[key] as boolean}
                      onChange={e => setFcForm(f => ({ ...f, [key]: e.target.checked }))}
                      style={{ accentColor: 'var(--brand-gold)' }} />
                    <span style={{ color: 'var(--brand-rose)', fontSize: '0.85em' }}>{label}</span>
                  </label>
                ))}
              </div>

              <button style={{ ...s.saveBtn, marginTop: '14px', flex: 'none', padding: '10px 28px', alignSelf: 'flex-start' }}
                onClick={handleFcSave} disabled={fcSaving}>
                {fcSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Copy-to-months modal ─── */}
      {fcCopyOpen && (
        <div style={s.overlay} onClick={() => setFcCopyOpen(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Copy {MONTHS[fcMonth - 1]} {fcYear} values to…</h2>
              <button style={s.closeBtn} onClick={() => setFcCopyOpen(false)}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={s.fcLabel}>Target year:</span>
              <div style={s.selectWrap}>
                <select style={s.select} value={fcCopyYear} onChange={e => setFcCopyYear(Number(e.target.value))}>
                  {Array.from({ length: 4 }, (_, i) => today.getFullYear() - 1 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown size={13} style={s.chevron} />
              </div>
              <button style={s.fcLinkBtn} onClick={() => setFcCopyMonths(Array(12).fill(true))}>All</button>
              <button style={s.fcLinkBtn} onClick={() => setFcCopyMonths(Array(12).fill(false))}>None</button>
            </div>

            <div style={s.fcMonthGrid}>
              {MONTHS.map((name, i) => (
                <label key={i} style={{
                  ...s.fcMonthBtn,
                  ...(fcCopyMonths[i] ? s.fcMonthBtnActive : {}),
                  cursor: 'pointer', userSelect: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                }}>
                  <input type="checkbox" checked={fcCopyMonths[i]}
                    onChange={e => setFcCopyMonths(prev => { const n = [...prev]; n[i] = e.target.checked; return n; })}
                    style={{ accentColor: 'var(--brand-gold)', marginBottom: '2px' }} />
                  {name.slice(0, 3)}
                </label>
              ))}
            </div>

            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setFcCopyOpen(false)}>Cancel</button>
              <button style={s.saveBtn} onClick={handleFcCopy} disabled={fcSaving}>
                {fcSaving ? 'Copying…' : `Copy to ${fcCopyMonths.filter(Boolean).length} month${fcCopyMonths.filter(Boolean).length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Import Modal ─── */}
      {importOpen && (
        <div style={s.overlay} onClick={closeImport}>
          <div style={{ ...s.modal, maxWidth: '560px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>
                {importStep === 'upload' ? 'Import Transactions' : importStep === 'review' ? `Review: ${importPreview?.filename}` : 'Import Complete'}
              </h2>
              <button style={s.closeBtn} onClick={closeImport}><X size={18} /></button>
            </div>

            {/* Step 1 — Upload */}
            {importStep === 'upload' && (
              <div style={{ padding: '8px 0' }}>
                <p style={{ color: 'var(--brand-rose)', opacity: 0.65, fontSize: '0.88em', marginBottom: '20px' }}>
                  Supports Excel (.xlsx, .xls) and CSV files from any bank. Columns are auto-detected.
                </p>
                <div
                  style={{ border: '2px dashed var(--brand-gold)', borderRadius: '10px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', opacity: importLoading ? 0.5 : 1 }}
                  onClick={() => importFileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImportFile(f); }}
                >
                  <Upload size={32} style={{ color: 'var(--brand-gold)', marginBottom: '12px' }} />
                  <p style={{ color: 'var(--brand-rose)', margin: 0, fontWeight: 600 }}>
                    {importLoading ? 'Analyzing file…' : 'Drop file here or click to browse'}
                  </p>
                  <p style={{ color: 'var(--brand-rose)', opacity: 0.45, fontSize: '0.8em', margin: '6px 0 0' }}>
                    .xlsx  ·  .xls  ·  .csv
                  </p>
                </div>
                <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
              </div>
            )}

            {/* Step 2 — Review */}
            {importStep === 'review' && importPreview && (
              <div>
                {importPreview.warnings.length > 0 && (
                  <div style={{ background: '#2a1f00', border: '1px solid #7a5a00', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                    {importPreview.warnings.map((w, i) => (
                      <p key={i} style={{ color: '#fbbf24', fontSize: '0.82em', margin: i === 0 ? 0 : '6px 0 0' }}>⚠ {w}</p>
                    ))}
                  </div>
                )}

                {/* Detected column map */}
                <p style={{ color: 'var(--brand-rose)', opacity: 0.65, fontSize: '0.82em', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Column Mapping
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                  {['date', 'amount', 'debit', 'credit', 'description', 'category', 'currency', 'type'].map(field => (
                    <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ ...s.label, fontSize: '0.75em' }}>{field}</label>
                      <select style={{ ...s.input, fontSize: '0.82em', padding: '5px 8px' }}
                        value={importColMap[field] ?? ''}
                        onChange={e => setImportColMap(m => ({ ...m, [field]: e.target.value }))}>
                        <option value="">— not mapped —</option>
                        {importPreview.all_columns.map(col => <option key={col} value={col}>{col}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Defaults for undetected */}
                {importPreview.undetected.includes('currency') && (
                  <div style={s.formGroup}>
                    <label style={s.label}>Default currency for unmapped rows</label>
                    <select style={s.input} value={importDefCurrency} onChange={e => setImportDefCurrency(e.target.value)}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                {importPreview.undetected.includes('category') && (
                  <div style={s.formGroup}>
                    <label style={s.label}>Default category when description can't be matched</label>
                    <select style={s.input} value={importDefCategory} onChange={e => setImportDefCategory(e.target.value)}>
                      {[...INCOME_CATS, ...EXPENSE_CATS].filter((v, i, a) => a.indexOf(v) === i).map(c => (
                        <option key={c} value={c}>{CAT_EMOJI[c]} {CAT_LABEL[c]}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Preview table */}
                {importPreview.preview_rows.length > 0 && (
                  <>
                    <p style={{ color: 'var(--brand-rose)', opacity: 0.65, fontSize: '0.82em', margin: '16px 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Preview (first {importPreview.preview_rows.length} rows)
                    </p>
                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8em' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                            {['date', 'amount', 'type', 'category', 'currency', 'description'].map(h => (
                              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--brand-rose)', opacity: 0.55, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.preview_rows.map((row, i) => (
                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                              {['date', 'amount', 'type', 'category', 'currency', 'description'].map(h => (
                                <td key={h} style={{ padding: '6px 10px', color: 'var(--brand-rose)', opacity: 0.8, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {String(row[h] ?? '—')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ color: 'var(--brand-rose)', opacity: 0.4, fontSize: '0.78em', marginTop: '6px' }}>
                      {importPreview.total_rows} total rows will be imported
                    </p>
                  </>
                )}

                <div style={{ ...s.modalFooter, marginTop: '20px' }}>
                  <button style={s.cancelBtn} onClick={() => setImportStep('upload')}>Back</button>
                  <button style={s.saveBtn} onClick={handleImportConfirm} disabled={importLoading || !importColMap['date']}>
                    {importLoading ? 'Importing…' : `Import ${importPreview.total_rows} rows`}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Done */}
            {importStep === 'done' && importResult && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>✅</div>
                <p style={{ color: '#4ade80', fontWeight: 700, fontSize: '1.1em', margin: '0 0 6px' }}>
                  {importResult.imported} transaction{importResult.imported !== 1 ? 's' : ''} imported
                </p>
                {importResult.skipped > 0 && (
                  <p style={{ color: 'var(--brand-rose)', opacity: 0.55, fontSize: '0.85em', margin: '4px 0' }}>
                    {importResult.skipped} rows skipped (missing date or amount)
                  </p>
                )}
                {importResult.errors.length > 0 && (
                  <div style={{ background: '#2a1010', border: '1px solid #7a2020', borderRadius: '8px', padding: '10px', marginTop: '12px', textAlign: 'left' }}>
                    {importResult.errors.map((e, i) => <p key={i} style={{ color: '#f87171', fontSize: '0.78em', margin: i === 0 ? 0 : '4px 0 0' }}>{e}</p>)}
                  </div>
                )}
                <button style={{ ...s.saveBtn, marginTop: '20px' }} onClick={closeImport}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Add/Edit Modal ─── */}
      {modalOpen && (
        <div style={s.overlay} onClick={closeModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editingId ? 'Edit Transaction' : 'Add Transaction'}</h2>
              <button style={s.closeBtn} onClick={closeModal}><X size={18} /></button>
            </div>

            <div style={s.typeToggle}>
              <button style={{ ...s.typeBtn, ...(form.type === 'EXPENSE' ? s.typeBtnExpense : s.typeBtnInactive) }} onClick={() => handleTypeChange('EXPENSE')}>
                <TrendingDown size={14} /> Expense
              </button>
              <button style={{ ...s.typeBtn, ...(form.type === 'INCOME' ? s.typeBtnIncome : s.typeBtnInactive) }} onClick={() => handleTypeChange('INCOME')}>
                <TrendingUp size={14} /> Income
              </button>
            </div>

            <div style={s.formGrid}>
              <div style={s.formRow}>
                <div style={{ ...s.formGroup, flex: 2 }}>
                  <label style={s.label}>Amount *</label>
                  <input style={s.input} type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Currency</label>
                  <select style={s.input} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Live preview of working/home currency */}
              {form.amount && parseFloat(form.amount) > 0 && form.currency !== workingCurrency && (
                <div style={s.previewRow}>
                  <span style={s.previewLabel}>≈ in {workingCurrency}:</span>
                  <span style={s.previewValue}>{fmt(convert(parseFloat(form.amount), form.currency, workingCurrency), workingCurrency)}</span>
                  {homeCurrency !== workingCurrency && (
                    <>
                      <span style={{ ...s.previewLabel, marginLeft: '12px' }}>≈ {homeCurrency}:</span>
                      <span style={{ ...s.previewValue, opacity: 0.6 }}>{fmt(convert(parseFloat(form.amount), form.currency, homeCurrency), homeCurrency)}</span>
                    </>
                  )}
                </div>
              )}

              <div style={s.formGroup}>
                <label style={s.label}>Category</label>
                <select style={s.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
                  {currentCats.map(c => <option key={c} value={c}>{CAT_EMOJI[c]} {CAT_LABEL[c]}</option>)}
                </select>
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>{form.is_recurring ? 'Start Date *' : 'Date *'}</label>
                <input style={s.input} type="date" value={form.transaction_date}
                  onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} />
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>Description <span style={{ opacity: 0.4 }}>(optional)</span></label>
                <input style={s.input} type="text" maxLength={500} placeholder="e.g. Grocery run" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <label style={s.checkRow}>
                <input type="checkbox" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))}
                  style={{ accentColor: 'var(--brand-gold)' }} />
                <span style={{ color: 'var(--brand-rose)', fontSize: '0.9em' }}>Recurring transaction</span>
              </label>

              {form.is_recurring && (
                <div style={s.formGroup}>
                  <label style={s.label}>How often?</label>
                  <div style={s.selectWrap}>
                    <select style={s.input} value={form.recurring_frequency}
                      onChange={e => setForm(f => ({ ...f, recurring_frequency: e.target.value as RecurFreq }))}>
                      {(Object.keys(FREQ_LABEL) as RecurFreq[]).map(f => (
                        <option key={f} value={f}>{FREQ_LABEL[f]}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} style={s.chevron} />
                  </div>
                </div>
              )}
            </div>

            {formError && <p style={s.errorText}>{formError}</p>}

            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={closeModal}>Cancel</button>
              <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '900px', margin: '0 auto', position: 'relative' },
  centered: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '1.8em', fontWeight: 700, color: 'var(--brand-gold)', margin: 0 },
  subtitle: { color: 'var(--brand-rose)', opacity: 0.65, margin: '4px 0 0', fontSize: '0.85em' },
  addBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'linear-gradient(135deg, var(--brand-gold), var(--brand-gold-dark))', color: 'var(--brand-maroon)', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95em', cursor: 'pointer' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' },
  card: { padding: '20px', borderRadius: '12px', border: '1px solid', background: 'rgba(255,255,255,0.04)' },
  cardLabel: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand-rose)', fontSize: '0.82em', marginBottom: '8px', opacity: 0.75 },
  cardValue: { fontSize: '1.45em', fontWeight: 700 },
  filters: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' },
  tabs: { display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '4px' },
  tab: { padding: '6px 16px', borderRadius: '7px', border: 'none', background: 'transparent', color: 'var(--brand-rose)', cursor: 'pointer', fontSize: '0.88em', fontWeight: 500 },
  tabActive: { background: 'linear-gradient(135deg, var(--brand-gold), var(--brand-gold-dark))', color: 'var(--brand-maroon)', fontWeight: 700 },
  dateFilters: { display: 'flex', gap: '8px' },
  selectWrap: { position: 'relative' },
  select: { padding: '8px 28px 8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--brand-rose)', fontSize: '0.875em', cursor: 'pointer', appearance: 'none' },
  chevron: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--brand-rose)', opacity: 0.5 },
  list: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' },
  txRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' },
  txEmoji: { fontSize: '1.4em', width: '34px', textAlign: 'center', flexShrink: 0 },
  txMeta: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 },
  txCategory: { fontWeight: 600, color: 'var(--brand-rose)', fontSize: '0.93em' },
  txDesc: { fontSize: '0.78em', color: 'var(--brand-rose)', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  txBadges: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' },
  txDate: { fontSize: '0.75em', color: 'var(--brand-rose)', opacity: 0.4 },
  recurBadge: { background: 'rgba(255,215,0,0.12)', color: 'var(--brand-gold)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72em', fontWeight: 500 },
  genBadge: { background: 'rgba(99,179,237,0.12)', color: '#63b3ed', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72em' },
  origBadge: { background: 'rgba(255,255,255,0.07)', color: 'var(--brand-rose)', opacity: 0.55, padding: '1px 6px', borderRadius: '4px', fontSize: '0.72em' },
  homeBadge: { background: 'rgba(167,139,250,0.12)', color: '#a78bfa', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72em' },
  txRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 },
  txAmount: { fontWeight: 700, fontSize: '0.95em' },
  txActions: { display: 'flex', gap: '4px' },
  iconBtn: { padding: '4px 6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--brand-rose)', opacity: 0.6, cursor: 'pointer', display: 'flex', alignItems: 'center' },
  empty: { textAlign: 'center', padding: '50px 20px' },
  emptyIcon: { fontSize: '3em', marginBottom: '12px' },
  emptyText: { color: 'var(--brand-rose)', opacity: 0.5, marginBottom: '16px' },
  addBtnSm: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'linear-gradient(135deg, var(--brand-gold), var(--brand-gold-dark))', color: 'var(--brand-maroon)', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' },
  // Scenario
  scenarioSection: { marginTop: '8px', borderRadius: '12px', border: '1px solid rgba(167,139,250,0.25)', overflow: 'hidden' },
  scenarioToggle: { width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: 'rgba(167,139,250,0.06)', border: 'none', cursor: 'pointer', color: 'var(--brand-rose)', fontSize: '0.95em', fontWeight: 600 },
  scenarioBadge: { background: '#7c3aed', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75em', fontWeight: 700 },
  scenarioBody: { padding: '16px', background: 'rgba(167,139,250,0.03)', display: 'flex', flexDirection: 'column', gap: '12px' },
  scenarioHint: { color: 'var(--brand-rose)', opacity: 0.55, fontSize: '0.82em', margin: 0 },
  simCards: { display: 'flex', gap: '12px' },
  simCard: { flex: 1, padding: '12px 16px', borderRadius: '10px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', flexDirection: 'column', gap: '4px' },
  simLabel: { fontSize: '0.78em', color: 'var(--brand-rose)', opacity: 0.6 },
  simValue: { fontSize: '1.2em', fontWeight: 700 },
  scenarioRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(167,139,250,0.06)', border: '1px dashed rgba(167,139,250,0.2)' },
  scenarioRowEmoji: { fontSize: '1.2em', width: '28px', textAlign: 'center', flexShrink: 0 },
  scenarioRowMeta: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  scenarioRowLabel: { fontSize: '0.88em', fontWeight: 600, color: '#a78bfa' },
  scenarioRowSub: { fontSize: '0.75em', color: 'var(--brand-rose)', opacity: 0.5 },
  scenarioRowAmt: { fontWeight: 700, fontSize: '0.9em' },
  addScenarioBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: '8px', color: '#a78bfa', cursor: 'pointer', fontSize: '0.85em', fontWeight: 600, alignSelf: 'flex-start' },
  scenarioFormCard: { padding: '16px', background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modal: { background: 'var(--brand-maroon-dark, #1a0a0a)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle: { color: 'var(--brand-gold)', fontSize: '1.25em', fontWeight: 700, margin: 0 },
  closeBtn: { background: 'transparent', border: 'none', color: 'var(--brand-rose)', cursor: 'pointer', opacity: 0.6 },
  typeToggle: { display: 'flex', gap: '8px', marginBottom: '16px' },
  typeBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: '8px', border: '1px solid transparent', fontWeight: 600, cursor: 'pointer', fontSize: '0.88em', transition: 'all 0.2s' },
  typeBtnExpense: { background: 'rgba(248,113,113,0.15)', borderColor: '#f87171', color: '#f87171' },
  typeBtnIncome: { background: 'rgba(74,222,128,0.15)', borderColor: '#4ade80', color: '#4ade80' },
  typeBtnInactive: { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--brand-rose)', opacity: 0.5 },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '14px' },
  formRow: { display: 'flex', gap: '12px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  label: { fontSize: '0.8em', color: 'var(--brand-rose)', opacity: 0.65, fontWeight: 500 },
  input: { padding: '10px 12px', borderRadius: '8px', width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--brand-rose)', fontSize: '0.9em', outline: 'none', boxSizing: 'border-box' },
  previewRow: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '7px', background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.15)' },
  previewLabel: { fontSize: '0.8em', color: 'var(--brand-rose)', opacity: 0.6 },
  previewValue: { fontSize: '0.88em', fontWeight: 600, color: 'var(--brand-gold)' },
  checkRow: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  errorText: { color: '#f87171', fontSize: '0.82em', marginTop: '6px', textAlign: 'center' },
  modalFooter: { display: 'flex', gap: '10px', marginTop: '20px' },
  cancelBtn: { flex: 1, padding: '11px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--brand-rose)', cursor: 'pointer', fontWeight: 500 },
  saveBtn: { flex: 2, padding: '11px', borderRadius: '8px', background: 'linear-gradient(135deg, var(--brand-gold), var(--brand-gold-dark))', color: 'var(--brand-maroon)', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.92em' },
  toast: { position: 'fixed', bottom: '24px', right: '24px', zIndex: 2000, padding: '12px 20px', borderRadius: '10px', border: '1px solid', color: '#fff', fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' },
  // Forecast Setup
  fcSection: { marginTop: '16px', borderRadius: '12px', border: '1px solid rgba(99,179,237,0.25)', overflow: 'hidden' },
  fcToggle: { width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', background: 'rgba(99,179,237,0.06)', border: 'none', cursor: 'pointer', color: 'var(--brand-rose)', fontSize: '0.95em', fontWeight: 600 },
  fcBody: { padding: '16px', background: 'rgba(99,179,237,0.03)', display: 'flex', flexDirection: 'column' as const, gap: '0' },
  fcLabel: { fontSize: '0.82em', color: 'var(--brand-rose)', opacity: 0.65, fontWeight: 500, whiteSpace: 'nowrap' as const },
  fcMonthGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '14px' },
  fcMonthBtn: { padding: '8px 4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--brand-rose)', fontSize: '0.82em', fontWeight: 500, cursor: 'pointer', position: 'relative' as const, textAlign: 'center' as const },
  fcMonthBtnActive: { background: 'linear-gradient(135deg, var(--brand-gold), var(--brand-gold-dark))', color: 'var(--brand-maroon)', fontWeight: 700, border: '1px solid var(--brand-gold)' },
  fcMonthBtnSaved: { border: '1px solid rgba(99,179,237,0.5)', color: '#63b3ed' },
  fcDot: { position: 'absolute' as const, top: 3, right: 5, width: '5px', height: '5px', borderRadius: '50%', background: '#63b3ed' },
  fcFormCard: { padding: '16px', background: 'rgba(99,179,237,0.05)', border: '1px solid rgba(99,179,237,0.15)', borderRadius: '10px', display: 'flex', flexDirection: 'column' as const, gap: '0' },
  fcGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '14px' },
  fcCheckRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '10px 24px', marginBottom: '4px' },
  fcCopyBtn: { padding: '5px 14px', borderRadius: '7px', background: 'rgba(99,179,237,0.12)', border: '1px solid rgba(99,179,237,0.3)', color: '#63b3ed', fontSize: '0.82em', fontWeight: 600, cursor: 'pointer' },
  fcLinkBtn: { background: 'transparent', border: 'none', color: '#63b3ed', fontSize: '0.82em', cursor: 'pointer', padding: '0 4px', textDecoration: 'underline' },
};