import { WEVU_HOOKS_KEY } from '@weapp-core/constants'
import { expect, it, vi } from 'vitest'

async function loadRouterRuntime(route: string) {
  const api = await import('../src/router')
  const hooks = await import('../src/runtime/hooks')
  const { clearActiveRouter } = await import('../src/router/instance')
  const instance = {
    route,
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
  hooks.setCurrentInstance(instance)
  hooks.setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })
  return {
    api,
    cleanup() {
      clearActiveRouter()
      hooks.setCurrentInstance(undefined)
      hooks.setCurrentSetupContext(undefined)
    },
  }
}

it('requires an independent runtime to bootstrap its own router without replacing the main router', async () => {
  vi.resetModules()
  const main = await loadRouterRuntime('pages/home/index')
  let independent: Awaited<ReturnType<typeof loadRouterRuntime>> | undefined
  try {
    const mainRouter = main.api.createRouter()
    expect(main.api.useRouter()).toBe(mainRouter)

    // 独立分包不能引用主包模块，加载自己的 runtime 副本。
    vi.resetModules()
    independent = await loadRouterRuntime('packageB/pages/settings/index')
    expect(independent.api.useRouter).toThrow('useRouter() 未找到已创建的 router 实例')

    const independentRouter = independent.api.createRouter()
    expect(independent.api.useRouter()).toBe(independentRouter)
    expect(independentRouter).not.toBe(mainRouter)
    expect(main.api.useRouter()).toBe(mainRouter)
  }
  finally {
    independent?.cleanup()
    main.cleanup()
    vi.resetModules()
  }
})
