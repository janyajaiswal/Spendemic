import { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
}

export default function InfoTooltip({ text, position = 'top', maxWidth = 240 }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible]);

  const tipStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 9999,
    background: 'rgba(30,20,20,0.97)',
    color: '#f5f0e8',
    fontSize: '0.78rem',
    lineHeight: '1.5',
    padding: '8px 12px',
    borderRadius: '8px',
    maxWidth,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,215,0,0.15)',
    whiteSpace: 'pre-wrap',
    pointerEvents: 'none',
    ...(position === 'top'    && { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 }),
    ...(position === 'bottom' && { top: '100%',    left: '50%', transform: 'translateX(-50%)', marginTop: 6 }),
    ...(position === 'left'   && { right: '100%',  top: '50%',  transform: 'translateY(-50%)', marginRight: 6 }),
    ...(position === 'right'  && { left: '100%',   top: '50%',  transform: 'translateY(-50%)', marginLeft: 6 }),
  };

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible(v => !v)}
    >
      <span
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
      {visible && <span style={tipStyle}>{text}</span>}
    </span>
  );
}
