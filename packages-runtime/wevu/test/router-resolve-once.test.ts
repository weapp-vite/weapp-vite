import { WEVU_HOOKS_KEY } from '@weapp-core/constants'
import { afterEach, expect, it, vi } from 'vitest'
import { createRouter } from '@/router'
import { clearActiveRouter } from '@/router/instance'
import { setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'

const { resolveCalls } = vi.hoisted(() => ({
  resolveCalls: [] as unknown[][],
}))

// 只统计「原始位置 → 标准化位置」的解析次数：重复解析目标会让每次导航多走一轮归一化。
vi.mock('@/router/resolve', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/router/resolve')>()
  return {
    ...actual,
    resolveRouteLocation: (...args: Parameters<typeof actual.resolveRouteLocation>) => {
      resolveCalls.push(args)
      return actual.resolveRouteLocation(...args)
    },
  }
})

afterEach(() => {
  setCurrentInstance(undefined)
  setCurrentSetupContext(undefined)
  clearActiveRouter()
  delete (globalThis as any).getCurrentPages
  resolveCalls.length = 0
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
  ;(globalThis as any).getCurrentPages = vi.fn(() => [{ route: 'pages/home/index', options: {} }])
}

it('resolves the navigation target only once per push', async () => {
  setupRouterEnv()
  // 自定义驱动不触碰原生导航：解析次数只反映导航内核自身的行为。
  const router = createRouter({ history: { create: () => ({ push: () => {} }) } })

  await router.push('/pages/other/index')

  expect(resolveCalls).toHaveLength(1)
})

it('resolves the navigation target only once per replace', async () => {
  setupRouterEnv()
  const router = createRouter({ history: { create: () => ({ replace: () => {} }) } })

  await router.replace('/pages/other/index')

  expect(resolveCalls).toHaveLength(1)
})
