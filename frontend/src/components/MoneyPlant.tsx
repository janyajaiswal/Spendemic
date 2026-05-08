import { useEffect, useRef } from 'react';

// Vine path — S-curve winding around the vertical border pole (center x=40 in 80px container)
const VINE_PATH = `
  M 40 845
  C 40 830, 22 818, 16 800
  C 10 782, 12 764, 26 752
  C 38 741, 52 736, 58 720
  C 64 704, 64 686, 52 672
  C 40 658, 22 652, 14 636
  C 6  620, 8  600, 22 588
  C 34 577, 52 572, 62 558
  C 72 544, 70 524, 58 512
  C 46 500, 24 496, 14 482
  C 4  468, 6  448, 18 436
  C 30 424, 50 418, 62 406
  C 74 394, 74 374, 60 362
  C 48 350, 26 346, 16 332
  C 6  318, 8  298, 22 286
  C 34 275, 52 270, 62 256
  C 72 242, 70 222, 56 210
  C 44 200, 24 196, 16 182
  C 8  168, 10 148, 26 136
  C 40 125, 56 120, 62 106
  C 68 92, 64 74, 52 62
  C 42 52, 36 38, 38 18
`.trim();

// Leaf definitions: [x, y, direction, angle, size, leafDelay]
// direction: 'left' = leaf grows leftward, 'right' = rightward
// angle: slight tilt in degrees
const LEAVES: Array<[number, number, 'left' | 'right', number, number, number]> = [
  [16,  800, 'left',   15, 1.05, 0.8 ],
  [58,  720, 'right', -10, 0.9,  1.0 ],
  [14,  636, 'left',   10, 1.1,  1.2 ],
  [62,  558, 'right', -15, 0.95, 1.4 ],
  [14,  482, 'left',   12, 1.0,  1.6 ],
  [62,  406, 'right', -8,  1.1,  1.8 ],
  [16,  332, 'left',   18, 0.95, 2.0 ],
  [62,  256, 'right', -12, 1.0,  2.2 ],
  [16,  182, 'left',   10, 0.9,  2.4 ],
  [62,  106, 'right', -15, 0.85, 2.6 ],
];

interface LeafProps {
  x: number;
  y: number;
  direction: 'left' | 'right';
  angle: number;
  size: number;
  delay: number;
}

