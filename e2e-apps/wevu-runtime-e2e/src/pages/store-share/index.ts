import { defineComponent } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'
import { useOptionsStore, useSetupStore } from '../../shared/store'

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

      return result
    }

    return {
      runE2E,
    }
  },
})
