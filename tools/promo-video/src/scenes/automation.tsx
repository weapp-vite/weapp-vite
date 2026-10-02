import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

const green = '#95ec69'
const white = '#f0f5ef'
const gray = '#85968b'
const mono = 'JetBrains Mono, monospace'
const sources = ['Routes', 'Components', 'npm', 'Packages']
const outputs = ['app.json', 'index.js', 'index.wxml', 'index.wxss']

function SourceGlyph({ index, color }: { index: number, color: string }) {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {index === 0 && (
        <>
          <circle cx="9" cy="8" r="4" />
          <circle cx="29" cy="30" r="4" />
          <path d="M9 12v9a9 9 0 0 0 9 9h7M9 20h14a6 6 0 0 0 6-6V8" />
          <path d="m24 12 5-5 5 5" />
        </>
      )}
      {index === 1 && (
        <>
          <rect x="4" y="4" width="12" height="12" rx="2" />
          <rect x="22" y="4" width="12" height="12" rx="2" />
          <rect x="4" y="22" width="12" height="12" rx="2" />
          <rect x="22" y="22" width="12" height="12" rx="2" />
        </>
      )}
      {index === 2 && (
        <>
          <path d="M4 13h30v17H4zM8 13V8h22v5M13 19v6M20 19v6M27 19v6" />
          <path d="M4 13h30" />
        </>
      )}
      {index === 3 && <><path d="m19 3 15 8v16l-15 8-15-8V11zM4 11l15 8 15-8M19 19v16M12 7l15 8v8" /></>}
    </svg>
  )
}

