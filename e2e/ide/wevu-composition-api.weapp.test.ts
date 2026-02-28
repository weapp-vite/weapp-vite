import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { APP_ROOT, runBuild } from '../wevu-runtime.utils'

const EXPECTED_APIS = [
  'ref',
  'shallowRef',
  'triggerRef',
  'customRef',
  'reactive',
  'shallowReactive',
  'readonly',
  'computed',
  'watch',
  'watchEffect',
  'toRef',
  'toRefs',
  'unref',
  'toValue',
  'effect',
  'stop',
  'batch',
  'startBatch',
  'endBatch',
  'effectScope',
  'getCurrentScope',
  'onScopeDispose',
  'traverse',
  'nextTick',
  'getCurrentInstance',
  'getCurrentSetupContext',
  'onLoad',
  'onShow',
  'onReady',
  'onHide',
  'onUnload',
  'onPullDownRefresh',
  'onReachBottom',
  'onPageScroll',
  'onRouteDone',
  'onTabItemTap',
  'onResize',
  'onMoved',
  'onShareAppMessage',
  'onShareTimeline',
  'onAddToFavorites',
  'onSaveExitState',
  'onUnhandledRejection',
  'onMounted',
  'onBeforeMount',
  'onBeforeUnmount',
  'onUnmounted',
  'onBeforeUpdate',
  'onUpdated',
  'onActivated',
  'onDeactivated',
  'onErrorCaptured',
  'provide',
  'inject',
  'provideGlobal',
  'injectGlobal',
  'useAttrs',
  'useSlots',
  'useNativeInstance',
  'useTemplateRef',
  'useBindModel',
  'useModel',
  'mergeModels',
  'normalizeClass',
  'normalizeStyle',
  'defineStore',
  'createStore',
  'storeToRefs',
] as const

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild('weapp')
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })
  }
  return sharedMiniProgram
}

async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await miniProgram.close()
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe.sequential('wevu composition api (weapp e2e)', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('covers all public composition APIs with executable assertions in TS and Vue SFC pages', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      for (const route of ['/pages/composition-api/index', '/pages/composition-api-vue/index']) {
        const page = await miniProgram.reLaunch(route)
        if (!page) {
          throw new Error(`Failed to launch ${route}`)
        }
        await page.waitFor(160)

        const result = await page.callMethod('runE2E')
        if (!result?.ok) {
          throw new Error(`Coverage failed for ${route}: ${JSON.stringify(result?.details ?? {}, null, 2)}`)
        }
        expect(result?.ok).toBe(true)

        const checks = result?.checks ?? {}
        const details = result?.details ?? {}
        const expectedApis = Array.isArray(details.expectedApis) ? details.expectedApis : []
        expect([...expectedApis].sort()).toEqual([...EXPECTED_APIS].sort())

        for (const api of EXPECTED_APIS) {
          expect(checks[api], `route ${route} api ${api} should be covered`).toBe(true)
        }

        expect(Array.isArray(details.failedApis)).toBe(true)
        expect(details.failedApis).toEqual([])
      }
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
