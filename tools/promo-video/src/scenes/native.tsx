import type { ShotProps } from '../timeline'
import { useCurrentFrame } from 'remotion'
import { colors, Label, mono } from '../brand'
import { BeatStage, Burst } from '../motion'
import { shotPhase } from '../timeline'

const files = ['app.ts', 'pages/index/index.wxml', 'pages/index/index.wxss', 'pages/index/index.ts']
const toolchain = [
  { name: 'TypeScript', code: 'const count: number = 0', caption: '让类型，成为你的助手。', badge: 'TS' },
  { name: 'Vite + Rolldown', code: 'wv dev', caption: '现代构建，进入小程序。', badge: 'V' },
  { name: 'ESM + Tailwind', code: 'import dayjs from \'dayjs\'', caption: '熟悉的生态，继续创造。', badge: '{ }' },
]

export function Native({ portrait, shot }: ShotProps) {
  const frame = useCurrentFrame()
  const phase = shotPhase(frame, shot)
  const local = frame - shot.cues[phase]
  const tools = shot.kind === 'toolchain' || (shot.kind === 'native-toolchain' && phase > 0)
  const tool = toolchain[shot.kind === 'native-toolchain' ? phase - 1 : phase] ?? toolchain[0]
  const left = portrait ? 80 : 96
  return (
    <BeatStage shot={shot}>
      {tools
        ? (
            <div style={{ position: 'absolute', left, top: portrait ? 525 : 345, width: portrait ? 820 : 1728 }}>
              <Label style={{ color: colors.green, fontSize: 23 }}>
                MODERN TOOLCHAIN / 0
                {phase + 1}
              </Label>
              <div style={{ display: 'flex', flexDirection: portrait ? 'column-reverse' : 'row', alignItems: portrait ? 'flex-start' : 'center', gap: portrait ? 38 : 65, marginTop: 40 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: mono, fontSize: portrait ? 65 : 111, letterSpacing: -6, color: colors.white }}>{tool.name}</div>
                  <div style={{ marginTop: 34, fontSize: portrait ? 32 : 42, color: colors.green }}>{tool.caption}</div>
                </div>
                <div style={{ width: portrait ? 300 : 360, height: portrait ? 300 : 360, background: phase === 2 ? colors.yellow : colors.green, color: '#122014', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: portrait ? 145 : 180, transform: `rotate(${phase % 2 ? -7 : 5}deg)`, borderRadius: 20 }}>{tool.badge}</div>
              </div>
              <div style={{ marginTop: portrait ? 64 : 60, borderTop: '1px solid #95ec6950', paddingTop: 30, fontFamily: mono, fontSize: portrait ? 33 : 42, color: '#9baa9d' }}>
                ›
                {tool.code}
              </div>
            </div>
          )
        : phase === 0
          ? (
              <div style={{ position: 'absolute', left, top: portrait ? 550 : 325, width: portrait ? 820 : 1540 }}>
                <Label style={{ fontSize: 24, color: colors.green }}>YOUR PROJECT</Label>
                {files.map((file, i) => (
                  <div key={file} style={{ display: 'flex', alignItems: 'center', height: portrait ? 145 : 120, gap: 35, borderBottom: '1px solid #95ec6925' }}>
                    <span style={{ color: '#5f8565', fontFamily: mono, fontSize: 25 }}>
                      0
                      {i + 1}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: portrait ? 39 : 65, letterSpacing: -2, color: i === Math.min(3, Math.floor(local / 23)) ? colors.green : colors.white }}>{file}</span>
                  </div>
                ))}
              </div>
            )
          : phase === 1
            ? (
                <div style={{ position: 'absolute', left, top: portrait ? 580 : 350, width: portrait ? 820 : 1728 }}>
                  <Label style={{ color: colors.green, fontSize: 25 }}>原生的写法，原生的能力。</Label>
                  {['Page({ ... })', 'Component({ ... })'].map((text, i) => <div key={text} style={{ marginTop: 45, fontFamily: mono, fontSize: portrait ? 70 : 110, color: i ? colors.green : colors.white, letterSpacing: -4 }}>{text}</div>)}
                  <div style={{ marginTop: 50, fontSize: 36, color: '#8fa694' }}>WXML · WXSS · JSON</div>
                </div>
              )
            : (
                <div style={{ position: 'absolute', left, top: portrait ? 620 : 345, width: portrait ? 820 : 1728 }}>
                  <div style={{ fontSize: portrait ? 90 : 125, fontWeight: 850, letterSpacing: -4 }}>
                    原生能力
                    <span style={{ color: colors.green }}>，</span>
                  </div>
                  <div style={{ fontSize: portrait ? 112 : 180, fontWeight: 850, color: colors.green, letterSpacing: -6 }}>继续用。</div>
                  <div style={{ marginTop: 50, fontSize: portrait ? 31 : 40, color: '#a2b6a6' }}>从现有项目开始，渐进升级。</div>
                </div>
              )}
      <Burst x={portrait ? 700 : 1610} y={portrait ? 820 : 600} frame={local} yellow={phase === 2} />
    </BeatStage>
  )
}
