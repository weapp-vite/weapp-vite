import type { CSSProperties, ReactNode } from 'react'
import type { PromoCopy } from '../copy'
import type { ShotProps } from '../timeline'
import { interpolate, useCurrentFrame } from 'remotion'
import { copyFor } from '../copy'
import { shotPhase } from '../timeline'

const green = '#95ec69'
const yellow = '#facc15'
const white = '#f0f5ef'
const muted = '#85968b'
const mono = 'JetBrains Mono, monospace'
const position: CSSProperties = { position: 'absolute' }
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

function Label({ children, style }: { children: ReactNode, style?: CSSProperties }) {
  return <div style={{ fontFamily: mono, fontSize: 26, letterSpacing: 2, color: muted, ...style }}>{children}</div>
}

function Code({ children, portrait, label }: { children: ReactNode, portrait: boolean, label: string }) {
  return (
    <div style={{ borderTop: `1px solid ${green}70`, borderBottom: `1px solid ${green}40`, background: 'linear-gradient(125deg,#16251a,#0c130e)', padding: portrait ? '28px 29px' : '30px 42px', boxSizing: 'border-box' }}>
      <Label style={{ fontSize: portrait ? 23 : 25, color: green, marginBottom: 29 }}>{label}</Label>
      <div style={{ fontFamily: mono, fontSize: portrait ? 35 : 47, lineHeight: 1.65, color: white, letterSpacing: -1 }}>{children}</div>
    </div>
  )
}

function Folder({ portrait }: { portrait: boolean }) {
  return (
    <svg width={portrait ? 430 : 530} height={portrait ? 320 : 394} viewBox="0 0 530 394" fill="none">
      <path d="M18 61Q18 25 54 25H205L250 77H477Q514 77 514 114V348Q514 374 480 374H51Q18 374 18 342Z" fill="#24462a" stroke={green} strokeWidth="2" />
      <path d="M18 145Q18 120 45 120H485Q514 120 514 149V348Q514 374 480 374H51Q18 374 18 342Z" fill="#101f13" stroke="#7cb46b" strokeWidth="2" />
      <path d="M231 220h69m-34-35v70" stroke={green} strokeWidth="6" strokeLinecap="round" />
      <path d="M75 316h179" stroke="#36583b" strokeWidth="8" strokeLinecap="round" />
    </svg>
  )
}

function ComponentPreview({ portrait, copy }: { portrait: boolean, copy: PromoCopy }) {
  return (
    <div style={{ width: portrait ? 730 : 650, height: portrait ? 490 : 480, borderRadius: 28, background: '#dcebd4', padding: portrait ? 40 : 42, color: '#14311b', boxSizing: 'border-box', boxShadow: '0 35px 100px #0008', transform: 'rotate(-2deg)' }}>
      <Label style={{ color: '#537953', fontSize: 23 }}>INSPIRE CARD / 01</Label>
      <div style={{ marginTop: 42, fontSize: portrait ? 87 : 82, fontWeight: 850, lineHeight: 1.16, letterSpacing: -5 }}>
        {copy.language === 'en' ? 'Next idea,' : '下一次灵感，'}
        <br />
        {copy.language === 'en' ? 'right now.' : '就在此刻。'}
      </div>
      <div style={{ marginTop: 35, height: 1, background: '#72956860' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 29, fontSize: 28, color: '#4b6e49' }}>
        <span>{copy.language === 'en' ? 'Start with one component' : '从一个组件开始'}</span>
        <span style={{ fontSize: 45, lineHeight: 1 }}>↗</span>
      </div>
    </div>
  )
}

function PackageTree({ portrait, copy }: { portrait: boolean, copy: PromoCopy }) {
  return (
    <div style={{ position: 'relative', width: portrait ? 820 : 1450, height: portrait ? 660 : 435 }}>
      <svg width={portrait ? 820 : 1450} height={portrait ? 660 : 435} style={{ position: 'absolute', inset: 0 }}>
        <path d={portrait ? 'M410 110V265M190 405V265H630V405' : 'M725 75V198M290 300V198H1155V300'} stroke="#3f6946" strokeWidth="3" fill="none" />
        <circle cx={portrait ? 410 : 725} cy={portrait ? 265 : 198} r="7" fill={yellow} />
      </svg>
      <div style={{ ...position, top: 0, left: portrait ? 160 : 460, width: portrait ? 500 : 530, textAlign: 'center', whiteSpace: 'nowrap', fontFamily: mono, fontSize: portrait ? 47 : 60, color: green }}>npm + packages</div>
      {(copy.language === 'en' ? ['MAIN', 'SUBPACKAGE'] : ['主包', '分包']).map((label, index) => (
        <div key={label} style={{ ...position, left: portrait ? 10 + index * 440 : 65 + index * 865, top: portrait ? 408 : 292, width: portrait ? 360 : 450, textAlign: 'center' }}>
          <div style={{ fontSize: portrait ? 82 : 83, fontWeight: 800, lineHeight: 1.1, color: index ? yellow : white }}>{label}</div>
          <Label style={{ marginTop: 21, fontSize: portrait ? 23 : 26 }}>{index ? 'subPackages' : 'pages'}</Label>
        </div>
      ))}
    </div>
  )
}

