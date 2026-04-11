import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import '../styles/faq.css';
import { API } from '../lib/api';

const CATEGORIES = ['Visa & Work', 'Banking', 'Taxes', 'Financial Planning', 'Campus Life', 'General'];

interface CommunityAnswer {
  id: string;
  user_id: string;
  author_name: string;
  answer_text: string;
  created_at: string;
}

interface FAQItem {
  id: string;
  section?: string;
  category?: string;
  question: string;
  answer: string;
  source?: 'static' | 'community';
  answers?: CommunityAnswer[];
}

interface Submission {
  id: string;
  question: string;
  category: string | null;
  status: 'open' | 'approved' | 'rejected';
  answer: string | null;
  answers: CommunityAnswer[];
  created_at: string;
}

type AdminTab = 'faq' | 'admin';

export default function FAQ() {
  const { user } = useContext(AuthContext)!;
  const [items, setItems] = useState<FAQItem[]>([]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('faq');

  // Ask question modal
  const [showModal, setShowModal] = useState(false);
  const [submitQ, setSubmitQ] = useState('');
  const [submitCat, setSubmitCat] = useState('General');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Answer modal
  const [answerTarget, setAnswerTarget] = useState<FAQItem | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState('');

  // My questions
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);

  // Admin
  const [pendingItems, setPendingItems] = useState<Submission[]>([]);
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);

  const token = user?.accessToken ?? '';
  const isAdmin = !!(user?.email?.endsWith('@fullerton.edu'));
  const authHeaders = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

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
    setSubmitError('');
    try {
      const res = await fetch(`${API}/faq/submit`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ question: submitQ.trim(), category: submitCat }),
      });
      if (res.ok) {
        const s = await res.json() as Submission;
        // Add to items list immediately so it appears for everyone
        setItems(prev => [...prev, {
          id: s.id,
          question: s.question,
          answer: s.answer || '',
          category: s.category || 'Community',
          source: 'community',
          answers: [],
        }]);
        setMySubmissions(prev => [s, ...prev]);
        setSubmitQ('');
        setSubmitMsg('Your question is live! Anyone can answer it.');
        setTimeout(() => { setShowModal(false); setSubmitMsg(''); }, 2000);
      } else {
        const err = await res.json().catch(() => ({}));
        setSubmitError((err as { detail?: string }).detail || 'Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostAnswer = async () => {
    if (!answerTarget || !answerText.trim()) return;
    setAnswerSubmitting(true);
    setAnswerError('');
    try {
      const res = await fetch(`${API}/faq/questions/${answerTarget.id}/answer`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ answer_text: answerText.trim() }),
      });
      if (res.ok) {
        const newAnswer = await res.json() as CommunityAnswer;
        setItems(prev => prev.map(item =>
          item.id === answerTarget.id
            ? { ...item, answers: [...(item.answers || []), newAnswer] }
            : item
        ));
        setAnswerText('');
        setAnswerTarget(null);
      } else {
        const err = await res.json().catch(() => ({}));
        setAnswerError((err as { detail?: string }).detail || 'Could not post answer. Please try again.');
      }
    } finally {
      setAnswerSubmitting(false);
    }
  };

  const handleDeleteAnswer = async (questionId: string, answerId: string) => {
    const res = await fetch(`${API}/faq/answers/${answerId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok || res.status === 204) {
      setItems(prev => prev.map(item =>
        item.id === questionId
          ? { ...item, answers: (item.answers || []).filter(a => a.id !== answerId) }
          : item
      ));
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
      }
    } finally {
      setReviewing(null);
    }
  };

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    if (!q) return true;
    if (item.question.toLowerCase().includes(q)) return true;
    if (item.answer?.toLowerCase().includes(q)) return true;
    if (item.answers?.some(a => a.answer_text.toLowerCase().includes(q))) return true;
    return false;
  });

  const section = (item: FAQItem) => item.section || item.category || 'General';
  const sections = [...new Set(filtered.map(section))];

  const statusColor: Record<string, string> = {
    open: '#2dd4bf',
    approved: '#2dd4bf',
    rejected: '#f87171',
  };

  const statusLabel: Record<string, string> = {
    open: 'Live',
    approved: 'Answered',
    rejected: 'Removed',
  };

  return (
    <div className="faq-root">
      <div className="faq-header">
        <h1>Community Q&A</h1>
        <p>Ask anything about student finance, visa rules, or campus life — anyone can answer.</p>
      </div>

      {isAdmin && (
        <div className="faq-tabs">
          <button className={`faq-tab${activeTab === 'faq' ? ' active' : ''}`} onClick={() => setActiveTab('faq')}>Q&A</button>
          <button className={`faq-tab${activeTab === 'admin' ? ' active' : ''}`} onClick={() => setActiveTab('admin')}>
            Moderate {pendingItems.length > 0 && <span className="faq-badge">{pendingItems.length}</span>}
          </button>
        </div>
      )}

      {activeTab === 'admin' && isAdmin ? (
        <div className="faq-admin-panel">
          <h3 className="faq-admin-title">All Community Questions</h3>
          {pendingItems.length === 0 ? (
            <p className="faq-empty">No open questions.</p>
          ) : pendingItems.map(p => (
            <div key={p.id} className="faq-admin-item">
              <p className="faq-admin-question">{p.question}</p>
              <p className="faq-admin-meta">{p.category || 'General'} · {new Date(p.created_at).toLocaleDateString()}</p>
              <textarea
                className="faq-admin-answer-input"
                placeholder="Add an official answer (optional)…"
                value={reviewAnswers[p.id] || ''}
                onChange={e => setReviewAnswers(prev => ({ ...prev, [p.id]: e.target.value }))}
                rows={3}
              />
              <div className="faq-admin-actions">
                <button className="faq-admin-btn approve" onClick={() => handleReview(p.id, 'approved')} disabled={reviewing === p.id}>
                  {reviewing === p.id ? '…' : 'Approve (add official answer)'}
                </button>
                <button className="faq-admin-btn reject" onClick={() => handleReview(p.id, 'rejected')} disabled={reviewing === p.id}>
                  Remove (violates rules)
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
                      {item.source === 'community' && item.answers && item.answers.length > 0 && (
                        <span className="faq-answer-count">{item.answers.length} {item.answers.length === 1 ? 'answer' : 'answers'}</span>
                      )}
                      <span className="faq-chevron">▼</span>
                    </div>
                  </button>

                  {openId === item.id && (
                    <div className="faq-answer-section">
                      {/* Static answer (static FAQ or admin-provided) */}
                      {item.answer && (
                        <div className="faq-answer faq-answer-static">{item.answer}</div>
                      )}

                      {/* Community answers */}
                      {item.source === 'community' && (
                        <>
                          {item.answers && item.answers.length > 0 ? (
                            <div className="faq-community-answers">
                              {item.answers.map(a => (
                                <div key={a.id} className="faq-community-answer">
                                  <div className="faq-community-answer-meta">
                                    <span className="faq-community-answer-author">{a.author_name}</span>
                                    <span className="faq-community-answer-date">
                                      {new Date(a.created_at).toLocaleDateString()}
                                    </span>
                                    {user && a.user_id === user.id && (
                                      <button
                                        className="faq-delete-answer-btn"
                                        onClick={e => { e.stopPropagation(); handleDeleteAnswer(item.id, a.id); }}
                                        title="Delete your answer"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                  <p className="faq-community-answer-text">{a.answer_text}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="faq-no-answers">No answers yet — be the first to help!</p>
                          )}

                          {token && (
                            <button
                              className="faq-answer-btn"
                              onClick={e => { e.stopPropagation(); setAnswerTarget(item); setAnswerError(''); }}
                            >
                              Answer this question
                            </button>
                          )}
                        </>
                      )}
                    </div>
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
                    <span
                      className="faq-status-badge"
                      style={{
                        background: `${statusColor[s.status]}20`,
                        color: statusColor[s.status],
                        border: `1px solid ${statusColor[s.status]}40`,
                      }}
                    >
                      {statusLabel[s.status] || s.status}
                    </span>
                  </div>
                  {s.answers && s.answers.length > 0 && (
                    <p className="faq-my-answer">{s.answers.length} community {s.answers.length === 1 ? 'answer' : 'answers'}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Ask question modal */}
      {showModal && (
        <div className="faq-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="faq-modal">
            <h3 className="faq-modal-title">Ask a Question</h3>
            <p className="faq-modal-sub">Your question goes live immediately — anyone can answer it.</p>
            <label className="faq-modal-label">Category</label>
            <select className="faq-modal-select" value={submitCat} onChange={e => setSubmitCat(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="faq-modal-label">Your question</label>
            <textarea
              className="faq-modal-textarea"
              placeholder="e.g. Can I work on-campus during winter break on an F-1 visa?"
              value={submitQ}
              onChange={e => { setSubmitQ(e.target.value); setSubmitError(''); }}
              rows={4}
              maxLength={1000}
            />
            {submitMsg && <p className="faq-modal-msg">{submitMsg}</p>}
            {submitError && <p className="faq-modal-error">{submitError}</p>}
            <div className="faq-modal-actions">
              <button className="faq-modal-btn submit" onClick={handleSubmit} disabled={submitting || !submitQ.trim()}>
                {submitting ? 'Posting…' : 'Post Question'}
              </button>
              <button className="faq-modal-btn cancel" onClick={() => { setShowModal(false); setSubmitError(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Post answer modal */}
      {answerTarget && (
        <div className="faq-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAnswerTarget(null); }}>
          <div className="faq-modal">
            <h3 className="faq-modal-title">Answer this Question</h3>
            <p className="faq-modal-sub faq-modal-question-preview">"{answerTarget.question}"</p>
            <label className="faq-modal-label">Your answer</label>
            <textarea
              className="faq-modal-textarea"
              placeholder="Share what you know…"
              value={answerText}
              onChange={e => { setAnswerText(e.target.value); setAnswerError(''); }}
              rows={5}
              maxLength={5000}
              autoFocus
            />
            {answerError && <p className="faq-modal-error">{answerError}</p>}
            <div className="faq-modal-actions">
              <button className="faq-modal-btn submit" onClick={handlePostAnswer} disabled={answerSubmitting || !answerText.trim()}>
                {answerSubmitting ? 'Posting…' : 'Post Answer'}
              </button>
              <button className="faq-modal-btn cancel" onClick={() => { setAnswerTarget(null); setAnswerError(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
