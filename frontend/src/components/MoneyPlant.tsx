import { useEffect, useRef } from 'react';

// Tight S-curve vine — amplitude only ±13px from the pole center (x=40)
// Using quadratic bezier Q so the control point IS the arc peak (where leaves attach)
const VINE_PATH = [
  'M 40 810',
  'Q 27 775 40 740',   // left arc  → peak at (27, 775)
  'Q 53 705 40 670',   // right arc → peak at (53, 705)
  'Q 27 635 40 600',   // left arc  → peak at (27, 635)
  'Q 53 565 40 530',   // right arc → peak at (53, 565)
  'Q 27 495 40 460',   // left arc  → peak at (27, 495)
  'Q 53 425 40 390',   // right arc → peak at (53, 425)
  'Q 27 355 40 320',   // left arc  → peak at (27, 355)
  'Q 53 285 40 250',   // right arc → peak at (53, 285)
  'Q 27 215 40 180',   // left arc  → peak at (27, 215)
  'Q 53 145 40 110',   // right arc → peak at (53, 145)
  'Q 33 80  40 50',    // small final left
  'Q 44 32  40 18',    // tip
].join(' ');

// Leaves spaced evenly at each arc peak — varied tilts for natural look
// [x, y, 'left'|'right', tilt-angle]
const LEAVES: [number, number, 'left' | 'right', number][] = [
  [27, 775, 'left',  -22],
  [53, 705, 'right',   7],
  [27, 635, 'left',   -5],
  [53, 565, 'right',  24],
  [27, 495, 'left',  -17],
  [53, 425, 'right',   4],
  [27, 355, 'left',  -28],
  [53, 285, 'right',  13],
  [27, 215, 'left',   -9],
  [53, 145, 'right',  19],
];

function Leaf({ x, y, direction, angle }: { x: number; y: number; direction: 'left' | 'right'; angle: number }) {
  const sign = direction === 'right' ? 1 : -1;
  const w = 22;   // leaf length
  const h = 9;    // leaf half-height

  // Pointed oval leaf: base at origin, tip at sign*w
  const body = `M 0 0 Q ${sign * w * 0.38} ${-h} ${sign * w} 0 Q ${sign * w * 0.38} ${h} 0 0`;

  // Veins: midrib + 3 pairs of side veins
  const veins = [
    // midrib
    [0, 0, sign * w * 0.88, 0],
    // upper side veins
    [sign * w * 0.22, -0.5, sign * w * 0.32, -h * 0.58],
    [sign * w * 0.44, -0.5, sign * w * 0.55, -h * 0.65],
    [sign * w * 0.62, -0.5, sign * w * 0.70, -h * 0.52],
    // lower side veins
    [sign * w * 0.22,  0.5, sign * w * 0.32,  h * 0.58],
    [sign * w * 0.44,  0.5, sign * w * 0.55,  h * 0.65],
    [sign * w * 0.62,  0.5, sign * w * 0.70,  h * 0.52],
  ];

  // Short petiole from vine to leaf base
  const petLen = 2;
  const petX = sign * petLen;

  return (
    <g transform={`translate(${x},${y}) rotate(${angle * sign * -1})`}>
      {/* Petiole */}
      <line x1="0" y1="0" x2={petX} y2="0"
        stroke="#4a7040" strokeWidth="1.4" strokeLinecap="round" />
      {/* Leaf body */}
      <g transform={`translate(${petX},0)`}>
        <path d={body} fill="url(#mpLeafGrad)" stroke="#3a5e32" strokeWidth="0.5" />
        {/* Veins */}
        {veins.map(([x1, y1, x2, y2], i) => (
          <line key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#3a5e32" strokeWidth={i === 0 ? 0.75 : 0.45}
            opacity={i === 0 ? 0.65 : 0.4}
          />
        ))}
      </g>
    </g>
  );
}

