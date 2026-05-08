import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bot, TrendingUp, DollarSign, Bell } from 'lucide-react';
import '../styles/landing.css';

// ── Typewriter hook ────────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 110) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const t = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return displayed;
}

// ── Feature card data ──────────────────────────────────────────────────────────
const FEATURES = [
  { Icon: Bot,        title: 'AI-Powered Insights',    emoji: '🤖', desc: 'Get personalised financial recommendations powered by advanced AI' },
  { Icon: TrendingUp, title: 'Budget Forecasting',     emoji: '📈', desc: 'Predict future expenses with time-series AI analysis' },
  { Icon: DollarSign, title: 'Multi-Currency Support', emoji: '💱', desc: 'Manage finances across multiple currencies seamlessly' },
  { Icon: Bell,       title: 'Smart Alerts',           emoji: '🔔', desc: 'Stay on track with intelligent budget notifications' },
];

// ── Coin rain config ───────────────────────────────────────────────────────────
const RAIN_SYMBOLS = ['$', '€', '£', '¥', '₹', '₩', '$', '€'];
const coinRain = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  symbol: RAIN_SYMBOLS[i % RAIN_SYMBOLS.length],
  left: `${5 + (i * 5.9) % 90}%`,
  delay: `-${(i * 0.45) % 6}s`,
  duration: `${4.5 + (i * 0.55) % 4}s`,
  size: `${0.8 + (i * 0.09) % 0.7}em`,
}));

// ── Floating decorations ───────────────────────────────────────────────────────
const FLOATERS = ['📚', '✈️', '🎓', '💼', '📊', '🌍', '💡', '🎯', '🏦', '🗺️'];
const floaters = FLOATERS.map((emoji, i) => ({
  emoji,
  left: `${5 + i * 9.2}%`,
  top: `${8 + (i * 19) % 75}%`,
  delay: `${i * 0.75}s`,
  dur: `${3.8 + (i % 4) * 0.6}s`,
  size: `${1 + (i % 3) * 0.35}em`,
}));

// ── Sparkle positions (decorative CSS-only sparkles) ──────────────────────────
const SPARKLES = [
  { top: '12%', left: '8%' }, { top: '25%', right: '6%' }, { top: '60%', left: '4%' },
  { top: '45%', right: '9%' }, { top: '80%', left: '15%' }, { top: '70%', right: '12%' },
];

