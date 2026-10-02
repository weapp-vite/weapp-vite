import { useCurrentFrame, useVideoConfig } from 'remotion'

export function TransitionLight({ points }: { points: readonly number[] }) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const point = points.slice(1, -1).find(cut => frame >= cut * fps - 4 && frame <= cut * fps + 5)
  if (point === undefined) {
    return null
  }
  const progress = (frame - point * fps + 4) / 9
  const yellow = points.indexOf(point) % 3 === 0
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {[0, 1, 2].map(i => <div key={i} style={{ position: 'absolute', width: i === 0 ? 180 : 32, height: height * 1.6, top: -height * 0.3, left: -650 + (width + 1000) * progress + i * 110, transform: 'skewX(-24deg)', background: yellow ? '#facc15' : '#95ec69', opacity: Math.sin(progress * Math.PI) * (i === 0 ? 0.46 : 0.2) }} />)}
    </div>
  )
}
