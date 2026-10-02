import type { ReactNode } from 'react'
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { Background } from './background'
import { clamp, colors, Heading, sans } from './brand'
import { Automation } from './scenes/automation'
import { Experience } from './scenes/experience'
import { Intro, Outro } from './scenes/identity'
import { Intelligence } from './scenes/intelligence'
import { Native } from './scenes/native'
import { filmSpecs, fps } from './timeline'
import { TransitionLight } from './transitionLight'
import './fonts'

function Scene({ children, duration, first, last }: { children: ReactNode, duration: number, first: boolean, last: boolean }) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, first ? 1 : 14, duration - 14, duration], [first ? 1 : 0, 1, 1, last ? 1 : 0], clamp)
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

export function Film({ portrait }: { portrait: boolean }) {
  const points = filmSpecs[portrait ? 1 : 0].cuts
  const scenes = [
    <Intro key="intro" portrait={portrait} />,
    <>
      <Heading portrait={portrait} eyebrow="01 / NATIVE FIRST" first="保留原生。" accent="渐进升级。" />
      <Native portrait={portrait} />
    </>,
    <>
      <Heading portrait={portrait} eyebrow="02 / DEVELOPER EXPERIENCE" first="熟悉的 Vue 写法，" accent="进入小程序。" />
      <Experience portrait={portrait} />
    </>,
    <>
      <Heading portrait={portrait} eyebrow="03 / LESS REPETITION" first="把重复工作，" accent="交给工具链。" />
      <Automation portrait={portrait} />
    </>,
    <>
      <Heading portrait={portrait} eyebrow="04 / AI × RUNTIME" first="让 AI 看见" accent="运行中的小程序。" />
      <Intelligence portrait={portrait} />
    </>,
    <Outro key="outro" portrait={portrait} />,
  ]
  return (
    <AbsoluteFill style={{ fontFamily: sans, color: colors.white, background: colors.bg }}>
      <Background portrait={portrait} />
      {scenes.map((scene, i) => {
        const duration = (points[i + 1] - points[i]) * fps
        return (
          <Sequence key={points[i]} from={points[i] * fps} durationInFrames={duration}>
            <Scene duration={duration} first={i === 0} last={i === 5}>{scene}</Scene>
            {i > 0 && i < 5 && <div style={{ position: 'absolute', left: portrait ? 80 : 96, bottom: portrait ? 312 : 88, fontSize: portrait ? 19 : 16, letterSpacing: 2, color: '#708375' }}>功能演绎</div>}
          </Sequence>
        )
      })}
      <TransitionLight points={points} />
      <Audio src={staticFile(`audio/${portrait ? 'portrait' : 'landscape'}.wav`)} />
    </AbsoluteFill>
  )
}
