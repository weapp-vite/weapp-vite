import { useCurrentFrame } from 'remotion'
import { colors, enter, Label, Logo, mono, Reveal } from '../brand'

function Emblem({ portrait, outro }: { portrait: boolean, outro: boolean }) {
  const frame = useCurrentFrame()
  const size = portrait ? 570 : 700
  const x = portrait ? 224 : 1105
  const y = portrait ? (outro ? 260 : 300) : 155
  const rotation = frame / 12
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: size, height: size, transform: `scale(${0.85 + enter(frame) * 0.15})`, opacity: 0.2 + enter(frame) * 0.8 }}>
      <div style={{ position: 'absolute', inset: 50, borderRadius: '50%', background: 'radial-gradient(circle, #95ec6930, #95ec6907 50%, transparent 70%)', transform: `scale(${1 + Math.sin(frame / 50) * 0.06})` }} />
      {[0, 1, 2].map(i => <div key={i} style={{ position: 'absolute', inset: 25 + i * 38, border: `1px solid ${i === 1 ? '#95ec6950' : '#95ec6916'}`, borderRadius: '50%', transform: `rotateX(${outro ? 12 : 24}deg) rotateZ(${rotation * (i % 2 ? -1 : 1)}deg)`, borderTopColor: i === 1 ? colors.green : '#95ec6970', borderBottomColor: 'transparent' }} />)}
      <svg width={size} height={size} viewBox="0 0 700 700" style={{ position: 'absolute', inset: 0, transform: `rotate(${rotation * 0.35}deg)` }}>
        {Array.from({ length: 48 }, (_, i) => <line key={i} x1="350" x2="350" y1="18" y2={i % 4 ? 24 : 34} stroke={i % 4 ? '#b1d0a920' : '#b1d0a970'} transform={`rotate(${i * 7.5} 350 350)`} />)}
        <circle cx="350" cy="57" r="5" fill={colors.yellow} />
      </svg>
      <Logo size={size * 0.5} style={{ position: 'absolute', left: size * 0.25, top: size * 0.24, filter: 'drop-shadow(0 24px 36px #95ec6933)', transform: `translateY(${Math.sin(frame / 75) * 9}px) rotate(-7deg)` }} />
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 36 35" style={{ position: 'absolute', left: size * 0.25, top: size * 0.24, opacity: 1 - enter(frame, 42, 32), transform: `translateY(${Math.sin(frame / 75) * 9}px) rotate(-7deg)` }}>
        <path d="M1 4 L18 7 L35 4 L18 34 Z" fill="none" stroke="#eaffd9" strokeWidth="0.15" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - enter(frame, 0, 50)} />
        <path d="M21 4 L10 19 L17 22 L17 30 L28 15 L21 12 Z" fill="none" stroke="#ffed98" strokeWidth="0.15" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - enter(frame, 10, 45)} />
      </svg>
      <Label style={{ position: 'absolute', top: size - 40, width: '100%', textAlign: 'center', fontSize: 16, color: '#809378' }}>ENGINEERED FOR MINI PROGRAMS</Label>
    </div>
  )
}

export function Intro({ portrait }: { portrait: boolean }) {
  return (
    <>
      <Emblem portrait={portrait} outro={false} />
      <div style={{ position: 'absolute', left: portrait ? 80 : 96, top: portrait ? 930 : 310, right: portrait ? 170 : 770 }}>
        <Reveal><Label style={{ color: colors.green, fontSize: portrait ? 19 : 22 }}>THE NEXT CHAPTER OF MINI PROGRAMS</Label></Reveal>
        <Reveal delay={8} style={{ marginTop: 36, fontSize: portrait ? 67 : 72, lineHeight: 1.35, fontWeight: 550, letterSpacing: -2 }}>小程序开发，</Reveal>
        <Reveal delay={16} style={{ marginTop: 4, fontSize: portrait ? 91 : 98, lineHeight: 1.22, fontWeight: 850, letterSpacing: -5 }}>
          也该拥有
          <br />
          <span style={{ color: colors.green }}>现代体验。</span>
        </Reveal>
        <Reveal delay={27} style={{ marginTop: 38, color: '#9ead9f', fontSize: portrait ? 25 : 27 }}>原生能力，现代工具，自由创造。</Reveal>
      </div>
    </>
  )
}

export function Outro({ portrait }: { portrait: boolean }) {
  const frame = useCurrentFrame()
  const command = 'pnpm create weapp-vite'
  const chars = Math.floor(enter(frame, 28, 65) * command.length)
  return (
    <>
      <Emblem portrait={portrait} outro />
      <div style={{ position: 'absolute', left: portrait ? 80 : 96, top: portrait ? 900 : 285, right: portrait ? 180 : 800 }}>
        <Reveal><Label style={{ color: colors.green }}>YOUR NEXT PROJECT STARTS HERE</Label></Reveal>
        <Reveal delay={5} style={{ marginTop: 20, fontFamily: mono, fontSize: portrait ? 99 : 112, fontWeight: 400, letterSpacing: -7 }}>weapp-vite</Reveal>
        <Reveal delay={12} style={{ marginTop: 28, fontSize: portrait ? 49 : 46, lineHeight: 1.45, fontWeight: 650 }}>
          给小程序
          <br />
          <span style={{ color: colors.green }}>现代化的开发体验</span>
        </Reveal>
        <Reveal delay={24} style={{ marginTop: 55, padding: portrait ? '26px 23px' : '25px 30px', background: '#95ec690d', border: '1px solid #95ec6944', borderRadius: 12, display: 'flex', gap: 20, alignItems: 'center' }}>
          <span style={{ color: colors.green, fontFamily: mono, fontSize: 30 }}>›</span>
          <span style={{ fontFamily: mono, fontSize: portrait ? 28 : 33, letterSpacing: -1 }}>{command.slice(0, chars)}</span>
          {frame < 110 && <span style={{ background: colors.green, width: 12, height: 30, opacity: frame % 30 < 15 ? 1 : 0 }} />}
        </Reveal>
        <Reveal delay={36} style={{ marginTop: 30, fontFamily: mono, color: colors.green, fontSize: portrait ? 32 : 31, display: 'flex', justifyContent: 'space-between' }}>
          <span>vite.weapp.dev</span>
          <span>↗</span>
        </Reveal>
      </div>
    </>
  )
}
