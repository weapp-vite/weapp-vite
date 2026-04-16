import { afterEach, describe, expect, it, vi } from 'vitest'

const GLOBAL_KEYS = ['wx', 'my', 'tt', 'swan', 'jd', 'xhs', 'getCurrentPages', '__wxConfig'] as const

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

  it('reads current host config through shared runtime descriptor', async () => {
    ;(globalThis as any).wx = { name: 'wx-runtime' }
    ;(globalThis as any).__wxConfig = {
      debug: true,
      networkTimeout: {
        request: 12_000,
      },
    }

    const { getCurrentMiniProgramHostConfig } = await loadPlatformModule()
    expect(getCurrentMiniProgramHostConfig()).toEqual({
      debug: true,
      networkTimeout: {
        request: 12_000,
      },
    })
  })

  it('creates current global router wrapper from runtime global object', async () => {
    const calls: Array<{ method: string, context: any, args: any[] }> = []
    ;(globalThis as any).wx = {
      switchTab(...args: any[]) {
        calls.push({ method: 'switchTab', context: this, args })
      },
      reLaunch(...args: any[]) {
        calls.push({ method: 'reLaunch', context: this, args })
      },
      redirectTo(...args: any[]) {
        calls.push({ method: 'redirectTo', context: this, args })
      },
      navigateTo(...args: any[]) {
        calls.push({ method: 'navigateTo', context: this, args })
      },
      navigateBack(...args: any[]) {
        calls.push({ method: 'navigateBack', context: this, args })
      },
    }

    const { getCurrentMiniProgramGlobalRouter } = await loadPlatformModule()
    const router = getCurrentMiniProgramGlobalRouter()
    expect(router).toBeTruthy()

    router?.navigateTo({ url: '/pages/demo/index' })
    expect(calls).toEqual([
      {
        method: 'navigateTo',
        context: (globalThis as any).wx,
        args: [{ url: '/pages/demo/index' }],
      },
    ])
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
