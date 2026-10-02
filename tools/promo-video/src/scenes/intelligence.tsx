import { useCurrentFrame } from 'remotion'
import { colors, enter, Label, mono, Reveal } from '../brand'

function Evidence({ portrait }: { portrait: boolean }) {
  const frame = useCurrentFrame()
  const focus = Math.floor(frame / 70) % 3
  return (
    <div style={{ position: 'absolute', left: portrait ? 100 : 190, top: portrait ? 505 : 330, width: portrait ? 770 : 600, height: portrait ? 540 : 550, border: '1px solid #95ec6938', borderRadius: 22, background: 'linear-gradient(140deg, #152318, #0b100e)', overflow: 'hidden' }}>
      <div style={{ padding: '22px 28px', borderBottom: '1px solid #ffffff13', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Label style={{ fontSize: 18 }}>RUNTIME / 运行现场</Label>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.green }} />
      </div>
      <div style={{ margin: 25, position: 'relative', height: 415, borderRadius: 12, background: '#dcead2', overflow: 'hidden', padding: 30, boxSizing: 'border-box' }}>
        <div style={{ color: '#1b3523', fontSize: 27, fontWeight: 750 }}>Hello, possibility.</div>
        <div style={{ marginTop: 12, color: '#637e68', fontSize: 18 }}>每一个想法，都能被看见。</div>
        <div style={{ display: 'flex', gap: 15, marginTop: 22 }}>
          <div style={{ width: '56%', height: 120, background: '#223d2b', borderRadius: 9, color: '#c2fda8', padding: 20, boxSizing: 'border-box' }}>
            <div style={{ fontSize: 14, fontFamily: mono }}>CREATE</div>
            <div style={{ fontSize: 49, fontFamily: mono }}>
              01
              <span style={{ fontSize: 18 }}>↗</span>
            </div>
          </div>
          <div style={{ flex: 1, background: '#b2cf9b', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 54, color: '#36563b' }}>✳</div>
        </div>
        {['界面与交互', '运行时状态'].map(text => (
          <div key={text} style={{ marginTop: 15, height: 42, borderBottom: '1px solid #365b302a', color: '#35573b', fontSize: 20, display: 'flex', justifyContent: 'space-between' }}>
            <span>{text}</span>
            <span>↗</span>
          </div>
        ))}
        <div style={{ position: 'absolute', top: 90 + Math.sin(frame / 55) * 15 + focus * 60, left: 20, right: 20, height: 100, border: '1px solid #2a603075', borderRadius: 8, boxShadow: '0 0 0 200px #0b170b08', transition: 'none' }} />
      </div>
    </div>
  )
}

export function Intelligence({ portrait }: { portrait: boolean }) {
  const frame = useCurrentFrame()
  const steps = [['01', '场景', 'SCENARIO', '点击 · 输入 · 页面状态'], ['02', '证据', 'EVIDENCE', '运行日志 · 截图'], ['03', '协作', 'ITERATION', '根据运行结果继续迭代']]
  return (
    <>
      <Reveal delay={12}><Evidence portrait={portrait} /></Reveal>
      <div style={{ position: 'absolute', left: portrait ? 100 : 1030, top: portrait ? 1130 : 350, width: portrait ? 770 : 670 }}>
        {steps.map(([n, title, english, desc], i) => (
          <Reveal key={n} delay={25 + i * 16} style={{ display: 'flex', gap: portrait ? 22 : 28, paddingBottom: portrait ? 22 : 30, marginBottom: portrait ? 22 : 31, borderBottom: '1px solid #a4c69b22', alignItems: 'baseline' }}>
            <span style={{ fontFamily: mono, fontSize: 23, color: colors.green }}>{n}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
                <span style={{ fontSize: portrait ? 33 : 41, fontWeight: 600 }}>{title}</span>
                <Label style={{ fontSize: 16 }}>{english}</Label>
              </div>
              <div style={{ marginTop: 12, color: '#8fa695', fontSize: portrait ? 24 : 26 }}>{desc}</div>
            </div>
            <span style={{ fontFamily: mono, fontSize: 27, color: colors.green, opacity: 0.25 + enter(frame, 25 + i * 25) * 0.75 }}>↗</span>
          </Reveal>
        ))}
      </div>
    </>
  )
}
