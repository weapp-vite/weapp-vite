import type { PromoCopy } from '../copy'
import type { ShotProps } from '../timeline'
import { useCurrentFrame } from 'remotion'
import { colors, enter, Label, mono } from '../brand'
import { copyFor } from '../copy'
import { BeatStage, Burst } from '../motion'
import { shotPhase } from '../timeline'

function RuntimeScreen({ portrait, mode, local, copy }: { portrait: boolean, mode: number, local: number, copy: PromoCopy }) {
  const active = local >= 45
  const inputText = copy.language === 'en' ? 'new idea' : '新的灵感'
  const input = inputText.slice(0, Math.floor(enter(local, 5, 36) * inputText.length))
  return (
    <div style={{ position: 'relative', width: portrait ? 740 : 840, padding: portrait ? 40 : 44, borderRadius: 22, background: mode === 2 ? '#ddefd0' : '#eaf1e5', color: '#193520', boxSizing: 'border-box', transform: `rotate(${mode === 1 ? -2 : 0}deg)` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 25, fontWeight: 650 }}>
        <span>{copy.ui.screenTitle}</span>
        <span>•••</span>
      </div>
      <div style={{ marginTop: 40, fontSize: portrait ? 55 : 64, fontWeight: 800 }}>{mode === 2 ? copy.ui.screenReady : copy.ui.screenIdle}</div>
      <div style={{ marginTop: 30, border: `2px solid ${mode === 1 ? '#2ba245' : '#b9c9b3'}`, padding: 23, borderRadius: 12, background: '#ffffff88', fontSize: 32, height: 92, boxSizing: 'border-box', color: mode === 0 ? '#6f8367' : '#193520' }}>{mode === 0 ? copy.ui.screenPrompt : mode === 2 ? inputText : input}</div>
      <div style={{ marginTop: 26, padding: '23px 30px', borderRadius: 12, background: '#244c2c', color: '#c5ffac', fontSize: 32, display: 'flex', justifyContent: 'space-between' }}>
        <span>{mode === 2 || (mode === 1 && active) ? copy.ui.added : copy.ui.add}</span>
        <span>↗</span>
      </div>
      {mode === 1 && <div style={{ position: 'absolute', right: 75, bottom: 42, width: 52, height: 52, borderRadius: '50%', background: '#facc15', border: '5px solid #fff', transform: `scale(${active ? 0.8 : 1.3})`, boxShadow: '0 0 0 16px #facc1533' }} />}
    </div>
  )
}

function Runtime({ portrait, phase, local, copy }: { portrait: boolean, phase: number, local: number, copy: PromoCopy }) {
  return (
    <div style={{ position: 'absolute', left: portrait ? 80 : 96, top: portrait ? 505 : 340, width: portrait ? 820 : 1728, display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: portrait ? 'flex-start' : 'center', gap: portrait ? 58 : 90 }}>
      <div style={{ flex: 1 }}>
        <Label style={{ color: colors.green, fontSize: 24 }}>{[copy.ui.scenario, copy.ui.interaction, copy.ui.observe][phase]}</Label>
        <div style={{ fontSize: portrait ? 78 : 104, fontWeight: 850, lineHeight: 1.3, marginTop: 26 }}>{[copy.ui.enterScene, copy.ui.interact, copy.ui.observeState][phase]}</div>
        <div style={{ marginTop: 30, fontSize: portrait ? 29 : 33, color: '#9eb39d' }}>{[copy.ui.scenarioDetail, copy.ui.interactionDetail, copy.ui.observeDetail][phase]}</div>
        <div style={{ marginTop: 35, fontFamily: mono, color: colors.yellow, fontSize: portrait ? 25 : 28 }}>{['pages/ideas/index', 'input → tap → state', 'state → next action'][phase]}</div>
      </div>
      <RuntimeScreen portrait={portrait} mode={phase} local={local} copy={copy} />
    </div>
  )
}

