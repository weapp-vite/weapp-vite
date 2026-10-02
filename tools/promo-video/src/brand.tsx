import type { CSSProperties, ReactNode } from 'react'
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion'

export const colors = { bg: '#070a08', green: '#95ec69', yellow: '#facc15', white: '#f0f5ef', muted: '#89968d' }
export const mono = '"JetBrains Mono", monospace'
export const sans = '"Noto Sans SC", sans-serif'
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

export function enter(frame: number, delay = 0, duration = 42) {
  const x = interpolate(frame, [delay, delay + duration], [0, 1], clamp)
  return 1 - (1 - x) ** 4
}

export function Reveal({ children, delay = 0, style = {} }: { children?: ReactNode, delay?: number, style?: CSSProperties }) {
  const progress = enter(useCurrentFrame(), delay)
  return <div style={{ opacity: progress, transform: `translateY(${(1 - progress) * 38}px)`, ...style }}>{children}</div>
}

export function Logo({ size = 64, style }: { size?: number, style?: CSSProperties }) {
  return <Img src={staticFile('logo.svg')} style={{ width: size, height: size, objectFit: 'contain', ...style }} />
}

export function Label({ children, style }: { children: ReactNode, style?: CSSProperties }) {
  return <div style={{ color: colors.muted, fontFamily: mono, fontSize: 19, letterSpacing: 3, ...style }}>{children}</div>
}

export function Heading({ portrait, eyebrow, first, accent }: { portrait: boolean, eyebrow: string, first: string, accent: string }) {
  return (
    <div style={{ position: 'absolute', left: portrait ? 80 : 96, top: portrait ? 178 : 128, right: portrait ? 168 : 96 }}>
      <Reveal><Label style={{ fontSize: portrait ? 20 : 18, color: colors.green }}>{eyebrow}</Label></Reveal>
      <Reveal delay={7} style={{ marginTop: 20, fontSize: portrait ? 65 : 64, lineHeight: 1.35, fontWeight: 750, letterSpacing: -2 }}>
        {first}
        {portrait ? <br /> : ' '}
        <span style={{ color: colors.green }}>{accent}</span>
      </Reveal>
    </div>
  )
}