export function Automation({ portrait }: { portrait: boolean }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const seconds = frame / fps
  const speed = portrait ? 1.6 : 1
  const enter = interpolate(frame, [0, 28], [0, 1], { extrapolateRight: 'clamp' })
  const core = portrait ? { x: 490, y: 1012 } : { x: 950, y: 584 }
  const inputPoints = portrait
    ? [{ x: 262, y: 542 }, { x: 718, y: 542 }, { x: 262, y: 691 }, { x: 718, y: 691 }]
    : [{ x: 372, y: 358 }, { x: 372, y: 498 }, { x: 372, y: 638 }, { x: 372, y: 778 }]
  const outputPoints = portrait
    ? [{ x: 160, y: 1400 }, { x: 378, y: 1400 }, { x: 598, y: 1400 }, { x: 818, y: 1400 }]
    : [{ x: 1460, y: 358 }, { x: 1460, y: 498 }, { x: 1460, y: 638 }, { x: 1460, y: 778 }]
  const inputPaths = inputPoints.map((point, index) => {
    if (!portrait) {
      return `M${point.x} ${point.y} C${point.x + 290} ${point.y} ${core.x - 320} ${core.y} ${core.x - 122} ${core.y}`
    }
    if (index === 0) {
      return 'M262 586 V612 Q262 626 248 626 H110 Q94 626 94 642 V780 Q94 854 490 890'
    }
    if (index === 1) {
      return 'M718 586 V612 Q718 626 732 626 H890 Q906 626 906 642 V780 Q906 854 490 890'
    }
    return `M${point.x} ${point.y + 44} C${point.x} 830 ${core.x} 782 ${core.x} ${core.y - 122}`
  })
  const outputPaths = outputPoints.map(point => portrait
    ? `M${core.x} ${core.y + 122} C${core.x} 1260 ${point.x} 1250 ${point.x} ${point.y - 44}`
    : `M${core.x + 122} ${core.y} C${core.x + 300} ${core.y} ${point.x - 200} ${point.y} ${point.x - 24} ${point.y}`)
  const pulse = (Math.sin(seconds * Math.PI * 2 * 128 / 60) + 1) / 2
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: 'Noto Sans SC, sans-serif', color: white, opacity: enter }}>
      <svg width={portrait ? 1080 : 1920} height={portrait ? 1920 : 1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id={`core-glow-${portrait}`}>
            <stop offset="0%" stopColor={green} stopOpacity="0.13" />
            <stop offset="100%" stopColor={green} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={core.x} cy={core.y} r={portrait ? 260 : 295} fill={`url(#core-glow-${portrait})`} />
        {[...inputPaths, ...outputPaths].map((path, index) => {
          const active = interpolate(seconds * speed, [index < 4 ? index * 0.1 : 1.4 + (index - 4) * 0.12, index < 4 ? 1.2 + index * 0.1 : 2.4 + (index - 4) * 0.12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          return (
            <g key={path} opacity={active}>
              <path d={path} stroke="#2a3c2f" strokeWidth="1.5" fill="none" />
              <path d={path} stroke={green} strokeOpacity="0.13" strokeWidth="7" fill="none" />
              <path d={path} pathLength="100" stroke={green} strokeWidth="2.2" strokeDasharray="7 93" strokeDashoffset={-((seconds * speed * 24 + index * 18) % 100)} fill="none" />
            </g>
          )
        })}
        <circle cx={core.x} cy={core.y} r="147" stroke="#3e6446" strokeOpacity="0.6" strokeWidth="1" fill="none" />
        <circle cx={core.x} cy={core.y} r={154 + pulse * 8} stroke={green} strokeOpacity={0.03 + pulse * 0.09} strokeWidth="1" fill="none" />
        <circle cx={core.x} cy={core.y} r="147" pathLength="100" stroke={green} strokeWidth="2" strokeDasharray="5 45" strokeDashoffset={-seconds * 4} fill="none" />
        <rect x={core.x - 108} y={core.y - 108} width="216" height="216" rx="47" fill="#132519" stroke={green} strokeWidth="1.4" transform={`rotate(${45 + Math.sin(seconds * 0.5) * 2} ${core.x} ${core.y})`} />
        <rect x={core.x - 87} y={core.y - 87} width="174" height="174" rx="34" fill="#0a150d" stroke="#42633f" strokeWidth="1" transform={`rotate(${45 + Math.sin(seconds * 0.5) * 2} ${core.x} ${core.y})`} />
      </svg>

      <div style={{ position: 'absolute', top: portrait ? 472 : 274, left: portrait ? 80 : 125, fontFamily: mono, fontSize: portrait ? 17 : 18, color: gray, letterSpacing: 2 }}>01 / INPUT</div>
      {sources.map((label, index) => {
        const point = inputPoints[index]!
        const show = interpolate(frame, [index * 5, index * 5 + 25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        return (
          <div key={label} style={{ position: 'absolute', left: portrait ? point.x - 147 : 126, top: point.y - (portrait ? 20 : 22), width: portrait ? 316 : 285, height: 58, display: 'flex', alignItems: 'center', gap: portrait ? 16 : 22, opacity: show, transform: `translateY(${(1 - show) * 20}px)` }}>
            <SourceGlyph index={index} color={green} />
            <span style={{ fontFamily: mono, fontSize: portrait ? 28 : 33, color: '#dce7dd', letterSpacing: '-0.8px' }}>{label}</span>
          </div>
        )
      })}

      <div style={{ position: 'absolute', left: core.x - 116, top: core.y - 66, width: 232, textAlign: 'center' }}>
        <div style={{ fontFamily: mono, fontSize: 47, color: green, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05 }}>weapp</div>
        <div style={{ fontFamily: mono, fontSize: 47, color: white, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05 }}>vite</div>
        <div style={{ marginTop: 21, color: '#a7c49f', fontSize: 20, letterSpacing: 3 }}>构建核心</div>
      </div>

      {!portrait && <div style={{ position: 'absolute', left: core.x - 190, top: 820, width: 380, textAlign: 'center', fontSize: 24, color: gray, letterSpacing: 5 }}>自动发现 · 统一构建</div>}

      <div style={{ position: 'absolute', top: portrait ? 1487 : 274, left: portrait ? 80 : 1470, fontFamily: mono, fontSize: portrait ? 17 : 18, color: gray, letterSpacing: 2 }}>{portrait ? '02 / NATIVE OUTPUT' : '02 / OUTPUT'}</div>
      {outputs.map((label, index) => {
        const point = outputPoints[index]!
        const show = interpolate(seconds * speed, [1.4 + index * 0.12, 2.1 + index * 0.12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        return (
          <div key={label} style={{ position: 'absolute', left: portrait ? point.x - 90 : point.x, top: point.y - (portrait ? 35 : 25), width: portrait ? 180 : 322, opacity: show, transform: `translateY(${(1 - show) * 14}px)`, textAlign: portrait ? 'center' : 'left' }}>
            <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: portrait ? 'center' : 'flex-start', gap: portrait ? 18 : 22 }}>
              <svg width="31" height="38" viewBox="0 0 31 38" fill="none" stroke="#88bc73" strokeWidth="1.6"><path d="M4 2h15l8 8v25H4zM19 2v9h8M10 19h11M10 25h8" /></svg>
              <span style={{ fontFamily: mono, fontSize: portrait ? 23 : 31, letterSpacing: '-0.5px', color: '#e0e9df' }}>{label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
