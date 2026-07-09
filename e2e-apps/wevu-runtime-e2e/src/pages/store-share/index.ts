import { defineComponent, nextTick } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'
import { useOptionsStore, useSetupStore } from '../../shared/store'

const STORE_SHARE_E2E_RESULT_STORAGE_KEY = '__weapp_vite_core_hmr_store_share_result__'

function writeStoreShareE2EResult(result: unknown) {
  if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') {
    return
  }
  wx.setStorageSync(STORE_SHARE_E2E_RESULT_STORAGE_KEY, result)
}

export default defineComponent({
  data: () => ({
    __e2e: {
      ok: false,
      checks: {},
    } as any,
    __e2eText: '',
  }),
  setup(_props, ctx) {
    const setupStore = useSetupStore()
    const optionsStore = useOptionsStore()

    const runE2E = async () => {
      const checks = {
        sharedName: setupStore.name.value === 'shared',
        sharedLabel: optionsStore.label === 'shared',
        sharedCount: setupStore.count.value >= 1 && optionsStore.count >= 1,
      }

      const result = buildResult('store-share', checks, {
        setupCount: setupStore.count.value,
        setupName: setupStore.name.value,
        optionsCount: optionsStore.count,
        optionsLabel: optionsStore.label,
      })

      ctx.instance?.setData({
        __e2e: result,
        __e2eText: stringifyResult(result),
      })
      writeStoreShareE2EResult(result)

      return result
    }

    void nextTick().then(runE2E)

    return {
      runE2E,
    }
  },
})
