import type { CSSProperties, ReactNode } from 'react'
import type { PromoCopy } from '../copy'
import type { ShotProps } from '../timeline'
import { interpolate, useCurrentFrame } from 'remotion'
import { copyFor } from '../copy'
import { shotPhase } from '../timeline'

const green = '#95ec69'
const yellow = '#facc15'
const white = '#f0f5ef'
const gray = '#85968b'
const mono = 'JetBrains Mono, monospace'
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const position: CSSProperties = { position: 'absolute' }

function Label({ children, style }: { children: ReactNode, style?: CSSProperties }) {
  return <div style={{ fontFamily: mono, fontSize: 25, letterSpacing: 2, color: gray, ...style }}>{children}</div>
}

function Code({ lines, portrait, label = 'index.vue', tint = green }: { lines: string[], portrait: boolean, label?: string, tint?: string }) {
  return (
    <div style={{ width: '100%', border: `1px solid ${tint}55`, background: '#0c1510', borderRadius: 22, overflow: 'hidden', boxShadow: `0 28px 100px ${tint}0c` }}>
      <div style={{ display: 'flex', gap: 9, padding: portrait ? '24px 26px' : '23px 34px', borderBottom: '1px solid #ffffff14', alignItems: 'center' }}>
        <span style={{ width: 8, height: 8, background: tint, borderRadius: '50%' }} />
        <span style={{ fontFamily: mono, fontSize: portrait ? 23 : 25, color: '#bccbbc', marginLeft: 10 }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontFamily: mono, color: gray, fontSize: 18 }}>WEVU</span>
      </div>
      <div style={{ padding: portrait ? '29px 25px' : '26px 34px', fontFamily: mono, fontSize: portrait ? 33 : 40, letterSpacing: '-0.9px', lineHeight: portrait ? 1.85 : 1.8 }}>
        {lines.map((line, index) => <div key={line} style={{ whiteSpace: 'pre', color: index === lines.length - 1 ? tint : white }}>{line}</div>)}
      </div>
    </div>
  )
}

