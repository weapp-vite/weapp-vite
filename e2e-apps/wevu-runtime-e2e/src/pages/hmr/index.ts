import { defineComponent, nextTick } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'
import { getHotVersion, hotUpdateSetupStore, useSetupStore } from '../../shared/store'

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

    const runE2E = async () => {
      const versionBefore = getHotVersion()
      const before = setupStore.count.value
      setupStore.inc(1)
      const afterInc = setupStore.count.value

      const nextVersion = hotUpdateSetupStore(setupStore)
      setupStore.inc(1)
      const afterHot = setupStore.count.value

      await nextTick()

      const checks = {
        versionBumped: nextVersion === versionBefore + 1,
        stateRetained: afterHot > afterInc && afterInc > before,
        hotActionApplied: afterHot - afterInc === nextVersion,
      }

      const result = buildResult('hmr', checks, {
        versionBefore,
        nextVersion,
        before,
        afterInc,
        afterHot,
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
