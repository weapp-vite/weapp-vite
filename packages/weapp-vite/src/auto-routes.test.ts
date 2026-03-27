import type { AutoRoutes } from './types/routes'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('auto-routes module exports', () => {
  const modulePath = './auto-routes'
  const routeRuntimeOverrideKey = Symbol.for('weapp-vite.route-runtime')

  afterEach(() => {
    delete (globalThis as Record<string | symbol, unknown>)[routeRuntimeOverrideKey]
    vi.unstubAllGlobals()
    vi.doUnmock('./context')
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('mirrors data from the active auto routes service reference', async () => {
    const reference: AutoRoutes = {
      pages: ['pages/index/index'],
      entries: ['pages/index/index'],
      subPackages: [
        {
          root: 'packageA',
          pages: ['pages/dog'],
        },
      ],
    }

    const getReference = vi.fn(() => reference)

    vi.doMock('./context', () => {
      return {
        getCompilerContext: () => ({
          autoRoutesService: {
            getReference,
          },
        }),
      }
    })

    const module = await import(modulePath)
    const autoRoutes = module.default

    expect(getReference).toHaveBeenCalled()
    expect(autoRoutes).toBe(module.routes)
    expect(autoRoutes.pages).toEqual(['pages/index/index'])
    expect(autoRoutes.entries).toEqual(['pages/index/index'])
    expect(autoRoutes.subPackages).toEqual([
      {
        root: 'packageA',
        pages: ['pages/dog'],
      },
    ])
    expect(module.routes.pages).toBe(reference.pages)
    expect(module.routes.entries).toBe(reference.entries)
    expect(module.routes.subPackages).toBe(reference.subPackages)

    // 确保具名导出暴露的是同一份“活引用”。
    expect(module.pages).toBe(reference.pages)
    expect(module.entries).toBe(reference.entries)
    expect(module.subPackages).toBe(reference.subPackages)
    expect(module.wxRouter).toBeTruthy()

    reference.pages.push('pages/about/index')
    expect(module.pages).toContain('pages/about/index')
    expect(module.routes.pages).toContain('pages/about/index')
    expect(autoRoutes.pages).toContain('pages/about/index')
  })

  it('supports default import semantics for normal ts usage', async () => {
    const reference: AutoRoutes = {
      pages: ['pages/home/index', 'pages/detail/index'],
      entries: ['pages/home/index', 'pages/detail/index', 'packageA/pages/foo'],
      subPackages: [
        {
          root: 'packageA',
          pages: ['pages/foo'],
        },
      ],
    }

    vi.doMock('./context', () => {
      return {
        getCompilerContext: () => ({
          autoRoutesService: {
            getReference: () => reference,
          },
        }),
      }
    })

    const { default: autoRoutes, entries, pages, routes, subPackages } = await import(modulePath)

    expect(autoRoutes).toBe(routes)
    expect(autoRoutes.pages).toBe(pages)
    expect(autoRoutes.entries).toBe(entries)
    expect(autoRoutes.subPackages).toBe(subPackages)
    expect(autoRoutes).toEqual({
      pages: ['pages/home/index', 'pages/detail/index'],
      entries: ['pages/home/index', 'pages/detail/index', 'packageA/pages/foo'],
      subPackages: [
        {
          root: 'packageA',
          pages: ['pages/foo'],
        },
      ],
    })
  })

  it('supports dynamic import semantics for normal ts usage', async () => {
    const reference: AutoRoutes = {
      pages: ['pages/home/index'],
      entries: ['pages/home/index', 'subpackages/lab/pages/demo/index'],
      subPackages: [
        {
          root: 'subpackages/lab',
          pages: ['pages/demo/index'],
        },
      ],
    }

    vi.doMock('./context', () => {
      return {
        getCompilerContext: () => ({
          autoRoutesService: {
            getReference: () => reference,
          },
        }),
      }
    })

    const loaded = await import(modulePath)
    const dynamicLoaded = await import(modulePath)

    expect(dynamicLoaded.default).toBe(loaded.default)
    expect(dynamicLoaded.default.pages).toEqual(['pages/home/index'])
    expect(dynamicLoaded.default.entries).toEqual(['pages/home/index', 'subpackages/lab/pages/demo/index'])
    expect(dynamicLoaded.default.subPackages).toEqual([
      {
        root: 'subpackages/lab',
        pages: ['pages/demo/index'],
      },
    ])
  })

  it('wxRouter proxies route methods to global mini-program object', async () => {
    const callLog = {
      navigateTo: [] as Array<Record<string, any>>,
      redirectTo: [] as Array<Record<string, any>>,
      navigateBack: [] as Array<Record<string, any>>,
    }
    const wx = {
      switchTab() {},
      reLaunch() {},
      redirectTo(option: Record<string, any>) {
        callLog.redirectTo.push(option)
      },
      navigateTo(option: Record<string, any>) {
        callLog.navigateTo.push(option)
      },
      navigateBack(option: Record<string, any>) {
        callLog.navigateBack.push(option)
      },
    }
    ;(globalThis as Record<string | symbol, unknown>)[routeRuntimeOverrideKey] = wx

    vi.doMock('./context', () => {
      return {
        getCompilerContext: () => ({}),
      }
    })

    const module = await import(modulePath)

    module.wxRouter.navigateTo({ url: '/pages/index/index' })
    module.wxRouter.redirectTo({ url: '/pages/about/index' })
    module.wxRouter.navigateBack({ delta: 1 })

    expect(callLog.navigateTo).toEqual([{ url: '/pages/index/index' }])
    expect(callLog.redirectTo).toEqual([{ url: '/pages/about/index' }])
    expect(callLog.navigateBack).toEqual([{ delta: 1 }])
  })

  it.each(['swan', 'jd', 'xhs'])('wxRouter falls back to %s runtime globals', async (runtimeKey) => {
    const navigateTo = vi.fn()
    ;(globalThis as Record<string, any>)[runtimeKey] = {
      navigateTo,
    }

    vi.doMock('./context', () => {
      return {
        getCompilerContext: () => ({}),
      }
    })

    const module = await import(modulePath)
    module.wxRouter.navigateTo({ url: '/pages/index/index' })

    expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/index/index' })
    delete (globalThis as Record<string, any>)[runtimeKey]
  })

  it.skip('wxRouter throws when route capability is unavailable', async () => {
    delete (globalThis as Record<string | symbol, unknown>)[routeRuntimeOverrideKey]
    vi.stubGlobal('wx', undefined)
    vi.stubGlobal('tt', undefined)
    vi.stubGlobal('my', undefined)

    vi.doMock('./context', () => {
      return {
        getCompilerContext: () => ({}),
      }
    })

    const module = await import(modulePath)
    expect(() => module.wxRouter.navigateTo({ url: '/pages/index/index' })).toThrow('当前运行环境不支持路由方法')
  })

  it('falls back to empty collections when no service is available', async () => {
    vi.doMock('./context', () => {
      return {
        getCompilerContext: () => ({}),
      }
    })

    const module = await import(modulePath)

    expect(module.routes.pages).toEqual([])
    expect(module.routes.entries).toEqual([])
    expect(module.routes.subPackages).toEqual([])
    expect(module.pages).toEqual([])
    expect(module.entries).toEqual([])
    expect(module.subPackages).toEqual([])
  })
})