export default function Landing() {
  const title = useTypewriter('Spendemic', 110);
  const [xp, setXp] = useState(0);
  const [unlocked, setUnlocked] = useState<Set<number>>(new Set());
  const [ctaClicked, setCtaClicked] = useState(false);
  const [studentMood, setStudentMood] = useState('😊');

  // Animate XP bar after brief delay
  useEffect(() => {
    const timeout = setTimeout(() => {
      let v = 0;
      const interval = setInterval(() => {
        v += 1.4;
        if (v >= 72) { setXp(72); clearInterval(interval); }
        else setXp(Math.round(v));
      }, 16);
      return () => clearInterval(interval);
    }, 900);
    return () => clearTimeout(timeout);
  }, []);

  // Cycle student emoji every few seconds
  useEffect(() => {
    const moods = ['😊', '😄', '🤓', '😎', '🥳'];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % moods.length;
      setStudentMood(moods[i]);
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const handleCardEnter = (i: number) => {
    setUnlocked(prev => new Set([...prev, i]));
  };

  const handleCTA = () => {
    setCtaClicked(true);
    setTimeout(() => setCtaClicked(false), 600);
  };

  return (
    <div className="landing-root">
      {/* ── Coin rain ── */}
      <div className="landing-rain" aria-hidden="true">
        {coinRain.map(c => (
          <span key={c.id} className="rain-coin"
            style={{ left: c.left, animationDelay: c.delay, animationDuration: c.duration, fontSize: c.size }}>
            {c.symbol}
          </span>
        ))}
      </div>

      {/* ── Floating emoji bg ── */}
      <div className="landing-floaters" aria-hidden="true">
        {floaters.map((f, i) => (
          <span key={i} className="landing-floater"
            style={{ left: f.left, top: f.top, animationDelay: f.delay, animationDuration: f.dur, fontSize: f.size }}>
            {f.emoji}
          </span>
        ))}
      </div>

      {/* ── Sparkles ── */}
      {SPARKLES.map((pos, i) => (
        <span key={i} className="landing-sparkle" style={{ ...pos, animationDelay: `${i * 0.45}s` }} aria-hidden="true">✦</span>
      ))}

      {/* ═════════════════ HERO ═════════════════ */}
      <section className="landing-hero">

        {/* Title */}
        <div className="landing-title-row">
          <span className="landing-hero-coin" aria-hidden="true">🪙</span>
          <h1 className="landing-title">
            {title}
            <span className="landing-cursor" aria-hidden="true">|</span>
          </h1>
          <span className="landing-hero-coin" aria-hidden="true">🪙</span>
        </div>

        <h2 className="landing-subtitle">AI Financial Guide for International Students</h2>
        <p className="landing-tagline">One-stop solution for all things finance</p>

        {/* XP bar */}
        <div className="landing-xp-card">
          <div className="landing-xp-header">
            <span className="landing-xp-label">🎮 Financial Literacy</span>
            <span className="landing-xp-lvl">LVL 1</span>
          </div>
          <div className="landing-xp-track">
            <div className="landing-xp-fill" style={{ width: `${xp}%` }}>
              <span className="landing-xp-spark">⚡</span>
            </div>
          </div>
          <div className="landing-xp-footer">
            <span>{xp} / 100 XP</span>
            <span className="landing-xp-next">+28 XP to Level 2 →</span>
          </div>
        </div>

        {/* Student scene */}
        <div className="landing-scene">
          {/* Orbiting coins */}
          <span className="orbit-item orbit-1">💰</span>
          <span className="orbit-item orbit-2">💎</span>
          <span className="orbit-item orbit-3">⭐</span>
          <span className="orbit-item orbit-4">🏅</span>

          {/* CSS cartoon student */}
          <div className="landing-student" title="That's you!">
            <div className="student-hat">🎓</div>
            <div className="student-face">{studentMood}</div>
            <div className="student-body-row">
              <span className="student-arm arm-left">📚</span>
              <div className="student-torso">🎒</div>
              <span className="student-arm arm-right">💳</span>
            </div>
            <div className="student-legs">🚶</div>
            <div className="student-shadow" />
          </div>

          <p className="landing-scene-caption">Students on their way to success!</p>

          {/* Ground grass dots */}
          <div className="landing-ground">
            {'· · · · · · · · · · · · · · · ·'.split(' ').map((d, i) => (
              <span key={i} className="ground-dot" style={{ animationDelay: `${i * 0.08}s` }}>{d}</span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Link
          to="/dashboard"
          className={`landing-cta${ctaClicked ? ' cta-pop' : ''}`}
          onClick={handleCTA}
        >
          <span className="cta-rocket">🚀</span>
          <span className="cta-text">Get Started</span>
          <span className="cta-arrow">→</span>
          <span className="cta-shine" aria-hidden="true" />
        </Link>

        <p className="landing-fine-print">Free for international students · No credit card needed</p>
      </section>

      {/* ═════════════════ FEATURES ═════════════════ */}
      <section className="landing-features">
        <div className="landing-features-header">
          <h3 className="landing-features-title">🏆 Unlock Your Financial Skills</h3>
          <p className="landing-features-sub">Hover each card to unlock the achievement</p>
        </div>

        <div className="landing-features-grid">
          {FEATURES.map((f, i) => {
            const isUnlocked = unlocked.has(i);
            return (
              <div
                key={i}
                className={`lf-card stagger-in${isUnlocked ? ' lf-unlocked' : ''}`}
                style={{ '--i': i } as React.CSSProperties}
                onMouseEnter={() => handleCardEnter(i)}
              >
                {/* Lock/unlock badge */}
                <div className="lf-badge">{isUnlocked ? '🔓' : '🔒'}</div>

                {/* Emoji + icon */}
                <div className="lf-icon-wrap">
                  <span className="lf-emoji">{f.emoji}</span>
                  <f.Icon size={36} strokeWidth={1.5} className="lf-icon" />
                </div>

                <h4 className="lf-title">{f.title}</h4>
                <p className="lf-desc">{f.desc}</p>

                {isUnlocked && (
                  <div className="lf-unlocked-chip">✨ Achievement Unlocked!</div>
                )}

                {/* Card shine sweep */}
                <span className="lf-shine" aria-hidden="true" />
              </div>
            );
          })}
        </div>

        {/* Bottom stats bar */}
        <div className="landing-stats-bar">
          {[
            { val: '10k+', label: 'Students', icon: '🎓' },
            { val: '50+', label: 'Currencies', icon: '💱' },
            { val: '99%', label: 'Budget accuracy', icon: '🎯' },
            { val: 'AI', label: 'Powered insights', icon: '🤖' },
          ].map((s, i) => (
            <div key={i} className="stat-pill">
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-val">{s.val}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