function Snapshot({ portrait, copy }: { portrait: boolean, copy: PromoCopy }) {
  return (
    <div style={{ position: 'absolute', left: portrait ? 80 : 96, top: portrait ? 490 : 330, width: portrait ? 820 : 1728, display: 'flex', flexDirection: portrait ? 'column' : 'row', gap: portrait ? 45 : 105, alignItems: portrait ? 'flex-start' : 'center' }}>
      <div style={{ position: 'relative', padding: 20, border: '2px solid #95ec6999', borderRadius: 24, background: '#95ec6908' }}>
        <RuntimeScreen portrait={portrait} mode={2} local={70} copy={copy} />
        <div style={{ position: 'absolute', inset: -10, border: '1px dashed #95ec6944', borderRadius: 32 }} />
      </div>
      <div>
        <Label style={{ color: colors.green, fontSize: 24 }}>{copy.ui.screenshot}</Label>
        <div style={{ fontSize: portrait ? 74 : 94, lineHeight: 1.25, fontWeight: 850, marginTop: 25 }}>
          {copy.language === 'en' ? 'A screen,' : '界面，'}
          <br />
          <span style={{ color: colors.green }}>{copy.language === 'en' ? 'worth sharing.' : '有据可看。'}</span>
        </div>
        <div style={{ marginTop: 32, color: '#9eb39d', fontSize: portrait ? 27 : 31 }}>{copy.ui.screenshotDetail}</div>
      </div>
    </div>
  )
}

function Logs({ portrait, local, copy }: { portrait: boolean, local: number, copy: PromoCopy }) {
  const rows = [[copy.ui.logScene, 'pages/ideas/index'], [copy.ui.logInput, copy.language === 'en' ? 'new idea' : '新的灵感'], [copy.ui.logTap, copy.ui.add], [copy.ui.logState, 'items: 1']]
  return (
    <div style={{ position: 'absolute', left: portrait ? 80 : 96, top: portrait ? 500 : 330, width: portrait ? 820 : 1728 }}>
      <Label style={{ color: colors.green, fontSize: 25 }}>{copy.ui.runtimeLog}</Label>
      <div style={{ marginTop: 32, padding: portrait ? '28px 28px' : '25px 45px', borderLeft: '5px solid #95ec69', background: '#95ec6908' }}>
        {rows.map(([kind, content], i) => (
          <div key={kind} style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', gap: portrait ? 8 : 45, padding: portrait ? '16px 0' : '18px 0', opacity: local >= i * 7 ? 1 : 0.25, fontFamily: mono, fontSize: portrait ? 32 : 49 }}>
            <span style={{ minWidth: 200, color: i === 3 ? colors.yellow : '#719977' }}>{kind}</span>
            <span>{content}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: portrait ? 48 : 65, fontWeight: 750, marginTop: 36 }}>
        {copy.ui.logResult}
      </div>
    </div>
  )
}

function Iterate({ portrait, copy }: { portrait: boolean, copy: PromoCopy }) {
  return (
    <div style={{ position: 'absolute', left: portrait ? 80 : 96, top: portrait ? 565 : 350, width: portrait ? 820 : 1728 }}>
      <Label style={{ color: colors.green, fontSize: 24 }}>{copy.ui.keepIterating}</Label>
      <div style={{ marginTop: 35, display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: portrait ? 'flex-start' : 'center', gap: portrait ? 28 : 60 }}>
        {[copy.ui.code, copy.ui.run, copy.ui.evidence].map((name, i) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 55 }}>
            <span style={{ fontSize: portrait ? 84 : 112, fontWeight: 850, color: i === 2 ? colors.yellow : colors.white }}>{name}</span>
            <span style={{ color: colors.green, fontSize: 60 }}>{i === 2 ? '↗' : '→'}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: portrait ? 58 : 83, fontWeight: 750, marginTop: 58, color: colors.green }}>{copy.ui.iterateResult}</div>
    </div>
  )
}

export function Intelligence({ portrait, shot }: ShotProps) {
  const frame = useCurrentFrame()
  const phase = shotPhase(frame, shot)
  const copy = copyFor(shot.language)
  const local = frame - shot.cues[phase]
  const mode = shot.kind === 'runtime' ? 'runtime' : shot.kind === 'evidence' ? ['snapshot', 'logs', 'iterate'][phase] : ['runtime', 'snapshot', 'logs'][phase]
  return (
    <BeatStage shot={shot}>
      {mode === 'runtime' && <Runtime portrait={portrait} phase={shot.kind === 'ai' ? 1 : phase} local={local} copy={copy} />}
      {mode === 'snapshot' && <Snapshot portrait={portrait} copy={copy} />}
      {mode === 'logs' && <Logs portrait={portrait} local={local} copy={copy} />}
      {mode === 'iterate' && <Iterate portrait={portrait} copy={copy} />}
      <Burst x={portrait ? 790 : 1570} y={portrait ? 1290 : 640} frame={local} yellow={mode === 'iterate'} />
    </BeatStage>
  )
}
