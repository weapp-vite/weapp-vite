import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { colors, Label, Logo, mono } from './brand'

export function Background({ portrait }: { portrait: boolean }) {
  const currentFrame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const frame = Math.min(currentFrame, durationInFrames - 120)
  const drift = Math.sin(frame / 240) * 70
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 1400, height: 1400, top: portrait ? 500 : -250, left: portrait ? -300 : 710, transform: `translate(${drift}px, ${drift * 0.5}px)`, background: 'radial-gradient(ellipse, #30512638 0%, #10201222 37%, transparent 67%)' }} />
      <AbsoluteFill style={{ backgroundImage: 'linear-gradient(#a4d69d06 1px, transparent 1px), linear-gradient(90deg, #a4d69d06 1px, transparent 1px)', backgroundSize: '96px 96px', maskImage: 'linear-gradient(transparent, black 30%, black 75%, transparent)' }} />
      <div style={{ position: 'absolute', left: portrait ? 80 : 96, top: portrait ? 93 : 48, display: 'flex', alignItems: 'center', gap: 15 }}>
        <Logo size={34} />
        <span style={{ fontSize: 27, fontFamily: mono, letterSpacing: -1, color: colors.white }}>weapp-vite</span>
      </div>
      {!portrait && <Label style={{ position: 'absolute', top: 60, right: 96, fontSize: 15 }}>NATIVE ROOTS. MODERN FLOW.</Label>}
      <div style={{ position: 'absolute', left: portrait ? 80 : 96, right: portrait ? 180 : 96, bottom: portrait ? 268 : 52, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.green }} />
        <Label style={{ fontSize: portrait ? 17 : 14, letterSpacing: 2 }}>BUILD WITH POSSIBILITY</Label>
        <div style={{ height: 1, flex: 1, background: '#ffffff16' }}><div style={{ height: 1, width: `${frame / (durationInFrames - 120) * 100}%`, background: colors.green }} /></div>
      </div>
    </AbsoluteFill>
  )
}
