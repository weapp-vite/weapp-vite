import { useCurrentFrame } from 'remotion'
import { colors, enter, Label, mono, Reveal } from '../brand'

const files = [['01', 'app.ts', '入口'], ['02', 'pages/index/', '页面'], ['03', '  index.wxml', '模板'], ['04', '  index.wxss', '样式'], ['05', '  index.ts', '逻辑'], ['06', '  index.json', '配置']]

export function Native({ portrait }: { portrait: boolean }) {
  const frame = useCurrentFrame()
  const progress = enter(frame, 35, 100)
  const left = portrait ? 80 : 96
  const top = portrait ? 500 : 320
  const width = portrait ? 820 : 775
  return (
    <>
      <Reveal delay={12} style={{ position: 'absolute', left, top, width, height: portrait ? 570 : 558, borderTop: '1px solid #91ba9340', borderBottom: '1px solid #91ba9325', background: 'linear-gradient(115deg, #152117b3, #111a1240)', padding: portrait ? '25px 30px' : '30px 35px', boxSizing: 'border-box' }}>
        <Label style={{ fontSize: 18 }}>YOUR PROJECT / 原生工程</Label>
        <div style={{ marginTop: 24 }}>
          {files.map(([n, file, hint], i) => (
            <Reveal key={file} delay={18 + i * 6} style={{ display: 'flex', gap: 27, height: 66, alignItems: 'center', borderBottom: '1px solid #ffffff07' }}>
              <span style={{ fontFamily: mono, fontSize: 17, color: '#56705b' }}>{n}</span>
              <span style={{ fontFamily: mono, fontSize: portrait ? 34 : 35, whiteSpace: 'pre', color: i < 2 ? '#c7d4ca' : colors.white }}>{file}</span>
              <span style={{ marginLeft: 'auto', color: '#78957e', fontSize: 19 }}>{hint}</span>
            </Reveal>
          ))}
        </div>
        <div style={{ marginTop: 15, fontSize: 22, color: colors.green }}>Page / Component · 原生能力继续使用</div>
      </Reveal>
      <svg width={portrait ? 1080 : 1920} height={portrait ? 1920 : 1080} style={{ position: 'absolute', inset: 0 }}>
        <path d={portrait ? 'M490 1070 L490 1148 L765 1148' : 'M870 600 L998 600 L1058 540 L1190 540'} stroke="#95ec6925" strokeWidth="2" fill="none" />
        <path d={portrait ? 'M490 1070 L490 1148 L765 1148' : 'M870 600 L998 600 L1058 540 L1190 540'} stroke={colors.green} strokeWidth="3" fill="none" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress} />
      </svg>
      <div style={{ position: 'absolute', left: portrait ? 80 : 1160, top: portrait ? 1180 : 375, width: portrait ? 820 : 600 }}>
        <Reveal delay={45}><Label style={{ color: colors.green, fontSize: 18 }}>MODERN TOOLCHAIN</Label></Reveal>
        <Reveal delay={55} style={{ marginTop: 20, fontFamily: mono, fontSize: portrait ? 73 : 103, letterSpacing: -5, lineHeight: 1.25 }}>
          Vite
          <span style={{ color: colors.green }}> + </span>
          TS
        </Reveal>
        <Reveal delay={66} style={{ marginTop: 22, fontSize: portrait ? 28 : 30, color: '#c6d5c7' }}>ESM · Rolldown · Tailwind CSS</Reveal>
        <Reveal delay={78} style={{ marginTop: 38, height: 1, background: '#95ec6940', width: `${progress * 100}%` }} />
        <Reveal delay={90} style={{ marginTop: 26, fontSize: portrait ? 25 : 30, color: '#7f9486' }}>从现有项目开始，让工具链向前。</Reveal>
      </div>
    </>
  )
}
