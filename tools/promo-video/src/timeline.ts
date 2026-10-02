import { copyFor } from './copy'

export const fps = 60
export const bpm = 144
export const framesPerBeat = fps * 60 / bpm
export const shotFrames = framesPerBeat * 12
export const actionFrames = [0, framesPerBeat * 4, framesPerBeat * 8] as const

export type Format = 'landscape' | 'portrait'
export type Language = 'zh' | 'en'
export type ShotKind = 'intro' | 'native' | 'toolchain' | 'sfc' | 'reactivity' | 'style' | 'routes' | 'components' | 'packages' | 'runtime' | 'evidence' | 'outro' | 'native-toolchain' | 'vue' | 'automation' | 'ai'
export type Energy = 'hook' | 'build' | 'drive' | 'outro'

interface ShotDefinition {
  kind: ShotKind
  energy: Energy
}

export interface Shot extends ShotDefinition {
  language: Language
  label: string
  title: readonly [string, string]
  id: string
  frames: number
  startFrame: number
  endFrame: number
  cues: readonly number[]
}

export interface ShotProps {
  portrait: boolean
  language: Language
  shot: Shot
}

export interface FilmSpec {
  id: 'PromoLandscape' | 'PromoPortrait' | 'PromoLandscapeEn' | 'PromoPortraitEn'
  name: Format
  language: Language
  width: number
  height: number
  frames: number
  seconds: number
  cuts: number[]
  shots: Shot[]
}

function defineShot(kind: ShotKind, energy: Energy = 'drive'): ShotDefinition {
  return { kind, energy }
}

const landscape = [
  defineShot('intro', 'hook'),
  defineShot('native', 'build'),
  defineShot('toolchain', 'build'),
  defineShot('sfc'),
  defineShot('reactivity'),
  defineShot('style'),
  defineShot('routes'),
  defineShot('components'),
  defineShot('packages'),
  defineShot('runtime'),
  defineShot('evidence'),
  defineShot('outro', 'outro'),
]

const portrait = [
  landscape[0],
  defineShot('native-toolchain', 'build'),
  defineShot('vue'),
  defineShot('automation'),
  defineShot('ai'),
  landscape[11],
]

function makeFilm(name: Format, language: Language, definitions: ShotDefinition[]): FilmSpec {
  const copy = copyFor(language)
  const shots = definitions.map((definition, index): Shot => ({
    ...definition,
    language,
    ...copy.shots[definition.kind],
    id: `${name}-${definition.kind}`,
    frames: shotFrames,
    startFrame: index * shotFrames,
    endFrame: (index + 1) * shotFrames,
    cues: actionFrames,
  }))
  const frames = shots.at(-1)!.endFrame
  return {
    id: language === 'en'
      ? name === 'portrait' ? 'PromoPortraitEn' : 'PromoLandscapeEn'
      : name === 'portrait' ? 'PromoPortrait' : 'PromoLandscape',
    name,
    language,
    width: name === 'portrait' ? 1080 : 1920,
    height: name === 'portrait' ? 1920 : 1080,
    frames,
    seconds: frames / fps,
    cuts: [...shots.map(shot => shot.startFrame / fps), frames / fps],
    shots,
  }
}

export const filmSpecs = [
  makeFilm('landscape', 'zh', landscape),
  makeFilm('portrait', 'zh', portrait),
  makeFilm('landscape', 'en', landscape),
  makeFilm('portrait', 'en', portrait),
] as const

export function shotPhase(frame: number, shot: Shot) {
  return Math.max(0, shot.cues.filter(cue => frame >= cue).length - 1)
}
