import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { filmSpecs } from '../src/timeline'

export const projectDir = fileURLToPath(new URL('..', import.meta.url))
export const repoDir = path.resolve(projectDir, '../..')
export const cacheDir = path.join(repoDir, '.cache/promo-video')
export const publicDir = path.join(cacheDir, 'public')
export const outputDir = path.join(repoDir, 'artifacts/promo-video')
export const entryPoint = path.join(projectDir, 'src/index.tsx')

export const films = filmSpecs

export type Film = typeof films[number]
export const sceneLabels = ['Opening', 'Native upgrade', 'Vue SFC', 'Toolchain', 'AI workflow', 'Start creating']

export function videoPath(film: Film) {
  return path.join(outputDir, `weapp-vite-${film.name}.mp4`)
}
