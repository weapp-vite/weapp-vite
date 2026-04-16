import { afterEach, describe, expect, it, vi } from 'vitest'

const GLOBAL_KEYS = ['wx', 'my', 'tt', 'swan', 'jd', 'xhs', 'getCurrentPages'] as const

function clearMiniProgramGlobals() {
  for (const key of GLOBAL_KEYS) {
    delete (globalThis as Record<string, unknown>)[key]
  }
}

async function loadPlatformModule() {
  vi.resetModules()
  return await import('./platform')
}

describe('runtime platform', () => {
  afterEach(() => {
    clearMiniProgramGlobals()
  })

  it('prefers wx global object in default weapp runtime', async () => {
    ;(globalThis as any).wx = { name: 'wx-runtime' }
    ;(globalThis as any).my = { name: 'my-runtime' }
    ;(globalThis as any).tt = { name: 'tt-runtime' }

    const { getMiniProgramGlobalObject } = await loadPlatformModule()
    expect(getMiniProgramGlobalObject()).toBe((globalThis as any).wx)
  })

  it('falls back to my when wx is missing', async () => {
    ;(globalThis as any).my = { name: 'my-runtime' }

    const { getMiniProgramGlobalObject } = await loadPlatformModule()
    expect(getMiniProgramGlobalObject()).toBe((globalThis as any).my)
  })

  it('falls back to tt when wx/my are missing', async () => {
    ;(globalThis as any).tt = { name: 'tt-runtime' }

    const { getMiniProgramGlobalObject } = await loadPlatformModule()
    expect(getMiniProgramGlobalObject()).toBe((globalThis as any).tt)
  })

  it('continues scanning shared runtime globals after wx/my/tt', async () => {
    ;(globalThis as any).swan = { name: 'swan-runtime' }

    const { getMiniProgramGlobalObject, resolveCurrentMiniProgramPlatform, supportsCurrentMiniProgramRuntimeCapability } = await loadPlatformModule()
    expect(getMiniProgramGlobalObject()).toBe((globalThis as any).swan)
    expect(resolveCurrentMiniProgramPlatform()).toBe('swan')
    expect(supportsCurrentMiniProgramRuntimeCapability('pageShareMenu')).toBe(true)
  })

  it('resolves current page stack through runtime capability gate', async () => {
    ;(globalThis as any).wx = { name: 'wx-runtime' }
    ;(globalThis as any).getCurrentPages = () => [{ route: 'pages/demo/index' }]

    const { getCurrentMiniProgramPages } = await loadPlatformModule()
    expect(getCurrentMiniProgramPages()).toEqual([{ route: 'pages/demo/index' }])
  })

  it('returns empty page stack when host getCurrentPages throws', async () => {
    ;(globalThis as any).wx = { name: 'wx-runtime' }
    ;(globalThis as any).getCurrentPages = () => {
      throw new Error('host pages unavailable')
    }

    const { getCurrentMiniProgramPages } = await loadPlatformModule()
    expect(getCurrentMiniProgramPages()).toEqual([])
  })

  it('returns undefined when no supported runtime global exists', async () => {
    const { getMiniProgramGlobalObject } = await loadPlatformModule()
    expect(getMiniProgramGlobalObject()).toBeUndefined()
  })

  it('returns host global object for scoped slot fallback', async () => {
    const { getMiniProgramGlobalObject, getScopedSlotHostGlobalObject } = await loadPlatformModule()

    expect(getMiniProgramGlobalObject()).toBeUndefined()
    expect(getScopedSlotHostGlobalObject()).toBe(globalThis)
  })
})
