import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

interface InfoTooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
}

export default function InfoTooltip({ text, position = 'top', maxWidth = 340 }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);

  const computeCoords = () => {
    if (!iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    const cx = r.left + window.scrollX + r.width / 2;
    const cy = r.top + window.scrollY + r.height / 2;
    switch (position) {
      case 'top':    setCoords({ top: r.top  + window.scrollY - 8, left: cx }); break;
      case 'bottom': setCoords({ top: r.bottom + window.scrollY + 8, left: cx }); break;
      case 'left':   setCoords({ top: cy, left: r.left  + window.scrollX - 8 }); break;
      case 'right':  setCoords({ top: cy, left: r.right + window.scrollX + 8 }); break;
    }
  };

  const show = () => { computeCoords(); setVisible(true); };
  const hide = () => setVisible(false);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (iconRef.current && !iconRef.current.contains(e.target as Node)) setVisible(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible]);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  const transform = {
    top:    'translateX(-50%) translateY(-100%)',
    bottom: 'translateX(-50%)',
    left:   'translateX(-100%) translateY(-50%)',
    right:  'translateY(-50%)',
  }[position];

  const tooltip = visible ? ReactDOM.createPortal(
    <span style={{
      position: 'absolute',
      top: coords.top,
      left: coords.left,
      transform,
      zIndex: 99999,
      // Solid color — portal renders at body level so parent opacity never bleeds through
      background: isLight ? '#1c3a38' : '#0a2826',
      color: '#e8f4f3',
      fontSize: '0.78rem',
      lineHeight: '1.6',
      padding: '10px 14px',
      borderRadius: '10px',
      width: maxWidth,
      maxWidth: '90vw',
      boxShadow: '0 6px 24px rgba(0,0,0,0.55)',
      border: `1px solid rgba(45,212,191,0.2)`,
      whiteSpace: 'pre-wrap',
      wordBreak: 'normal',
      overflowWrap: 'break-word',
      pointerEvents: 'none',
      // Explicit resets so no inherited textTransform/letterSpacing/fontWeight from parent headers
      textTransform: 'none',
      letterSpacing: 'normal',
      fontWeight: 'normal',
      opacity: 1,
    }}>
      {text}
    </span>,
    document.body
  ) : null;

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={() => visible ? hide() : show()}
    >
      <span
        ref={iconRef}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 15,
          height: 15,
          borderRadius: '50%',
          background: 'rgba(255,215,0,0.15)',
          border: '1px solid rgba(255,215,0,0.4)',
          color: 'rgba(255,215,0,0.8)',
          fontSize: '0.65rem',
          fontWeight: 700,
          cursor: 'help',
          marginLeft: 5,
          flexShrink: 0,
          userSelect: 'none',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,215,0,0.25)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,215,0,0.15)')}
      >
        i
      </span>
      {tooltip}
    </span>
  );
}
