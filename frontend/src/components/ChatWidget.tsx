import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/chat.css';

import { API } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ActionPayload {
  action: string;
  // add_transaction
  amount?: number;
  type?: string;
  category?: string;
  description?: string;
  // navigate
  path?: string;
  // create_goal
  name?: string;
  target_amount?: number;
  deadline?: string | null;
  // create_budget
  limit_amount?: number;
  period?: string;
}

interface PendingAction {
  payload: ActionPayload;
  label: string;
}

function getToken(): string {
  return localStorage.getItem('spendemic_token') ?? '';
}

export default function ChatWidget() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your Spendemic assistant. Ask me about budgets, visa rules, taxes, or say things like:\n• \"Add $45 food expense at Chipotle\"\n• \"Create a $500 laptop goal\"\n• \"Show me my spending forecast\"\n• \"How many hours can I work on F-1?\"",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction]);

  if (!isAuthenticated) return null;

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${user?.accessToken ?? getToken()}`,
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ message: text, history: messages.slice(-10) }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail || `${res.status}`);
      }

      const data = await res.json() as { reply: string; action: ActionPayload | null };
      setMessages([...newHistory, { role: 'assistant', content: data.reply }]);

      if (data.action) {
        handleAction(data.action);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages([...newHistory, {
        role: 'assistant',
        content: msg.includes('503') || msg.includes('unavailable')
          ? 'Chat is not configured yet — ask the admin to set the API key.'
          : `Sorry, something went wrong: ${msg}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (a: ActionPayload) => {
    if (a.action === 'navigate' && a.path) {
      // Handle paths with query params (/dashboard?tab=visa)
      const [pathname, search] = a.path.split('?');
      navigate({ pathname, search: search ? `?${search}` : '' });
      return;
    }

    if (a.action === 'add_transaction') {
      const label = `${a.type === 'INCOME' ? 'Income' : 'Expense'} $${a.amount} — ${a.description} (${a.category})`;
      setPendingAction({ payload: a, label });
      return;
    }

    if (a.action === 'create_goal') {
      const label = `Goal: "${a.name}" — save $${a.target_amount}${a.deadline ? ` by ${a.deadline}` : ''}`;
      setPendingAction({ payload: a, label });
      return;
    }

    if (a.action === 'create_budget') {
      const label = `Budget: ${a.category} — $${a.limit_amount}/${a.period ?? 'monthly'}`;
      setPendingAction({ payload: a, label });
      return;
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    const a = pendingAction.payload;
    const token = user?.accessToken ?? getToken();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    try {
      if (a.action === 'add_transaction') {
        const res = await fetch(`${API}/transactions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            amount: a.amount,
            currency: 'USD',
            type: a.type,
            category: a.category,
            description: a.description,
            transaction_date: new Date().toISOString().split('T')[0],
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { detail?: string }).detail || `${res.status}`);
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Done! Added: ${pendingAction.label}`,
        }]);
      }

      if (a.action === 'create_goal') {
        const res = await fetch(`${API}/goals`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: a.name,
            target_amount: a.target_amount,
            currency: 'USD',
            deadline: a.deadline ?? null,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { detail?: string }).detail || 'Goal creation failed');
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Done! Goal "${a.name}" for $${a.target_amount} created. Track it on the Budgets page.`,
        }]);
      }

      if (a.action === 'create_budget') {
        const res = await fetch(`${API}/budgets`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            category: a.category,
            limit_amount: a.limit_amount,
            currency: 'USD',
            period: (a.period ?? 'monthly').toUpperCase(),
            start_date: new Date().toISOString().split('T')[0],
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { detail?: string }).detail || 'Budget creation failed');
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Done! ${a.category} budget of $${a.limit_amount}/${(a.period ?? 'monthly').toLowerCase()} created. Manage it on the Budgets page.`,
        }]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Something went wrong: ${msg}. Try doing it manually from the app.`,
      }]);
    }

    setPendingAction(null);
  };

  const pendingLabel =
    pendingAction?.payload.action === 'add_transaction' ? 'Add this transaction?' :
    pendingAction?.payload.action === 'create_goal'     ? 'Create this goal?' :
    pendingAction?.payload.action === 'create_budget'   ? 'Create this budget?' :
    'Confirm?';

  return (
    <>
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-header-title">Spendemic Assistant</span>
            <button className="chat-header-close" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={16} />
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>
            ))}
            {loading && <div className="chat-msg loading">Thinking…</div>}
            {pendingAction && (
              <div className="chat-action-card">
                <div className="chat-action-title">{pendingLabel}</div>
                <div className="chat-action-detail">{pendingAction.label}</div>
                <div className="chat-action-buttons">
                  <button className="chat-action-btn confirm" onClick={confirmAction}>Yes</button>
                  <button className="chat-action-btn dismiss" onClick={() => setPendingAction(null)}>Cancel</button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-row">
            <textarea
              className="chat-input"
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything or log a transaction…"
              disabled={loading}
            />
            <button className="chat-send-btn" onClick={send} disabled={loading || !input.trim()} aria-label="Send">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      <button className="chat-fab" onClick={() => setOpen(o => !o)} aria-label="Open chat assistant">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}
