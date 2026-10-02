import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { clamp } from './brand'

export function TransitionLight({ points }: { points: readonly number[] }) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const point = points.slice(1, -1).find(cut => frame >= cut * fps - 14 && frame <= cut * fps + 22)
  if (point === undefined) {
    return null
  }
  const progress = interpolate(frame, [point * fps - 14, point * fps + 22], [0, 1], clamp)
  return (
    <div style={{ position: 'absolute', width: 240, height: height * 1.5, top: -height * 0.25, left: -300 + (width + 600) * progress, transform: 'skewX(-22deg)', background: 'linear-gradient(90deg, transparent, #95ec6903 55%, #c3ff9017 98%, #c3ff9060 99%, transparent)', opacity: Math.sin(progress * Math.PI) }} />
  )
}