function ClickButton({ portrait, age, copy }: { portrait: boolean, age: number, copy: PromoCopy }) {
  const hit = interpolate(age, [0, 6, 14], [0, 1, 0], clamp)
  return (
    <div style={{ position: 'relative', width: portrait ? 740 : 1100, height: portrait ? 245 : 225, borderRadius: 30, background: green, color: '#091308', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30, transform: `scale(${1 - hit * 0.035})`, boxShadow: `0 25px 130px ${green}1b` }}>
      <span style={{ fontSize: portrait ? 84 : 110, fontWeight: 800 }}>{copy.language === 'en' ? 'TAP' : '点击'}</span>
      <span style={{ fontFamily: mono, fontSize: portrait ? 104 : 140, letterSpacing: -7 }}>+1</span>
      <svg width="93" height="122" viewBox="0 0 93 122" style={{ position: 'absolute', right: portrait ? 26 : 64, bottom: -47, transform: `translate(${(1 - hit) * 5}px,${(1 - hit) * 9}px) rotate(-10deg)` }}>
        <path d="M8 8 79 78 43 79 30 111Z" fill={white} stroke="#101a11" strokeWidth="7" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function Result({ portrait, value, name, tint = green, caption }: { portrait: boolean, value: number, name: string, tint?: string, caption: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <Label style={{ color: tint, fontSize: portrait ? 34 : 36 }}>{name}</Label>
      <div style={{ fontFamily: mono, fontSize: portrait ? 330 : 360, lineHeight: 1.12, letterSpacing: -26, color: tint, fontWeight: 600, textShadow: `0 0 110px ${tint}18` }}>{value}</div>
      <div style={{ color: white, fontSize: portrait ? 38 : 46, fontWeight: 550, letterSpacing: -1 }}>{caption}</div>
    </div>
  )
}

function Sfc({ phase, copy }: { phase: number, copy: PromoCopy }) {
  if (phase === 0) {
    return (
      <div style={{ ...position, left: 95, top: 34, width: 1530 }}>
        <Label style={{ color: green, marginBottom: 28 }}>{copy.ui.familiarSyntax}</Label>
        <Code portrait={false} lines={['<script setup>', 'import { ref } from \'wevu\'', 'const count = ref(0)', '</script>']} />
        <div style={{ marginTop: 32, fontSize: 51 }}>{copy.shots.sfc.phases[0].detail}</div>
      </div>
    )
  }
  if (phase === 1) {
    return (
      <>
        {(copy.language === 'en' ? ['LOGIC', 'TEMPLATE', 'STYLE'] : ['逻辑', '模板', '样式']).map((text, index) => (
          <div key={text} style={{ ...position, left: 82, top: 44 + index * 160, fontSize: 87, fontWeight: 750, color: index === 1 ? green : '#c7d7c9', letterSpacing: -5 }}>
            {text}
            <span style={{ color: '#46664a', marginLeft: 80, fontWeight: 400 }}>↘</span>
          </div>
        ))}
        <div style={{ ...position, left: 750, top: 2, width: 460, height: 540, border: `2px solid ${green}88`, borderRadius: '24px 90px 24px 24px', background: 'linear-gradient(135deg,#1c3320,#0b170d)', transform: 'rotate(5deg)', boxShadow: '0 40px 100px #0008' }}>
          <div style={{ margin: '68px 38px 0', fontFamily: mono, fontSize: 140, color: green, letterSpacing: -13 }}>.vue</div>
          <div style={{ margin: '58px 38px 0', height: 1, background: '#95ec6950' }} />
          <Label style={{ margin: '28px 38px', fontSize: 37, color: white }}>index.vue</Label>
        </div>
        <div style={{ ...position, right: 26, top: 125, fontSize: copy.language === 'en' ? 30 : 44, color: gray, writingMode: 'vertical-rl', letterSpacing: 5 }}>{copy.ui.oneFile}</div>
      </>
    )
  }
  return (
    <>
      <div style={{ ...position, top: 55, left: 74 }}>
        <Label style={{ color: green }}>VUE SFC → MINI PROGRAM</Label>
        <div style={{ marginTop: 38, fontSize: 118, fontWeight: 800, lineHeight: 1.14, letterSpacing: -7 }}>
          {copy.language === 'en' ? 'Write the idea.' : '写下想法。'}
          <br />
          <span style={{ color: green }}>{copy.language === 'en' ? 'See the UI.' : '看见界面。'}</span>
        </div>
        <div style={{ marginTop: 36, fontSize: 32, color: gray }}>{copy.shots.sfc.phases[2].detail}</div>
      </div>
      <div style={{ ...position, left: 1060, top: 12, width: 585, height: 566, background: '#dcecd5', borderRadius: 35, color: '#112915', padding: '32px 37px', boxSizing: 'border-box', transform: 'rotate(-2deg)' }}>
        <div style={{ fontSize: 26, fontWeight: 600 }}>
          {copy.language === 'en' ? 'IDEA COUNTER' : '灵感计数器'}
          <span style={{ float: 'right' }}>•••</span>
        </div>
        <Label style={{ color: '#456247', marginTop: 42, fontSize: 21 }}>MAKE SOMETHING NEW</Label>
        <div style={{ fontSize: 116, fontFamily: mono, lineHeight: 1.45 }}>
          0
          <span style={{ fontSize: 26, marginLeft: 25 }}>{copy.language === 'en' ? 'ideas' : '次灵感'}</span>
        </div>
        <div style={{ height: 97, background: '#17391c', color: green, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 600 }}>{copy.language === 'en' ? '+ LOG AN IDEA' : '+ 记录一次灵感'}</div>
        <div style={{ marginTop: 30, color: '#4b7150', fontSize: 22 }}>{copy.language === 'en' ? 'Let every idea grow.' : '让每一个想法开始生长。'}</div>
      </div>
    </>
  )
}

export function Experience({ portrait, shot }: ShotProps) {
  const frame = useCurrentFrame()
  const phase = shotPhase(frame, shot)
  const age = frame - shot.cues[phase]!
  const settle = interpolate(age, [0, 8], [0, 1], clamp)
  const style = shot.kind === 'style'
  const vue = shot.kind === 'vue'
  const copy = copyFor(shot.language)
  return (
    <div style={{ ...position, left: portrait ? 80 : 96, top: portrait ? 470 : 305, width: portrait ? 820 : 1728, height: portrait ? 1050 : 615, color: white, fontFamily: 'Noto Sans SC, sans-serif', transform: `translateY(${(1 - settle) * 24}px) scale(${1 + (1 - settle) * 0.045})`, opacity: 0.4 + settle * 0.6 }}>
      <div style={{ ...position, left: portrait ? 440 : 1200, top: portrait ? 130 : -55, fontFamily: mono, fontSize: portrait ? 480 : 650, color: '#95ec6905', lineHeight: 1 }}>{phase + 1}</div>
      {shot.kind === 'sfc' && <Sfc phase={phase} copy={copy} />}
      {vue && phase === 0 && (
        <div style={{ ...position, top: 106, left: 0, width: 820 }}>
          <Label style={{ color: green, fontSize: 27, marginBottom: 29 }}>WEVU / REF + COMPUTED</Label>
          <Code portrait label={copy.language === 'en' ? 'Wevu · Reactive snippet' : 'Wevu · 响应式片段'} lines={['const count = ref(0)', 'const doubled = computed(', '  () => count.value * 2)']} />
          <div style={{ marginTop: 60, fontSize: 88, fontWeight: 800, letterSpacing: -4, lineHeight: 1.22 }}>
            {copy.language === 'en' ? 'Write state.' : '写下状态。'}
            <br />
            <span style={{ color: green }}>{copy.language === 'en' ? 'Let the UI flow.' : '让界面流动。'}</span>
          </div>
        </div>
      )}
      {((shot.kind === 'reactivity' && phase === 0) || (vue && phase === 1)) && (
        <div style={{ ...position, left: portrait ? 40 : 314, top: portrait ? 140 : 98 }}>
          <Label style={{ color: green, fontSize: portrait ? 29 : 31, marginBottom: 35 }}>{copy.ui.event}</Label>
          <ClickButton portrait={portrait} age={age} copy={copy} />
          <div style={{ fontFamily: mono, fontSize: portrait ? 80 : 60, textAlign: 'center', marginTop: portrait ? 90 : 56 }}>
            {'count = '}
            <span style={{ color: '#58735e' }}>0 → </span>
            <span style={{ color: green }}>1</span>
          </div>
        </div>
      )}
      {shot.kind === 'reactivity' && phase === 1 && (
        <>
          <div style={{ ...position, top: 0, left: 112, width: 500 }}><Result portrait={false} name="count" value={1} caption={copy.ui.stateUpdated} /></div>
          <div style={{ ...position, left: 780, top: 168, width: 770 }}>
            <Label style={{ color: green, marginBottom: 27 }}>ONE SOURCE OF TRUTH</Label>
            <Code portrait={false} label="reactivity" lines={['count.value++']} />
          </div>
        </>
      )}
      {(shot.kind === 'reactivity' || vue) && phase === 2 && (
        <>
          <div style={{ ...position, left: portrait ? 0 : 850, top: portrait ? 228 : 0, width: portrait ? 820 : 650 }}><Result portrait={portrait} name="computed" value={2} caption={copy.ui.computedCaption} /></div>
          <div style={{ ...position, left: portrait ? 38 : 90, top: portrait ? 28 : 171, fontFamily: mono, fontSize: portrait ? 49 : 70, lineHeight: 1.5 }}>
            {'count = '}
            <span>1</span>
            <br />
            <span style={{ color: gray }}>× 2</span>
            <span style={{ color: green, marginLeft: 32 }}>{portrait ? '↓' : '→'}</span>
          </div>
          {!portrait && <Label style={{ ...position, left: 93, top: 432, color: gray, fontSize: 25 }}>computed(() =&gt; count.value * 2)</Label>}
        </>
      )}
      {style && phase === 0 && (
        <>
          <div style={{ ...position, left: 56, top: 0, width: 580 }}><Result portrait={false} name={copy.ui.currentState} value={1} caption={copy.language === 'en' ? 'Keep the state' : '保持当前状态'} /></div>
          <div style={{ ...position, left: 805, top: 120, width: 780 }}>
            <Label style={{ marginBottom: 26, color: green }}>{copy.ui.beforeStyle}</Label>
            <Code portrait={false} label="style" lines={['.count {', '  color: #95ec69;', '}']} />
          </div>
        </>
      )}
      {style && phase === 1 && (
        <div style={{ ...position, left: 220, top: 8, width: 1280 }}>
          <Label style={{ color: yellow, marginBottom: 27 }}>{copy.ui.editStyle}</Label>
          <Code portrait={false} tint={yellow} label="style" lines={['.count {', '  color: #facc15;', '}']} />
          <div style={{ fontSize: 55, color: yellow, marginTop: 39, fontWeight: 700 }}>{copy.language === 'en' ? 'Give the UI a new color.' : '给界面，一点新颜色。'}</div>
        </div>
      )}
      {style && phase === 2 && (
        <>
          <div style={{ ...position, top: 0, left: 225, width: 600 }}><Result portrait={false} name={copy.ui.sameState} value={1} tint={yellow} caption={copy.language === 'en' ? 'Same state. New look.' : '状态保留。风格焕新。'} /></div>
          <div style={{ ...position, left: 1050, top: 73, width: 505, height: 452, background: yellow, borderRadius: 35, transform: 'rotate(5deg)', color: '#191607', padding: 42, boxSizing: 'border-box' }}>
            <Label style={{ color: '#63531c', fontSize: 24 }}>{copy.ui.palette}</Label>
            <div style={{ fontSize: 72, fontWeight: 850, marginTop: 30, lineHeight: 1.08, letterSpacing: -3 }}>
              {copy.language === 'en' ? 'Ideas,' : '灵感，'}
              <br />
              <span style={{ whiteSpace: 'nowrap' }}>{copy.language === 'en' ? 'now shining.' : '正在闪光。'}</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: 26, marginTop: 20 }}>#facc15 ↗</div>
          </div>
        </>
      )}
    </div>
  )
}
