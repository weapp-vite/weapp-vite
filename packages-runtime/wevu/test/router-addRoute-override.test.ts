import { WEVU_HOOKS_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRouter } from '@/router'
import { setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'

describe('addRoute name override with alias and redirect (issue #320)', () => {
  afterEach(() => {
    setCurrentInstance(undefined)
    setCurrentSetupContext(undefined)
    delete (globalThis as any).getCurrentPages
  })

  function setupRouterEnv() {
    const instance = {
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo: vi.fn(),
        navigateBack: vi.fn(),
      },
    } as any

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })

    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        route: 'pages/home/index',
        options: {},
      },
    ])

    return instance
  }

  it('replaces route path, alias, and redirect when addRoute overrides by name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setupRouterEnv()

    const router = createRouter({
      routes: [
        {
          name: 'issue320-home',
          path: '/pages/issue-320/index',
        },
        {
          name: 'issue320-legacy',
          path: '/pages/issue-320/legacy',
          alias: '/pages/issue-320/legacy-alias',
          redirect: '/pages/issue-320/index?from=legacy',
        },
      ],
    })

    // resetLegacyRoute — 重新添加原始路由
    router.addRoute({
      name: 'issue320-legacy',
      path: '/pages/issue-320/legacy',
      alias: '/pages/issue-320/legacy-alias',
      redirect: '/pages/issue-320/index?from=legacy',
    })

    // 验证初始状态
    const beforeRoute = router.resolve({ name: 'issue320-legacy' })
    expect(beforeRoute.path).toBe('pages/issue-320/legacy')
    expect(beforeRoute.fullPath).toBe('/pages/issue-320/legacy')

    // applyOverrideRoute — 同名替换
    router.addRoute({
      name: 'issue320-legacy',
      path: '/pages/issue-320/new',
      alias: '/pages/issue-320/new-alias',
      redirect: '/pages/issue-309/index?from=issue320-override',
    })

    // 验证替换后按名称解析
    const overriddenRoute = router.resolve({ name: 'issue320-legacy' })
    expect(overriddenRoute.path).toBe('pages/issue-320/new')
    expect(overriddenRoute.fullPath).toBe('/pages/issue-320/new')

    // 验证新 alias 可解析
    const resolvedByNewAlias = router.resolve('/pages/issue-320/new-alias')
    expect(resolvedByNewAlias.name).toBe('issue320-legacy')
    expect(resolvedByNewAlias.matched?.[0]?.aliasPath).toBe('/pages/issue-320/new-alias')

    // 验证旧 alias 不再解析到该路由
    const resolvedByOldAlias = router.resolve('/pages/issue-320/legacy-alias')
    expect(resolvedByOldAlias.name).toBeUndefined()

    // 验证 getRoutes 返回新配置
    const currentRecord = router.getRoutes().find(r => r.name === 'issue320-legacy')
    expect(currentRecord?.alias).toBe('/pages/issue-320/new-alias')
    expect(currentRecord?.redirect).toBe('/pages/issue-309/index?from=issue320-override')

    expect(router.hasRoute('issue320-legacy')).toBe(true)
    warn.mockRestore()
  })

  it('old static path no longer resolves after addRoute override', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setupRouterEnv()

    const router = createRouter({
      routes: [
        {
          name: 'page-a',
          path: '/pages/a/index',
        },
      ],
    })

    expect(router.resolve('/pages/a/index').name).toBe('page-a')

    router.addRoute({
      name: 'page-a',
      path: '/pages/b/index',
    })

    expect(router.resolve({ name: 'page-a' }).path).toBe('pages/b/index')
    expect(router.resolve('/pages/b/index').name).toBe('page-a')
    // 旧路径不再解析到该路由
    expect(router.resolve('/pages/a/index').name).toBeUndefined()

    warn.mockRestore()
  })
})