function Leaf({ x, y, direction, angle, size, delay }: LeafProps) {
  const s = size;
  const w = 32 * s;   // leaf half-width (from base to tip)
  const h = 14 * s;   // leaf half-height
  const petLen = 6 * s;

  const sign = direction === 'right' ? 1 : -1;

  // Leaf body path (base at 0,0, tip at sign*w)
  const leafPath = `
    M 0 0
    C ${sign*w*0.22} ${-h},
      ${sign*w*0.68} ${-h*1.1},
      ${sign*w} ${-h*0.08}
    Q ${sign*(w+1)} 0 ${sign*w} ${h*0.08}
    C ${sign*w*0.68} ${h*1.1},
      ${sign*w*0.22} ${h},
      0 0
    Z
  `.trim();

  // Midrib
  const midRib = `M 0 0 L ${sign * w * 0.92} 0`;

  // Secondary veins (4 pairs, upper and lower)
  const veins: [number, number, number, number][] = [
    [sign*w*0.18, 0, sign*w*0.28, -h*0.6 ],
    [sign*w*0.35, 0, sign*w*0.46, -h*0.72],
    [sign*w*0.52, 0, sign*w*0.62, -h*0.65],
    [sign*w*0.65, 0, sign*w*0.73, -h*0.5 ],
    [sign*w*0.18, 0, sign*w*0.28,  h*0.6 ],
    [sign*w*0.35, 0, sign*w*0.46,  h*0.72],
    [sign*w*0.52, 0, sign*w*0.62,  h*0.65],
    [sign*w*0.65, 0, sign*w*0.73,  h*0.5 ],
  ];

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${angle * sign * -1})`}
      className="mp-leaf"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Petiole */}
      <line
        x1="0" y1="0"
        x2={sign * petLen} y2="0"
        stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round"
      />
      {/* Leaf body */}
      <g transform={`translate(${sign * petLen}, 0)`}>
        <path
          d={leafPath}
          fill="url(#mpLeafGrad)"
          stroke="#16a34a"
          strokeWidth="0.6"
        />
        {/* Midrib */}
        <path d={midRib} stroke="#15803d" strokeWidth="0.9" opacity="0.75" fill="none"/>
        {/* Secondary veins */}
        {veins.map(([x1,y1,x2,y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#16a34a" strokeWidth="0.55" opacity="0.55"/>
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
    const length = vine.getTotalLength();
    vine.style.strokeDasharray = `${length}`;
    vine.style.strokeDashoffset = `${length}`;
    // Trigger the grow animation on next frame
    requestAnimationFrame(() => {
      vine.style.transition = 'stroke-dashoffset 3.5s cubic-bezier(0.4, 0, 0.2, 1) 0.2s';
      vine.style.strokeDashoffset = '0';
    });
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        left: '192px',       // centers 80px container on 232px sidebar border
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
          {/* Leaf gradient: bright highlight → rich green → deep green */}
          <linearGradient id="mpLeafGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#86efac" />
            <stop offset="35%"  stopColor="#4ade80" />
            <stop offset="70%"  stopColor="#22c55e" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>

          {/* Vine gradient: bottom = deep, top = bright */}
          <linearGradient id="mpVineGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%"   stopColor="#15803d" />
            <stop offset="50%"  stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>

          {/* Pole gradient */}
          <linearGradient id="mpPoleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#a0835a" />
            <stop offset="45%"  stopColor="#d4aa70" />
            <stop offset="100%" stopColor="#8b6343" />
          </linearGradient>

          {/* Pot gradient */}
          <linearGradient id="mpPotGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#9e5330" />
            <stop offset="40%"  stopColor="#c1693a" />
            <stop offset="100%" stopColor="#8b4513" />
          </linearGradient>

          {/* Leaf sway animation */}
          <style>{`
            @keyframes mpLeafSway {
              0%, 100% { transform-origin: 0 0; transform: rotate(0deg); }
              40%       { transform-origin: 0 0; transform: rotate(4deg); }
              70%       { transform-origin: 0 0; transform: rotate(-3deg); }
            }
            @keyframes mpLeafFadeIn {
              from { opacity: 0; transform-origin: 0 0; transform: scale(0.4); }
              to   { opacity: 1; transform-origin: 0 0; transform: scale(1); }
            }
            .mp-leaf {
              opacity: 0;
              animation: mpLeafFadeIn 0.55s ease-out forwards, mpLeafSway 4s ease-in-out infinite;
            }
          `}</style>
        </defs>

        {/* ── Terracotta pot ── */}
        <g>
          {/* Pot body */}
          <path
            d="M 12 860 L 8 900 L 72 900 L 68 860 Z"
            fill="url(#mpPotGrad)"
            stroke="#7a3a10"
            strokeWidth="1"
          />
          {/* Pot highlight */}
          <path
            d="M 18 863 L 14 897 L 20 897 L 23 863 Z"
            fill="rgba(255,255,255,0.11)"
          />
          {/* Pot rim */}
          <rect x="8" y="847" width="64" height="16" rx="4"
            fill="#cd7a46" stroke="#9e5330" strokeWidth="1"/>
          {/* Rim highlight */}
          <rect x="10" y="848" width="60" height="5" rx="2"
            fill="rgba(255,255,255,0.18)"/>
          {/* Soil surface */}
          <ellipse cx="40" cy="855" rx="29" ry="8" fill="#5c3317"/>
          {/* Soil texture */}
          <ellipse cx="30" cy="854" rx="6" ry="2.5" fill="#4a2810" opacity="0.55"/>
          <ellipse cx="48" cy="856" rx="5" ry="2" fill="#4a2810" opacity="0.55"/>
          <ellipse cx="39" cy="852" rx="4" ry="1.5" fill="#4a2810" opacity="0.4"/>
          <circle cx="25" cy="857" r="1.5" fill="#3d2008" opacity="0.5"/>
          <circle cx="53" cy="853" r="1.2" fill="#3d2008" opacity="0.5"/>
        </g>

        {/* ── Central pole/stake ── */}
        <rect
          x="38" y="30" width="4" height="820"
          rx="2"
          fill="url(#mpPoleGrad)"
          stroke="#8b6343"
          strokeWidth="0.5"
        />
        {/* Pole sheen */}
        <rect x="39" y="30" width="1.2" height="820" rx="0.6"
          fill="rgba(255,255,255,0.2)"/>

        {/* ── Vine ── */}
        <path
          ref={vineRef}
          d={VINE_PATH}
          fill="none"
          stroke="url(#mpVineGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* ── Leaves ── */}
        {LEAVES.map(([x, y, dir, angle, size, delay], i) => (
          <Leaf key={i} x={x} y={y} direction={dir} angle={angle} size={size} delay={delay} />
        ))}

        {/* ── Tip bud ── */}
        <g className="mp-leaf" style={{ animationDelay: '3.0s' }}>
          <circle cx="38" cy="18" r="5" fill="#86efac" stroke="#22c55e" strokeWidth="0.8"/>
          <circle cx="40" cy="12" r="3.5" fill="#4ade80" stroke="#22c55e" strokeWidth="0.6"/>
          <circle cx="42" cy="7"  r="2.5" fill="#22c55e" stroke="#16a34a" strokeWidth="0.5"/>
        </g>
      </svg>
    </div>
  );
}
