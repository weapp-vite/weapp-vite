import type { WevuRuntimeBindingManifestV1 } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function createManifest(rootPortal: boolean): WevuRuntimeBindingManifestV1 {
  return {
    version: 1,
    sourceFile: 'pages/index/index.vue',
    bindings: [],
    ...(rootPortal ? { features: { rootPortal: true as const } } : {}),
  }
}

async function loadWarning() {
  vi.resetModules()
  const { warnRootPortalBaseLibraryRequirement } = await import('@/runtime/features/rootPortal')
  return warnRootPortalBaseLibraryRequirement
}

describe('warnRootPortalBaseLibraryRequirement', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('基础库低于 root-portal 最低版本时提示能力不可用', async () => {
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '2.25.1' }) })
    const warn = await loadWarning()

    warn(createManifest(true))

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0]![0])).toContain('root-portal 不可用')
  })

  it('基础库满足标签但不满足 enable 时提示 enable 会被忽略', async () => {
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '2.25.2' }) })
    const warn = await loadWarning()

    warn(createManifest(true))

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0]![0])).toContain('enable 属性将被忽略')
  })

  it('基础库满足 enable 门槛时不提示', async () => {
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '2.26.1' }) })
    const warn = await loadWarning()

    warn(createManifest(true))

    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('回退到 getSystemInfoSync 读取版本', async () => {
    vi.stubGlobal('wx', { getSystemInfoSync: () => ({ SDKVersion: '2.25.2' }) })
    const warn = await loadWarning()

    warn(createManifest(true))

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0]![0])).toContain('enable 属性将被忽略')
  })

  it('同一进程只提示一次', async () => {
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '2.25.2' }) })
    const warn = await loadWarning()

    warn(createManifest(true))
    warn(createManifest(true))

    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('未标记 rootPortal 特征时不提示', async () => {
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '2.25.1' }) })
    const warn = await loadWarning()

    warn(createManifest(false))
    warn(undefined)

    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('宿主缺少版本 API 时静默返回', async () => {
    vi.stubGlobal('wx', {})
    const warn = await loadWarning()

    warn(createManifest(true))

    expect(warnSpy).not.toHaveBeenCalled()
  })
})
