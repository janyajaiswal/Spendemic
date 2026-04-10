import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/chat.css';

const API = 'http://localhost:8000/api/v1';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ActionPayload {
  action: string;
  amount?: number;
  type?: string;
  category?: string;
  description?: string;
}

interface PendingAction {
  payload: ActionPayload;
  label: string;
}

export default function ChatWidget() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m your Spendemic assistant. Ask me anything about budgeting, visa work rules, taxes, or just say "Add $45 food expense at Chipotle" to log a transaction.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction]);

  if (!isAuthenticated) return null;

  const token = user?.accessToken;

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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10),
        }),
      });

      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { reply: string; action: ActionPayload | null };

      setMessages([...newHistory, { role: 'assistant', content: data.reply }]);

      if (data.action?.action === 'add_transaction') {
        const a = data.action;
        const label = `${a.type === 'INCOME' ? 'Income' : 'Expense'} $${a.amount} — ${a.description} (${a.category})`;
        setPendingAction({ payload: a, label });
      }

      if (data.reply.toLowerCase().includes('go to') || data.reply.toLowerCase().includes('navigate to')) {
        const pageMap: Record<string, string> = {
          dashboard: '/dashboard', budgets: '/budgets', transactions: '/transactions',
          expenses: '/transactions', reports: '/reports', settings: '/settings', faq: '/faq',
        };
        for (const [keyword, path] of Object.entries(pageMap)) {
          if (data.reply.toLowerCase().includes(keyword)) {
            navigate(path);
            break;
          }
        }
      }
    } catch {
      setMessages([...newHistory, { role: 'assistant', content: 'Sorry, I couldn\'t connect. Check that the backend is running.' }]);
    } finally {
      setLoading(false);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    const a = pendingAction.payload;
    try {
      await fetch(`${API}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: a.amount,
          currency: 'USD',
          type: a.type,
          category: a.category,
          description: a.description,
          transaction_date: new Date().toISOString().split('T')[0],
        }),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: `Done! Transaction added: ${pendingAction.label}` }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Couldn\'t add the transaction. Try adding it manually on the Transactions page.' }]);
    }
    setPendingAction(null);
  };

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
                <div className="chat-action-title">Add this transaction?</div>
                <div className="chat-action-detail">{pendingAction.label}</div>
                <div className="chat-action-buttons">
                  <button className="chat-action-btn confirm" onClick={confirmAction}>Yes, add it</button>
                  <button className="chat-action-btn dismiss" onClick={() => setPendingAction(null)}>Dismiss</button>
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
