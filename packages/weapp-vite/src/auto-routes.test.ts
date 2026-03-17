import type { AutoRoutes } from './types/routes'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe.skip('auto-routes module exports', () => {
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

    expect(getReference).toHaveBeenCalled()
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
