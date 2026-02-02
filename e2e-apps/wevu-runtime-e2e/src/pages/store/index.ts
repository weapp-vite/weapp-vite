import { defineComponent, nextTick, storeToRefs } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'
import { getPluginRecords, useOptionsStore, useSetupStore } from '../../shared/store'

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
    const setupRefs = storeToRefs(setupStore)
    const optionsRefs = storeToRefs(optionsStore)

    const subscribeLogs: string[] = []
    const actionLogs: string[] = []

    const unsubscribe = setupStore.$subscribe((mutation) => {
      subscribeLogs.push(mutation.type)
    }, { detached: true })

    const unAction = setupStore.$onAction(({ name, after, onError }) => {
      actionLogs.push(`before:${name}`)
      after(() => actionLogs.push(`after:${name}`))
      onError(() => actionLogs.push(`error:${name}`))
    })
    void unsubscribe
    void unAction

    const runE2E = async () => {
      setupStore.inc(2)
      setupStore.visit()
      setupStore.setName('alpha')
      setupStore.$patch((state: any) => {
        state.extra = 'patched'
      })
      setupStore.$reset()

      const setupResetOk = setupStore.count.value === 0 && setupStore.name.value === 'init'

      const beforeCount = optionsStore.count
      optionsStore.inc(3)
      optionsStore.rename('beta')
      optionsStore.$patch({ label: 'patched' })
      optionsStore.$patch((state) => {
        state.count += 1
      })
      const patchedCount = optionsStore.count
      optionsStore.$reset()
      const optionsResetOk = optionsStore.count === 0 && optionsStore.label === 'zero'

      setupStore.inc(1)
      optionsStore.inc(1)
      optionsStore.label = 'shared'
      setupStore.setName('shared')

      await nextTick()

      const checks = {
        pluginTouched: Boolean((setupStore as any).__pluginTouched),
        pluginRecords: getPluginRecords().includes('setupCounter') && getPluginRecords().includes('optionsCounter'),
        subscribeTriggered: subscribeLogs.length > 0,
        actionTriggered: actionLogs.includes('before:inc') && actionLogs.includes('after:inc'),
        setupReset: setupResetOk,
        optionsReset: optionsResetOk,
        optionsPatched: patchedCount === beforeCount + 4,
        refsSetup: setupRefs.count.value === setupStore.count.value,
        refsOptions: optionsRefs.count.value === optionsStore.count,
        refsGetter: optionsRefs.doubled.value === optionsStore.count * 2,
      }

      const result = buildResult('store', checks, {
        subscribeLogs,
        actionLogs,
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
