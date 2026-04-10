import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import '../styles/faq.css';

const API = 'http://localhost:8000/api/v1';

const CATEGORIES = ['Visa & Work', 'Banking', 'Taxes', 'Financial Planning', 'Campus Life', 'General'];

interface FAQItem {
  id: string;
  section?: string;
  category?: string;
  question: string;
  answer: string;
  source?: 'static' | 'community';
}

interface Submission {
  id: string;
  question: string;
  category: string | null;
  status: 'pending' | 'approved' | 'rejected';
  answer: string | null;
  created_at: string;
}

type AdminTab = 'faq' | 'admin';

export default function FAQ() {
  const { user } = useContext(AuthContext)!;
  const [items, setItems] = useState<FAQItem[]>([]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('faq');

  // Submit modal
  const [showModal, setShowModal] = useState(false);
  const [submitQ, setSubmitQ] = useState('');
  const [submitCat, setSubmitCat] = useState('General');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  // My submissions
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);

  // Admin
  const [pendingItems, setPendingItems] = useState<Submission[]>([]);
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);

  const token = user?.accessToken ?? '';
  const isAdmin = !!(user?.email?.endsWith('@fullerton.edu'));

  const authHeaders = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch(`${API}/faq`, { headers: authHeaders })
      .then(r => r.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/faq/my-submissions`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : [])
      .then(setMySubmissions)
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'admin') return;
    fetch(`${API}/faq/pending`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : [])
      .then(setPendingItems)
      .catch(() => {});
  }, [isAdmin, activeTab]);

  const handleSubmit = async () => {
    if (!submitQ.trim()) return;
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const res = await fetch(`${API}/faq/submit`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ question: submitQ.trim(), category: submitCat }),
      });
      if (res.ok) {
        const s = await res.json() as Submission;
        setMySubmissions(prev => [s, ...prev]);
        setSubmitQ('');
        setSubmitMsg('Your question has been submitted! We\'ll notify you when it\'s answered.');
        setTimeout(() => { setShowModal(false); setSubmitMsg(''); }, 2000);
      } else {
        setSubmitMsg('Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    setReviewing(id);
    try {
      const res = await fetch(`${API}/faq/submissions/${id}/review`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status, answer: reviewAnswers[id] || '' }),
      });
      if (res.ok) {
        setPendingItems(prev => prev.filter(p => p.id !== id));
        if (status === 'approved') {
          const updated = await res.json() as Submission;
          setItems(prev => [...prev, {
            id: updated.id,
            question: updated.question,
            answer: updated.answer || '',
            category: updated.category || 'General',
            source: 'community',
          }]);
        }
      }
    } finally {
      setReviewing(null);
    }
  };

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    return !q || item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
  });

  const section = (item: FAQItem) => item.section || item.category || 'General';
  const sections = [...new Set(filtered.map(section))];

  const statusColor: Record<string, string> = {
    pending: '#f59e0b',
    approved: '#2dd4bf',
    rejected: '#f87171',
  };

  return (
    <div className="faq-root">
      <div className="faq-header">
        <h1>FAQ & Resources</h1>
        <p>Common questions for international students — answered by alumni and advisors.</p>
      </div>

      {isAdmin && (
        <div className="faq-tabs">
          <button className={`faq-tab${activeTab === 'faq' ? ' active' : ''}`} onClick={() => setActiveTab('faq')}>FAQ</button>
          <button className={`faq-tab${activeTab === 'admin' ? ' active' : ''}`} onClick={() => setActiveTab('admin')}>
            Admin Panel {pendingItems.length > 0 && <span className="faq-badge">{pendingItems.length}</span>}
          </button>
        </div>
      )}

      {activeTab === 'admin' && isAdmin ? (
        <div className="faq-admin-panel">
          <h3 className="faq-admin-title">Pending Questions</h3>
          {pendingItems.length === 0 ? (
            <p className="faq-empty">No pending questions.</p>
          ) : pendingItems.map(p => (
            <div key={p.id} className="faq-admin-item">
              <p className="faq-admin-question">{p.question}</p>
              <p className="faq-admin-meta">{p.category || 'General'} · {new Date(p.created_at).toLocaleDateString()}</p>
              <textarea
                className="faq-admin-answer-input"
                placeholder="Write your answer…"
                value={reviewAnswers[p.id] || ''}
                onChange={e => setReviewAnswers(prev => ({ ...prev, [p.id]: e.target.value }))}
                rows={3}
              />
              <div className="faq-admin-actions">
                <button className="faq-admin-btn approve" onClick={() => handleReview(p.id, 'approved')} disabled={reviewing === p.id}>
                  {reviewing === p.id ? '…' : 'Approve & Publish'}
                </button>
                <button className="faq-admin-btn reject" onClick={() => handleReview(p.id, 'rejected')} disabled={reviewing === p.id}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="faq-search-row">
            <input
              className="faq-search"
              placeholder="Search questions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {token && (
              <button className="faq-ask-btn" onClick={() => setShowModal(true)}>+ Ask a Question</button>
            )}
          </div>

          {filtered.length === 0 && (
            <div className="faq-empty">No questions match your search.</div>
          )}

          {sections.map(sec => (
            <div key={sec} className="faq-section">
              <div className="faq-section-title">{sec}</div>
              {filtered.filter(i => section(i) === sec).map(item => (
                <div key={item.id} className="faq-item">
                  <button
                    className={`faq-question${openId === item.id ? ' open' : ''}`}
                    onClick={() => setOpenId(openId === item.id ? null : item.id)}
                  >
                    <span>{item.question}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {item.source === 'community' && (
                        <span className="faq-community-badge">Community</span>
                      )}
                      <span className="faq-chevron">▼</span>
                    </div>
                  </button>
                  {openId === item.id && (
                    <div className="faq-answer">{item.answer}</div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {mySubmissions.length > 0 && (
            <div className="faq-my-submissions">
              <h3 className="faq-my-title">My Questions</h3>
              {mySubmissions.map(s => (
                <div key={s.id} className="faq-my-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <p className="faq-my-question">{s.question}</p>
                    <span className="faq-status-badge" style={{ background: `${statusColor[s.status]}20`, color: statusColor[s.status], border: `1px solid ${statusColor[s.status]}40` }}>
                      {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                    </span>
                  </div>
                  {s.answer && <p className="faq-my-answer">{s.answer}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Submit modal */}
      {showModal && (
        <div className="faq-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="faq-modal">
            <h3 className="faq-modal-title">Ask a Question</h3>
            <p className="faq-modal-sub">Your question will be reviewed and answered by alumni or advisors.</p>
            <label className="faq-modal-label">Category</label>
            <select className="faq-modal-select" value={submitCat} onChange={e => setSubmitCat(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="faq-modal-label">Your question</label>
            <textarea
              className="faq-modal-textarea"
              placeholder="e.g. Can I work on-campus during winter break on an F-1 visa?"
              value={submitQ}
              onChange={e => setSubmitQ(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            {submitMsg && <p className="faq-modal-msg">{submitMsg}</p>}
            <div className="faq-modal-actions">
              <button className="faq-modal-btn submit" onClick={handleSubmit} disabled={submitting || !submitQ.trim()}>
                {submitting ? 'Submitting…' : 'Submit Question'}
              </button>
              <button className="faq-modal-btn cancel" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
