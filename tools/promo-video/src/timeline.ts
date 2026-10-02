export const fps = 60
export const bpm = 144
export const framesPerBeat = fps * 60 / bpm
export const shotFrames = framesPerBeat * 12
export const actionFrames = [0, framesPerBeat * 4, framesPerBeat * 8] as const

export type Format = 'landscape' | 'portrait'
export type ShotKind = 'intro' | 'native' | 'toolchain' | 'sfc' | 'reactivity' | 'style' | 'routes' | 'components' | 'packages' | 'runtime' | 'evidence' | 'outro' | 'native-toolchain' | 'vue' | 'automation' | 'ai'
export type Energy = 'hook' | 'build' | 'drive' | 'outro'

interface ShotDefinition {
  kind: ShotKind
  label: string
  title: readonly [string, string]
  energy: Energy
}

export interface Shot extends ShotDefinition {
  id: string
  frames: number
  startFrame: number
  endFrame: number
  cues: readonly number[]
}

export interface ShotProps {
  portrait: boolean
  shot: Shot
}

export interface FilmSpec {
  id: 'PromoLandscape' | 'PromoPortrait'
  name: Format
  width: number
  height: number
  frames: number
  seconds: number
  cuts: number[]
  shots: Shot[]
}

function defineShot(kind: ShotKind, label: string, first: string, accent: string, energy: Energy = 'drive'): ShotDefinition {
  return { kind, label, title: [first, accent], energy }
}

const landscape = [
  defineShot('intro', 'Modern experience', '小程序开发，', '进入现代节奏。', 'hook'),
  defineShot('native', 'Native first', '原生能力，', '继续用。', 'build'),
  defineShot('toolchain', 'Modern toolchain', '工具链，', '向前一步。', 'build'),
  defineShot('sfc', 'Vue SFC', '熟悉的 Vue，', '写进小程序。'),
  defineShot('reactivity', 'Reactive flow', '一次点击，', '视图响应。'),
  defineShot('style', 'Style update', '改完，', '就能看见。'),
  defineShot('routes', 'Automatic routes', '新页面，', '自动发现。'),
  defineShot('components', 'Auto import', '写下组件，', '自动导入。'),
  defineShot('packages', 'Dependencies', 'npm 与分包，', '统一处理。'),
  defineShot('runtime', 'AI runtime', '让 AI 看见，', '运行现场。'),
  defineShot('evidence', 'Runtime evidence', '截图。日志。', '继续迭代。'),
  defineShot('outro', 'Start creating', '给小程序', '现代化的开发体验', 'outro'),
]

const portrait = [
  landscape[0],
  defineShot('native-toolchain', 'Native to modern', '保留原生，', '升级工具链。', 'build'),
  defineShot('vue', 'Vue reactive flow', '熟悉的 Vue，', '流动的界面。'),
  defineShot('automation', 'Automatic engineering', '把重复工作，', '交给工具链。'),
  defineShot('ai', 'AI and evidence', '让 AI 看见，', '运行中的小程序。'),
  landscape[11],
]

function makeFilm(name: Format, definitions: ShotDefinition[]): FilmSpec {
  const shots = definitions.map((definition, index): Shot => ({
    ...definition,
    id: `${name}-${definition.kind}`,
    frames: shotFrames,
    startFrame: index * shotFrames,
    endFrame: (index + 1) * shotFrames,
    cues: actionFrames,
  }))
  const frames = shots.at(-1)!.endFrame
  return {
    id: name === 'portrait' ? 'PromoPortrait' : 'PromoLandscape',
    name,
    width: name === 'portrait' ? 1080 : 1920,
    height: name === 'portrait' ? 1920 : 1080,
    frames,
    seconds: frames / fps,
    cuts: [...shots.map(shot => shot.startFrame / fps), frames / fps],
    shots,
  }
}

export const filmSpecs = [makeFilm('landscape', landscape), makeFilm('portrait', portrait)] as const

export function shotPhase(frame: number, shot: Shot) {
  return Math.max(0, shot.cues.filter(cue => frame >= cue).length - 1)
}
