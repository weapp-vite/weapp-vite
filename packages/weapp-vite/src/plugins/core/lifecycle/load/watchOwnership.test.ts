import { describe, expect, it, vi } from 'vitest'
import { createLoadHook } from './index'

describe('JSX physical source watch ownership', () => {
  it.each(['jsx', 'tsx'])('watches the actual %s source when custom load supplies its contents', async (extension) => {
    const sourceId = `/project/src/pages/index.${extension}`
    const loadEntry = vi.fn(async () => ({ code: 'Component({})' }))
    const addWatchFile = vi.fn()
    const load = createLoadHook({
      ctx: {
        configService: {
          platform: 'weapp',
          packageJson: {},
          weappViteConfig: {},
          relativeAbsoluteSrcRoot: (id: string) => id.replace('/project/src/', ''),
        },
      },
      loadEntry,
      loadedEntrySet: new Set([sourceId]),
      entriesMap: new Map([['pages/index', { type: 'page' }]]),
      resolvedEntryMap: new Map(),
    } as any)

    const result = await load.call({ addWatchFile }, sourceId)

    expect(result).toEqual({ code: 'Component({})' })
    expect(loadEntry).toHaveBeenCalledWith(sourceId, 'page')
    expect(addWatchFile).toHaveBeenCalledExactlyOnceWith(sourceId)
  })
})
