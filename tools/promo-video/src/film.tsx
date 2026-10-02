import type { ComponentType } from 'react'
import type { ShotKind, ShotProps } from './timeline'
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion'
import { Background } from './background'
import { colors, Heading, mono, sans } from './brand'
import { Automation } from './scenes/automation'
import { Experience } from './scenes/experience'
import { Intro, Outro } from './scenes/identity'
import { Intelligence } from './scenes/intelligence'
import { Native } from './scenes/native'
import { filmSpecs } from './timeline'
import { TransitionLight } from './transitionLight'
import './fonts'

const components: Record<ShotKind, ComponentType<ShotProps>> = {
  'intro': Intro,
  'outro': Outro,
  'native': Native,
  'toolchain': Native,
  'native-toolchain': Native,
  'sfc': Experience,
  'reactivity': Experience,
  'style': Experience,
  'vue': Experience,
  'routes': Automation,
  'components': Automation,
  'packages': Automation,
  'automation': Automation,
  'runtime': Intelligence,
  'evidence': Intelligence,
  'ai': Intelligence,
}

export function Film({ portrait }: { portrait: boolean }) {
  const film = filmSpecs[portrait ? 1 : 0]
  return (
    <AbsoluteFill style={{ fontFamily: sans, color: colors.white, background: colors.bg, overflow: 'hidden' }}>
      <Background portrait={portrait} />
      {film.shots.map((shot, index) => {
        const Component = components[shot.kind]
        const identity = shot.kind === 'intro' || shot.kind === 'outro'
        return (
          <Sequence key={shot.id} from={shot.startFrame} durationInFrames={shot.frames}>
            {!identity && <Heading portrait={portrait} eyebrow={`${String(index + 1).padStart(2, '0')} / ${shot.label.toUpperCase()}`} first={shot.title[0]} accent={shot.title[1]} />}
            <Component portrait={portrait} shot={shot} />
            {!identity && <div style={{ position: 'absolute', left: portrait ? 80 : 96, bottom: portrait ? 312 : 88, fontSize: portrait ? 19 : 16, letterSpacing: 2, color: '#8b9b8e' }}>功能演绎</div>}
            <div style={{ position: 'absolute', right: portrait ? 180 : 96, bottom: portrait ? 312 : 88, fontFamily: mono, fontSize: 22, color: '#95ec6980' }}>
              {String(index + 1).padStart(2, '0')}
              {' '}
              /
              {' '}
              {film.shots.length}
            </div>
          </Sequence>
        )
      })}
      <TransitionLight points={film.cuts} />
      <Audio src={staticFile(`audio/${film.name}.wav`)} />
    </AbsoluteFill>
  )
}
