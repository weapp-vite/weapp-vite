import { describe, expect, it, vi } from 'vitest'
import { markComponentEntries, registerResolvedPageLayoutEntries } from './layoutEntries'

const collectNativeLayoutAssetsMock = vi.hoisted(() => vi.fn(async () => ({
  script: '/project/src/layouts/native/index.ts',
})))

vi.mock('../vue/transform/pageLayout', () => ({
  collectNativeLayoutAssets: collectNativeLayoutAssetsMock,
}))

describe('layout entry helpers', () => {
  it('registers vue layouts and native layouts with scripts as component entries', async () => {
    const entries: string[] = []
    const explicitEntryTypes = new Map<string, any>()
    const nativeScriptEntries = new Set<string>()

    await registerResolvedPageLayoutEntries({
      layouts: [
        {
          kind: 'vue',
          file: '/project/src/layouts/default.vue',
          importPath: '/layouts/default',
        },
        {
          kind: 'native',
          file: '/project/src/layouts/native/index',
          importPath: '/layouts/native/index',
        },
      ] as any,
      entries,
      explicitEntryTypes,
      nativeScriptEntries,
      normalizeEntry: (entry, jsonPath) => `${entry}:${jsonPath}`,
      jsonPath: '/project/src/pages/home/index.json',
    })

    expect(entries).toEqual([
      '/layouts/default',
      '/layouts/native/index',
    ])
    expect(explicitEntryTypes).toEqual(new Map([
      ['/layouts/default:/project/src/pages/home/index.json', 'component'],
      ['/layouts/native/index:/project/src/pages/home/index.json', 'component'],
    ]))
    expect(nativeScriptEntries).toEqual(new Set([
      '/layouts/native/index:/project/src/pages/home/index.json',
    ]))
  })

  it('skips native layouts without script sidecars', async () => {
    collectNativeLayoutAssetsMock.mockResolvedValueOnce({
      script: undefined,
    })

    const entries: string[] = []
    const explicitEntryTypes = new Map<string, any>()

    await registerResolvedPageLayoutEntries({
      layouts: [
        {
          kind: 'native',
          file: '/project/src/layouts/native/index',
          importPath: '/layouts/native/index',
        },
      ] as any,
      entries,
      explicitEntryTypes,
      normalizeEntry: (entry, jsonPath) => `${entry}:${jsonPath}`,
      jsonPath: '/project/src/pages/home/index.json',
    })

    expect(entries).toEqual([])
    expect(explicitEntryTypes.size).toBe(0)
  })

  it('marks existing entries as component entries', () => {
    const entriesMap = new Map<string, any>([
      ['/layouts/native/index:/project/src/pages/home/index.json', { type: 'page' }],
      ['/layouts/default:/project/src/pages/home/index.json', { type: 'component' }],
    ])

    markComponentEntries(entriesMap, [
      '/layouts/native/index:/project/src/pages/home/index.json',
      '/missing',
    ])

    expect(entriesMap.get('/layouts/native/index:/project/src/pages/home/index.json')?.type).toBe('component')
    expect(entriesMap.get('/layouts/default:/project/src/pages/home/index.json')?.type).toBe('component')
  })
})
