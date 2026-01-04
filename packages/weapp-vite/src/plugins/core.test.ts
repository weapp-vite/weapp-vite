import { describe, expect, it, vi } from 'vitest'
import { weappVite } from './core'

const mocked = vi.hoisted(() => {
  const loadEntry = vi.fn(async () => ({ code: 'ok' }))
  const loadedEntrySet = new Set<string>()
  return { loadEntry, loadedEntrySet }
})

vi.mock('./hooks/useLoadEntry', () => {
  return {
    __esModule: true,
    useLoadEntry: () => {
      return {
        loadEntry: mocked.loadEntry,
        loadedEntrySet: mocked.loadedEntrySet,
        entriesMap: new Map(),
        jsonEmitFilesMap: new Map(),
      }
    },
  }
})

describe('weapp-vite:pre load', () => {
  it('unwraps \\0vue: ids for app entry detection', async () => {
    mocked.loadEntry.mockClear()
    mocked.loadedEntrySet.clear()

    const plugins = weappVite({
      currentBuildTarget: 'app',
      configService: {
        absoluteSrcRoot: '/project/src',
        isDev: false,
        weappViteConfig: {},
        relativeAbsoluteSrcRoot(id: string) {
          return id.replace('/project/src/', '')
        },
      },
      scanService: {} as any,
      buildService: {} as any,
    } as any)

    const core = plugins.find(p => p.name === 'weapp-vite:pre')!
    await core.load!.call({} as any, '\0vue:/project/src/app.vue')

    expect(mocked.loadEntry).toHaveBeenCalledWith('/project/src/app.vue', 'app')
  })

  it('matches loadedEntrySet against unwrapped vue ids', async () => {
    mocked.loadEntry.mockClear()
    mocked.loadedEntrySet.clear()
    mocked.loadedEntrySet.add('/project/src/pages/a.vue')

    const plugins = weappVite({
      currentBuildTarget: 'app',
      configService: {
        absoluteSrcRoot: '/project/src',
        isDev: false,
        weappViteConfig: {},
        relativeAbsoluteSrcRoot(id: string) {
          return id.replace('/project/src/', '')
        },
      },
      scanService: {} as any,
      buildService: {} as any,
    } as any)

    const core = plugins.find(p => p.name === 'weapp-vite:pre')!
    await core.load!.call({} as any, '\0vue:/project/src/pages/a.vue')

    expect(mocked.loadEntry).toHaveBeenCalledWith('/project/src/pages/a.vue', 'component')
  })
})