export default function MoneyPlant() {
  const vineRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const vine = vineRef.current;
    if (!vine) return;
    const len = vine.getTotalLength();
    vine.style.strokeDasharray = `${len}`;
    vine.style.strokeDashoffset = `${len}`;
    requestAnimationFrame(() => {
      vine.style.transition = 'stroke-dashoffset 3.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.3s';
      vine.style.strokeDashoffset = '0';
    });
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        left: '192px',
        top: 0,
        height: '100vh',
        width: '80px',
        pointerEvents: 'none',
        zIndex: 200,
        overflow: 'visible',
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 80 900"
        width="80"
        height="100%"
        preserveAspectRatio="xMidYMax meet"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Muted, realistic leaf gradient — dark at edge, slightly lighter at center */}
          <radialGradient id="mpLeafGrad" cx="35%" cy="40%" r="65%">
            <stop offset="0%"   stopColor="#6aac72" />
            <stop offset="45%"  stopColor="#4d8a55" />
            <stop offset="100%" stopColor="#2e5e36" />
          </radialGradient>

          {/* Vine — deep muted green */}
          <linearGradient id="mpVineGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%"   stopColor="#2e5e36" />
            <stop offset="60%"  stopColor="#3d7545" />
            <stop offset="100%" stopColor="#4d8a55" />
          </linearGradient>

          {/* Wooden pole */}
          <linearGradient id="mpPoleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#8b6343" />
            <stop offset="40%"  stopColor="#c8a06a" />
            <stop offset="100%" stopColor="#8b6343" />
          </linearGradient>

          {/* Pot body */}
          <linearGradient id="mpPotGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#8b4513" />
            <stop offset="40%"  stopColor="#b5572a" />
            <stop offset="100%" stopColor="#8b4513" />
          </linearGradient>
        </defs>

        {/* ── Small pot ── */}
        <g>
          {/* Pot body — narrower and shorter than before */}
          <path d="M 24 850 L 20 880 L 60 880 L 56 850 Z"
            fill="url(#mpPotGrad)" stroke="#6b3410" strokeWidth="1" />
          {/* Highlight on pot */}
          <path d="M 28 852 L 25 878 L 30 878 L 32 852 Z"
            fill="rgba(255,255,255,0.1)" />
          {/* Rim */}
          <rect x="20" y="841" width="40" height="11" rx="3"
            fill="#c06838" stroke="#8b4513" strokeWidth="0.8" />
          {/* Rim highlight */}
          <rect x="22" y="842" width="36" height="3.5" rx="1.5"
            fill="rgba(255,255,255,0.15)" />
          {/* Soil */}
          <ellipse cx="40" cy="849" rx="19" ry="5.5" fill="#4a2d10" />
          <ellipse cx="34" cy="848" rx="4" ry="1.5" fill="#3a2008" opacity="0.6" />
          <ellipse cx="46" cy="850" rx="3" ry="1.5" fill="#3a2008" opacity="0.5" />
        </g>

        {/* ── Wooden pole ── */}
        <rect x="38.5" y="28" width="3" height="820" rx="1.5"
          fill="url(#mpPoleGrad)" stroke="#7a5232" strokeWidth="0.4" />
        {/* Pole sheen */}
        <rect x="39.3" y="28" width="1" height="820" rx="0.5"
          fill="rgba(255,255,255,0.18)" />

        {/* ── Vine ── */}
        <path
          ref={vineRef}
          d={VINE_PATH}
          fill="none"
          stroke="url(#mpVineGrad)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* ── Leaves — rendered on top of vine, fully static (no opacity animation to avoid SVG transform issues) ── */}
        {LEAVES.map(([x, y, dir, angle], i) => (
          <Leaf key={i} x={x} y={y} direction={dir} angle={angle} />
        ))}

        {/* ── Tip bud ── */}
        <circle cx="40" cy="18" r="4"   fill="#4d8a55" stroke="#2e5e36" strokeWidth="0.6" />
        <circle cx="40" cy="12" r="2.8" fill="#6aac72" stroke="#3d7545" strokeWidth="0.5" />
        <circle cx="40" cy="7"  r="1.8" fill="#8ac48a" stroke="#4d8a55" strokeWidth="0.4" />
      </svg>
    </div>
  );
}
