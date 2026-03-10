import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWeapi, wpi } from '@/api'
import { fetch as wevuFetch } from '@/fetch'
import { ref } from '@/reactivity'
import { useRouter } from '@/router'
import { setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'
import { createStore, defineStore, storeToRefs } from '@/store'

interface MockRequestOptions {
  url?: string
  method?: string
  header?: Record<string, string>
  data?: unknown
  responseType?: 'text' | 'arraybuffer'
  success?: (res: WechatMiniprogram.RequestSuccessCallbackResult) => void
}

function createRouterContext() {
  const navigateTo = vi.fn((options: any) => {
    options?.success?.({})
  })

  const instance = {
    __wevu: {},
    __wevuHooks: {},
    router: {
      switchTab: vi.fn(),
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
      navigateTo,
      navigateBack: vi.fn(),
    },
  } as any

  setCurrentInstance(instance)
  setCurrentSetupContext({
    instance,
    emit: vi.fn(),
    attrs: {},
    slots: {},
  })

  ;(globalThis as any).getCurrentPages = vi.fn(() => [
    {
      route: 'pages/subpath-entries/index',
      options: {},
    },
  ])

  return {
    navigateTo,
  }
}

describe('subpath usage integration', () => {
  afterEach(() => {
    setCurrentInstance(undefined)
    setCurrentSetupContext(undefined)
    delete (globalThis as any).getCurrentPages
    ;(wpi as any).setAdapter(undefined, undefined)
  })

  it('integrates router/store/api/fetch workflows in one scenario', async () => {
    const { navigateTo } = createRouterContext()

    createStore().use(({ store }) => {
      ;(store as any).__unitPluginTouched = true
    })

    const useScenarioStore = defineStore('subpath-unit-scenario', () => {
      const count = ref(0)
      const label = ref('init')

      function bump() {
        count.value += 1
      }

      return {
        count,
        label,
        bump,
      }
    })

    const scenarioStore = useScenarioStore()
    const scenarioRefs = storeToRefs(scenarioStore)

    scenarioStore.bump()
    scenarioRefs.label.value = 'unit'

    expect(scenarioRefs.count.value).toBe(1)
    expect(scenarioRefs.label.value).toBe('unit')
    expect((scenarioStore as any).__unitPluginTouched).toBe(true)

    const router = useRouter({
      routes: [
        {
          name: 'subpath-entries',
          path: '/pages/subpath-entries/index',
        },
        {
          name: 'router-target',
          path: '/pages/router-stability/target/index',
        },
      ],
    })

    const resolved = router.resolve({
      name: 'router-target',
      query: {
        from: 'unit-test',
        step: scenarioRefs.count.value,
      },
    })
    expect(resolved.fullPath).toBe('/pages/router-stability/target/index?from=unit-test&step=1')

    await expect(router.push({
      name: 'router-target',
      query: {
        from: 'unit-test',
      },
    })).resolves.toBeUndefined()

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/router-stability/target/index?from=unit-test',
    }))

    const requestMock = vi.fn((options: MockRequestOptions) => {
      options.success?.({
        data: '{"ok":true,"source":"unit-adapter"}',
        statusCode: 200,
        header: {
          'content-type': 'application/json',
          'x-source': 'unit-adapter',
        },
      } as unknown as WechatMiniprogram.RequestSuccessCallbackResult)
      return {
        abort: vi.fn(),
      } as unknown as WechatMiniprogram.RequestTask
    })

    const adapter = {
      request: requestMock,
    }

    const localApi = createWeapi({
      adapter: adapter as any,
      platform: 'wx',
    })

    expect(localApi.supports('request')).toBe(true)
    expect(localApi.resolveTarget('request').target).toBe('request')

    const previousAdapter = (wpi as any).getAdapter?.()
    const previousPlatform = (wpi as any).platform as string | undefined

    ;(wpi as any).setAdapter(adapter as any, 'wx')
    try {
      const response = await wevuFetch('https://example.com/subpath-unit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          source: 'unit',
        }),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('x-source')).toBe('unit-adapter')
      await expect(response.json()).resolves.toEqual({
        ok: true,
        source: 'unit-adapter',
      })
    }
    finally {
      ;(wpi as any).setAdapter(previousAdapter, previousPlatform)
    }

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/subpath-unit',
      method: 'POST',
      responseType: 'arraybuffer',
      header: expect.objectContaining({
        'content-type': 'application/json',
      }),
      data: '{"source":"unit"}',
    }))
  })
})
