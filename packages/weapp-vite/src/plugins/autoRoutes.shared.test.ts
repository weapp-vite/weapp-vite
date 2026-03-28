import { describe, expect, it } from 'vitest'
import {
  collectAutoRoutesWatchDirs,
  isAutoRoutesWatchFile,
  isAutoRoutesWatchMode,
} from './autoRoutes.shared'

describe('auto routes plugin shared helpers', () => {
  it('detects dev and build watch modes', () => {
    expect(isAutoRoutesWatchMode()).toBe(false)
    expect(isAutoRoutesWatchMode({
      isDev: true,
      inlineConfig: {},
    } as any)).toBe(true)
    expect(isAutoRoutesWatchMode({
      isDev: false,
      inlineConfig: {
        build: {
          watch: {},
        },
      },
    } as any)).toBe(true)
  })

  it('collects and de-duplicates auto routes watch directories', () => {
    expect(collectAutoRoutesWatchDirs(
      ['/project/src/pages', '/project/src/views'],
      ['/project/src/views', '/project/src/pkgA/screens'],
    )).toEqual([
      '/project/src/pages',
      '/project/src/views',
      '/project/src/pkgA/screens',
    ])
  })

  it('filters route vue files by extension and pages matcher', () => {
    const isPagesRelatedPath = (id: string) => id.includes('/pages/') || id.includes('\\pages\\')
    const allowedExtensions = new Set(['.vue', '.ts'])

    expect(isAutoRoutesWatchFile('/project/src/pages/home/index.vue', allowedExtensions, isPagesRelatedPath)).toBe(true)
    expect(isAutoRoutesWatchFile('C:\\project\\src\\pages\\home\\index.ts', allowedExtensions, isPagesRelatedPath)).toBe(true)
    expect(isAutoRoutesWatchFile('/project/src/pages/home/index.scss', allowedExtensions, isPagesRelatedPath)).toBe(false)
    expect(isAutoRoutesWatchFile('/project/src/components/card/index.vue', allowedExtensions, isPagesRelatedPath)).toBe(false)
  })
})