export function Automation({ portrait, shot }: ShotProps) {
  const frame = useCurrentFrame()
  const phase = shotPhase(frame, shot)
  const age = frame - shot.cues[phase]!
  const settle = interpolate(age, [0, 9], [0, 1], clamp)
  const anthology = shot.kind === 'automation'
  const copy = copyFor(shot.language)
  const kind = anthology ? ['routes', 'components', 'packages'][phase] : shot.kind
  return (
    <div style={{ ...position, left: portrait ? 80 : 96, top: portrait ? 485 : 310, width: portrait ? 820 : 1728, height: portrait ? 1040 : 610, color: white, fontFamily: 'Noto Sans SC, sans-serif', transform: `translateX(${(1 - settle) * (phase % 2 ? 1 : -1) * (portrait ? 12 : 40)}px) scale(${1 + (1 - settle) * (portrait ? 0.018 : 0.035)})`, opacity: 0.35 + settle * 0.65 }}>
      {kind === 'routes' && (phase === 0 || anthology) && (
        <>
          <div style={{ ...position, left: portrait ? 175 : 70, top: portrait ? 60 : 50, transform: 'rotate(-5deg)' }}><Folder portrait={portrait} /></div>
          <div style={{ ...position, left: portrait ? 10 : 760, top: portrait ? 458 : 111, width: portrait ? 800 : 885 }}>
            <Label style={{ color: green, marginBottom: 28 }}>{copy.ui.routeLabel}</Label>
            <Code portrait={portrait} label={copy.ui.createFile}>
              pages/inspire/
              <br />
              <span style={{ color: green }}>index.vue</span>
            </Code>
            <div style={{ marginTop: 32, fontSize: portrait ? 60 : 63, fontWeight: 750, letterSpacing: -2 }}>{portrait ? copy.ui.autoDiscover : copy.shots.routes.phases[0].detail}</div>
          </div>
        </>
      )}
      {kind === 'routes' && !anthology && phase === 1 && (
        <>
          <Label style={{ ...position, top: 38, left: 77, color: green }}>FILE → ROUTE</Label>
          <div style={{ ...position, top: 119, left: 75, fontSize: 138, fontWeight: 900, letterSpacing: -9 }}>
            {copy.language === 'en' ? 'AUTO' : '自动'}
            <span style={{ color: green }}>{copy.language === 'en' ? 'DISCOVER.' : '发现。'}</span>
          </div>
          <div style={{ ...position, top: 339, left: 95, fontFamily: mono, fontSize: 44, color: '#b5cbb6' }}>
            pages/inspire/index.vue
            <span style={{ color: green, padding: '0 35px' }}>→</span>
            {' '}
            app.json
          </div>
          <div style={{ ...position, top: 488, left: 100, width: 1450, height: 2, background: '#25412c' }}><div style={{ height: 2, width: `${Math.min(1, age / 28) * 100}%`, background: green }} /></div>
        </>
      )}
      {kind === 'routes' && !anthology && phase === 2 && (
        <div style={{ ...position, left: 168, top: 41, width: 1390 }}>
          <Code portrait={false} label="app.json">
            <span style={{ color: '#839b89' }}>&#123; </span>
            "pages": [
            <span style={{ color: green }}>"pages/inspire/index"</span>
            ]
            <span style={{ color: '#839b89' }}> &#125;</span>
          </Code>
          <div style={{ marginTop: 52, display: 'flex', alignItems: 'center', gap: 35 }}>
            <span style={{ color: green, fontSize: 80 }}>↗</span>
            <span style={{ fontSize: 105, fontWeight: 800, letterSpacing: -6 }}>{copy.ui.readyNavigate}</span>
          </div>
        </div>
      )}
      {kind === 'components' && (phase === 0 || anthology) && (
        <>
          <div style={{ ...position, left: portrait ? 0 : 72, top: portrait ? 25 : 32, width: portrait ? 820 : 1570 }}>
            <Label style={{ color: green, fontSize: 27 }}>{copy.ui.componentWrite}</Label>
            <div style={{ fontFamily: mono, color: green, fontSize: portrait ? 69 : 113, letterSpacing: -6, marginTop: 35 }}>&lt;InspireCard /&gt;</div>
            {!portrait && <Code portrait={false} label={copy.ui.localComponent}>components/InspireCard.vue</Code>}
          </div>
          {portrait && <div style={{ ...position, left: 44, top: 362 }}><ComponentPreview portrait copy={copy} /></div>}
          {!portrait && <div style={{ ...position, top: 469, left: 79, fontSize: 55 }}>{copy.language === 'en' ? 'Write a component. Connect the UI.' : '写下组件，连接界面。'}</div>}
        </>
      )}
      {kind === 'components' && !anthology && phase === 1 && (
        <div style={{ ...position, left: 117, top: 56, width: 1480 }}>
          <Label style={{ color: green }}>{copy.ui.autoImport}</Label>
          <div style={{ fontFamily: mono, fontSize: 112, color: green, marginTop: 41, letterSpacing: -7 }}>usingComponents</div>
          <div style={{ fontFamily: mono, color: '#b6c8b9', fontSize: 44, marginTop: 43 }}>
            <span style={{ color: yellow }}>'inspire-card'</span>
            <span style={{ padding: '0 30px' }}>→</span>
            'components/InspireCard'
          </div>
          <div style={{ marginTop: 73, fontSize: 57, fontWeight: 750 }}>{copy.ui.relationGenerated}</div>
        </div>
      )}
      {kind === 'components' && !anthology && phase === 2 && (
        <>
          <div style={{ ...position, left: 55, top: 116 }}>
            <Label style={{ color: green }}>{copy.ui.readyCompose}</Label>
            <div style={{ marginTop: 27, fontSize: 119, fontWeight: 800, lineHeight: 1.15, letterSpacing: -7 }}>
              {copy.language === 'en' ? 'Components,' : '组件，'}
              <br />
              <span style={{ color: green }}>{copy.language === 'en' ? 'right here.' : '就在这里。'}</span>
            </div>
          </div>
          <div style={{ ...position, left: 1000, top: 35 }}><ComponentPreview portrait={false} copy={copy} /></div>
        </>
      )}
      {kind === 'packages' && !anthology && phase === 0 && (
        <div style={{ ...position, left: 109, top: 30, width: 1480 }}>
          <Label style={{ color: green }}>{copy.ui.ecosystem}</Label>
          <div style={{ fontFamily: mono, fontSize: 185, fontWeight: 700, letterSpacing: -13, color: green, lineHeight: 1.3 }}>
            npm
            <span style={{ fontSize: 110, color: '#527459', marginLeft: 65 }}>→</span>
            <span style={{ fontSize: 96, color: white, marginLeft: 64 }}>{copy.language === 'en' ? 'mini program' : '小程序'}</span>
          </div>
          <Code portrait={false} label="USE WHAT YOU KNOW">
            import dayjs from
            {' '}
            <span style={{ color: yellow }}>'dayjs'</span>
          </Code>
        </div>
      )}
      {kind === 'packages' && (anthology || phase === 1) && (
        <div style={{ ...position, left: portrait ? 0 : 135, top: portrait ? 18 : 55 }}>
          <Label style={{ color: green, marginBottom: portrait ? 58 : 22, fontSize: portrait ? 28 : 27 }}>{copy.ui.dependencies}</Label>
          <PackageTree portrait={portrait} copy={copy} />
          <div style={{ textAlign: 'center', marginTop: portrait ? 49 : 15, fontSize: portrait ? 52 : 46, fontWeight: 700 }}>{copy.ui.organized}</div>
        </div>
      )}
      {kind === 'packages' && !anthology && phase === 2 && (
        <>
          <div style={{ ...position, top: 27, left: 70 }}>
            <Label style={{ color: green }}>{copy.ui.oneToolchain}</Label>
            <div style={{ fontSize: 125, lineHeight: 1.13, fontWeight: 850, letterSpacing: -7, marginTop: 31 }}>
              {copy.language === 'en' ? 'Dependencies aligned.' : '依赖有序。'}
              <br />
              <span style={{ color: green }}>{copy.language === 'en' ? 'Packages in order.' : '分包有章。'}</span>
            </div>
            <div style={{ fontSize: 34, color: muted, marginTop: 39 }}>{copy.language === 'en' ? 'npm and subPackages, one toolchain.' : 'npm 与 subPackages，统一处理。'}</div>
          </div>
          {['MAIN', 'PACKAGE A', 'PACKAGE B'].map((label, index) => (
            <div key={label} style={{ ...position, left: 1115 - index * 20, top: 69 + index * 122, width: 478, height: 112, background: index === 0 ? green : '#1d3524', border: `1px solid ${green}55`, color: index === 0 ? '#0c1d0b' : '#cfe4c7', transform: `rotate(${index * -4}deg)`, borderRadius: 12, fontFamily: mono, fontSize: 35, display: 'flex', alignItems: 'center', paddingLeft: 30, boxSizing: 'border-box' }}>
              {label}
              <span style={{ marginLeft: 'auto', marginRight: 30 }}>↗</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
