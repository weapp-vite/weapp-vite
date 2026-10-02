import type { CSSProperties } from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

const green = '#95ec69'
const yellow = '#facc15'
const white = '#f0f5ef'
const gray = '#85968b'
const mono = 'JetBrains Mono, monospace'

function SyntaxLine({ text, active, number, portrait, tint }: {
  text: string
  active: boolean
  number: number
  portrait: boolean
  tint: string
}) {
  const parts = text.split(/('wevu'|#[\da-f]{6}|ref|computed|count|doubled|import|from|const|<\/?\w+|>|\{\{.*?\}\})/g)
  return (
    <div style={{ display: 'flex', height: portrait ? 31 : 35, alignItems: 'center', background: active ? `${tint}12` : 'transparent', borderLeft: `3px solid ${active ? tint : 'transparent'}` }}>
      <span style={{ width: portrait ? 44 : 56, flexShrink: 0, color: '#435348', fontSize: 17, textAlign: 'right', paddingRight: 18 }}>{number}</span>
      <span style={{ whiteSpace: 'pre', color: '#cbd6ce', fontSize: portrait ? 26 : 28, letterSpacing: '-0.7px' }}>
        {parts.map((part, index) => (
          <span key={`${index}-${part}`} style={{ color: /^(?:import|from|const)$/.test(part) ? '#bda5ef' : /^(?:ref|computed)$/.test(part) ? '#c4d9f7' : part === '\'wevu\'' || part.startsWith('#') ? tint : part.startsWith('<') || part === '>' ? '#899e90' : undefined }}>{part}</span>
        ))}
      </span>
    </div>
  )
}

export function Experience({ portrait }: { portrait: boolean }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const seconds = frame / fps
  const steps = portrait ? [1.5, 3, 4.5, 8] : [2, 4, 6, 12.4]
  const count = steps.filter(step => seconds >= step).length
  const themeAt = portrait ? 6.4 : 9
  const theme = interpolate(seconds, [themeAt, themeAt + 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const tint = theme > 0.5 ? yellow : green
  const enter = interpolate(frame, [0, 34], [0, 1], { extrapolateRight: 'clamp' })
  const lastStep = [...steps].reverse().find(step => seconds >= step) ?? -10
  const click = Math.max(0, 1 - (seconds - lastStep) / 0.45)
  const styleActive = seconds >= themeAt && seconds < themeAt + 1.8
  const panel: CSSProperties = { position: 'absolute', border: '1px solid #334139', borderRadius: 25, overflow: 'hidden', boxShadow: '0 34px 100px #0008', opacity: enter }
  const lines = [
    '<script setup>',
    'import { ref, computed } from \'wevu\'',
    'const count = ref(0)',
    'const doubled = computed(',
    '  () => count.value * 2)',
    '</script>',
    '<template>',
    '  <view class="count">{{ doubled }}</view>',
    '  <button @tap="count++">+1</button>',
    '</template>',
    '<style>',
    `.count { color: ${theme > 0.5 ? yellow : green}; }`,
    '</style>',
  ]
  return (
    <div style={{ position: 'absolute', inset: 0, color: white, fontFamily: 'Noto Sans SC, sans-serif' }}>
      <div style={{ ...panel, left: portrait ? 80 : 96, top: portrait ? 470 : 300, width: portrait ? 840 : 970, height: portrait ? 522 : 602, background: '#0c120f', transform: `translateY(${(1 - enter) * 28}px)` }}>
        <div style={{ height: portrait ? 61 : 70, display: 'flex', alignItems: 'center', padding: '0 28px', borderBottom: '1px solid #243128', gap: 9 }}>
          {['#485b4c', '#485b4c', green].map((color, index) => <span key={index} style={{ width: 9, height: 9, borderRadius: 9, background: color }} />)}
          <span style={{ marginLeft: 20, fontSize: portrait ? 25 : 27, color: '#d6e1d7', fontFamily: mono }}>index.vue</span>
          <span style={{ marginLeft: 'auto', fontSize: 17, color: gray, fontFamily: mono }}>VUE SFC</span>
        </div>
        <div style={{ padding: portrait ? '13px 8px 0' : '18px 12px 0', fontFamily: mono }}>
          {lines.map((line, index) => <SyntaxLine key={index} text={line} number={index + 1} portrait={portrait} tint={tint} active={styleActive ? index === 11 : (index === 2 || index === 8) && click > 0} />)}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: portrait ? 36 : 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', background: '#131d16', borderTop: '1px solid #233227', fontSize: portrait ? 19 : 22 }}>
          <span style={{ color: tint }}>{styleActive || theme > 0.5 ? '样式已更新' : '响应式已连接'}</span>
          <span style={{ color: '#9aac9c', fontFamily: mono }}>
            count →
            {' '}
            {count}
            {' · '}
            doubled →
            {' '}
            {count * 2}
          </span>
        </div>
      </div>

      {!portrait && (
        <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, opacity: enter }}>
          <path d="M 1066 601 L 1150 601" stroke="#364b39" strokeWidth="2" strokeDasharray="3 8" />
          <circle cx={1066 + ((frame % 100) / 100) * 84} cy="601" r="4" fill={tint} />
          <path d="M 1134 591 L 1146 601 L 1134 611" fill="none" stroke={tint} strokeWidth="2" />
        </svg>
      )}

      <div style={{ ...panel, left: portrait ? 80 : 1160, top: portrait ? 1030 : 282, width: portrait ? 840 : 648, height: portrait ? 484 : 638, borderRadius: portrait ? 32 : 42, background: 'linear-gradient(140deg,#16201a,#0b110d 76%)', transform: `translateY(${(1 - enter) * 46}px)` }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 30px', borderBottom: '1px solid #26392b' }}>
          <span style={{ fontSize: 22, letterSpacing: 1, color: '#c6d4c8' }}>灵感计数器</span>
          <div style={{ marginLeft: 'auto', width: 90, height: 31, borderRadius: 22, border: '1px solid #526558', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 15 }}>
            <span style={{ fontFamily: mono, fontSize: 16, letterSpacing: 2 }}>•••</span>
            <span style={{ width: 12, height: 12, border: '2px solid #dce7df', borderRadius: 20 }} />
          </div>
        </div>
        <div style={{ position: 'absolute', top: portrait ? 98 : 102, left: 34, right: 34 }}>
          <div style={{ color: gray, fontSize: portrait ? 22 : 22, letterSpacing: 2 }}>让每一次灵感，即刻发生</div>
          <div style={{ position: 'absolute', top: portrait ? 49 : 53, left: portrait ? 7 : 0, width: portrait ? 330 : '100%' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
              <span style={{ color: tint, fontSize: portrait ? 130 : 156, fontWeight: 600, lineHeight: 1.25, letterSpacing: -9, fontFamily: mono, transform: `scale(${1 + click * 0.06})`, transformOrigin: 'center' }}>{count * 2}</span>
              <span style={{ fontSize: 25, color: '#b9c9bc' }}>灵感值</span>
            </div>
            <div style={{ marginTop: portrait ? 9 : 2, fontFamily: mono, color: '#789880', fontSize: 21 }}>
              computed · count × 2
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: portrait ? 420 : 34, right: 34, top: portrait ? 177 : 400 }}>
          <div style={{ fontSize: 20, color: gray, marginBottom: 16 }}>
            已收集
            {' '}
            <span style={{ color: white, fontFamily: mono, fontSize: 28 }}>{count}</span>
            {' '}
            次灵感
          </div>
          <div style={{ height: portrait ? 82 : 85, borderRadius: 17, color: '#10180b', background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 15, fontSize: portrait ? 29 : 31, fontWeight: 700, transform: `scale(${1 - click * 0.035})`, boxShadow: `0 12px 50px ${tint}15` }}>
            <span style={{ fontSize: 37, fontFamily: mono }}>+</span>
            记录一次灵感
          </div>
          <div style={{ marginTop: 21, display: 'flex', alignItems: 'center', gap: 9, fontSize: 18, color: '#829b88' }}>
            <span style={{ width: 6, height: 6, borderRadius: 9, background: tint }} />
            {theme > 0.5 ? '主题已焕新 · 状态依然在线' : '状态更新 · 视图即刻响应'}
          </div>
        </div>
        <div style={{ position: 'absolute', left: '50%', bottom: 14, width: 100, height: 4, marginLeft: -50, borderRadius: 4, background: '#475b4c' }} />
      </div>

      {portrait && <div style={{ position: 'absolute', top: 998, left: 80, width: 840, height: 27, display: 'flex', justifyContent: 'center', alignItems: 'center', color: tint, fontSize: 20, opacity: enter }}>↓</div>}
    </div>
  )
}
