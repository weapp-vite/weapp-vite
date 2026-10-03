import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { filmSpecs } from '../src/timeline'

export type FilmLanguage = 'zh' | 'en'
export type FilmFormat = 'landscape' | 'portrait'
export type FilmId = 'PromoLandscape' | 'PromoPortrait' | 'PromoLandscapeEn' | 'PromoPortraitEn'

/** 兼容时间线扩展后的语言字段，同时保留旧版中文时间线。 */
export type Film = Omit<typeof filmSpecs[number], 'id' | 'name'> & {
  id: FilmId
  name: FilmFormat
  language?: FilmLanguage
}

export const projectDir = fileURLToPath(new URL('..', import.meta.url))
export const repoDir = path.resolve(projectDir, '../..')
export const cacheDir = path.join(repoDir, '.cache/promo-video')
export const publicDir = path.join(cacheDir, 'public')
export const outputDir = path.join(repoDir, 'artifacts/promo-video')
export const entryPoint = path.join(projectDir, 'src/index.tsx')

export const films = filmSpecs as readonly Film[]

export function filmLanguage(film: Pick<Film, 'id' | 'language'>): FilmLanguage {
  if (film.language === 'en' || film.language === 'zh') {
    return film.language
  }
  return film.id.endsWith('En') ? 'en' : 'zh'
}

export function filmKey(film: Pick<Film, 'name'> & Pick<Film, 'id' | 'language'>) {
  const language = filmLanguage(film)
  return language === 'en' ? `${film.name}-en` : film.name
}

export function videoPath(film: Film) {
  return path.join(outputDir, `weapp-vite-${filmKey(film)}.mp4`)
}
