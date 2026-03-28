import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emitCompiledBundleEntries, emitVueBundleAssets, resolveVueBundleEmitState } from './index'

const emitCompiledVueEntryAssetsMock = vi.hoisted(() => vi.fn(async () => {}))
const emitFallbackPageAssetsMock = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('./emitCompiledEntry', () => ({
  emitCompiledVueEntryAssets: emitCompiledVueEntryAssetsMock,
}))

vi.mock('./emitFallbackPage', () => ({
  emitFallbackPageAssets: emitFallbackPageAssetsMock,
}))

describe('bundle index helpers', () => {
  beforeEach(() => {
    emitCompiledVueEntryAssetsMock.mockReset()
    emitCompiledVueEntryAssetsMock.mockResolvedValue(undefined)
    emitFallbackPageAssetsMock.mockReset()
    emitFallbackPageAssetsMock.mockResolvedValue(undefined)
  })

  it('resolves bundle emit state only when required services are available', () => {
    expect(resolveVueBundleEmitState({
      ctx: {},
      compilationCache: new Map(),
    } as any)).toBeUndefined()

    expect(resolveVueBundleEmitState({
      ctx: {
        configService: {},
        scanService: {},
      },
      compilationCache: new Map([
        ['/project/src/pages/index.vue', { result: {}, isPage: true }],
      ]),
    } as any)).toEqual({
      compilationEntries: [
        ['/project/src/pages/index.vue', { result: {}, isPage: true }],
      ],
    })
  })

  it('emits compiled bundle entries through shared compiled entry flow', async () => {
    const bundle = {}
    const state = {
      ctx: {},
    } as any
    const compilationEntries = [
      ['/project/src/pages/index.vue', { result: {}, isPage: true }],
      ['/project/src/components/card.vue', { result: {}, isPage: false }],
    ] as any

    await emitCompiledBundleEntries(bundle, state, compilationEntries)

    expect(emitCompiledVueEntryAssetsMock).toHaveBeenCalledTimes(2)
    expect(emitCompiledVueEntryAssetsMock).toHaveBeenNthCalledWith(
      1,
      bundle,
      state,
      '/project/src/pages/index.vue',
      { result: {}, isPage: true },
    )
    expect(emitCompiledVueEntryAssetsMock).toHaveBeenNthCalledWith(
      2,
      bundle,
      state,
      '/project/src/components/card.vue',
      { result: {}, isPage: false },
    )
  })

  it('dispatches bundle asset emission through compiled entries then fallback pages', async () => {
    const bundle = {}
    const state = {
      ctx: {
        configService: {},
        scanService: {},
      },
      compilationCache: new Map([
        ['/project/src/pages/index.vue', { result: {}, isPage: true }],
      ]),
    } as any

    await emitVueBundleAssets(bundle, state)

    expect(emitCompiledVueEntryAssetsMock).toHaveBeenCalledTimes(1)
    expect(emitFallbackPageAssetsMock).toHaveBeenCalledTimes(1)
    expect(emitFallbackPageAssetsMock).toHaveBeenCalledWith(bundle, state)
  })
})
