import type { ShotProps } from '../timeline'
import { useCurrentFrame } from 'remotion'
import { colors, enter, Label, Logo, mono, Reveal } from '../brand'
import { copyFor } from '../copy'
import { BeatStage, Burst } from '../motion'
import { shotPhase } from '../timeline'

function Emblem({ portrait, outro, language }: { portrait: boolean, outro: boolean, language: 'zh' | 'en' }) {
  const frame = Math.min(useCurrentFrame(), 180)
  const size = portrait ? 570 : 700
  const x = portrait ? 224 : 1105
  const y = portrait ? (outro ? 260 : 300) : 155
  const rotation = (outro ? Math.min(frame, 180) : frame) / 8
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
      <Label style={{ position: 'absolute', top: size - 40, width: '100%', textAlign: 'center', fontSize: 16, color: '#809378' }}>{copyFor(language).brand.engineered}</Label>
    </div>
  )
}

export function Intro({ portrait, shot }: ShotProps) {
  const frame = useCurrentFrame()
  const phase = shotPhase(frame, shot)
  const local = frame - shot.cues[phase]
  const copy = copyFor(shot.language)
  const title = copy.intro.phases[phase]
  return (
    <BeatStage shot={shot}>
      <div style={{ position: 'absolute', left: portrait ? 80 : 96, top: portrait ? 400 : 220, width: portrait ? 820 : 1728 }}>
        <Label style={{ color: colors.green, fontSize: portrait ? 25 : 28, letterSpacing: 6 }}>{copy.intro.kicker}</Label>
        <div style={{ marginTop: portrait ? 70 : 42, fontFamily: phase === 2 ? mono : undefined, fontSize: phase === 2 ? (portrait ? 116 : 195) : (portrait ? 80 : 97), fontWeight: phase === 2 ? 400 : 800, letterSpacing: -6, lineHeight: 1.2 }}>{title[0]}</div>
        <div style={{ marginTop: 22, color: colors.green, fontSize: phase === 2 ? (portrait ? 44 : 66) : (portrait ? 106 : 151), fontWeight: 850, letterSpacing: -5, lineHeight: 1.24 }}>{title[1]}</div>
        <div style={{ marginTop: portrait ? 75 : 60, display: 'flex', alignItems: 'center', gap: 27 }}>
          <div style={{ height: 5, width: 80 + enter(local, 0, 28) * 220, background: colors.yellow }} />
          <span style={{ color: '#c3d0c3', fontFamily: mono, fontSize: portrait ? 24 : 30 }}>{copy.intro.sublines[phase]}</span>
        </div>
      </div>
      <Logo size={portrait ? 350 : 290} style={{ position: 'absolute', left: portrait ? 495 : 1490, top: portrait ? 1120 : 690, transform: `rotate(${-12 + enter(local, 0, 12) * 8}deg) scale(${1.2 - enter(local, 0, 10) * 0.2})`, filter: 'drop-shadow(0 0 60px #95ec6925)' }} />
      <div style={{ position: 'absolute', left: portrait ? 80 : 96, top: portrait ? 1160 : 760, fontFamily: mono, fontSize: portrait ? 128 : 142, color: 'transparent', WebkitTextStroke: '1px #95ec6940', lineHeight: 1 }}>
        0
        {phase + 1}
      </div>
      <Burst x={portrait ? 670 : 1620} y={portrait ? 1300 : 830} frame={local} yellow={phase === 1} />
    </BeatStage>
  )
}

export function Outro({ portrait, shot }: ShotProps) {
  const frame = useCurrentFrame()
  const copy = copyFor(shot.language)
  const command = copy.outro.command
  const chars = Math.floor(enter(frame, 60, 50) * command.length)
  return (
    <>
      <Emblem portrait={portrait} language={shot.language} outro />
      <div style={{ position: 'absolute', left: portrait ? 80 : 96, top: portrait ? 900 : 285, right: portrait ? 180 : 800 }}>
        <Reveal><Label style={{ color: colors.green }}>{copy.outro.kicker}</Label></Reveal>
        <Reveal delay={5} style={{ marginTop: 20, fontFamily: mono, fontSize: portrait ? 99 : 112, fontWeight: 400, letterSpacing: -7 }}>weapp-vite</Reveal>
        <Reveal delay={12} style={{ marginTop: 28, fontSize: portrait ? 49 : 46, lineHeight: 1.45, fontWeight: 650 }}>
          {copy.outro.tagline[0]}
          <br />
          <span style={{ color: colors.green }}>{copy.outro.tagline[1]}</span>
        </Reveal>
        <Reveal delay={24} style={{ marginTop: 55, padding: portrait ? '26px 23px' : '25px 30px', background: '#95ec690d', border: '1px solid #95ec6944', borderRadius: 12, display: 'flex', gap: 20, alignItems: 'center' }}>
          <span style={{ color: colors.green, fontFamily: mono, fontSize: 30 }}>›</span>
          <span style={{ fontFamily: mono, fontSize: portrait ? 28 : 33, letterSpacing: -1 }}>{command.slice(0, chars)}</span>
          {frame < 110 && <span style={{ background: colors.green, width: 12, height: 30, opacity: frame % 30 < 15 ? 1 : 0 }} />}
        </Reveal>
        <Reveal delay={36} style={{ marginTop: 30, fontFamily: mono, color: colors.green, fontSize: portrait ? 32 : 31, display: 'flex', justifyContent: 'space-between' }}>
          <span>{copy.outro.url}</span>
          <span>↗</span>
        </Reveal>
      </div>
    </>
  )
}
