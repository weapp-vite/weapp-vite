import type { CSSProperties, ReactNode } from 'react'
import type { Shot } from './timeline'
import { useCurrentFrame } from 'remotion'
import { colors, enter } from './brand'
import { shotPhase } from './timeline'

export function BeatStage({ shot, children, style }: { shot: Shot, children: ReactNode, style?: CSSProperties }) {
  const frame = useCurrentFrame()
  const phase = shotPhase(frame, shot)
  const local = frame - shot.cues[phase]
  const progress = enter(local, 0, 10)
  return <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - progress) * (phase % 2 ? -60 : 60)}px) scale(${1 + (1 - progress) * 0.075})`, ...style }}>{children}</div>
}

export function Burst({ x, y, frame, yellow = false }: { x: number, y: number, frame: number, yellow?: boolean }) {
  const progress = enter(frame, 0, 22)
  if (frame > 26 || frame < 0) {
    return null
  }
  return (
    <svg style={{ position: 'absolute', left: x - 360, top: y - 360, pointerEvents: 'none', overflow: 'visible' }} width="720" height="720" viewBox="-360 -360 720 720">
      {Array.from({ length: 18 }, (_, i) => <line key={i} x1={80 + progress * 140} x2={110 + progress * 220} y1="0" y2="0" stroke={yellow ? colors.yellow : colors.green} strokeWidth={i % 3 === 0 ? 4 : 1} opacity={(1 - progress) * 0.8} transform={`rotate(${i * 20})`} />)}
    </svg>
  )
}
