import { defineComponent, isNoSetData, markNoSetData, nextTick, reactive } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

export default defineComponent({
  data: () => ({
    __e2e: {
      ok: false,
      checks: {},
    } as any,
    __e2eText: '',
  }),
  setup(_props, ctx) {
    const state = reactive({
      count: 0,
      nested: { value: 1 },
      list: [1, 2],
      skip: markNoSetData({ secret: 'hidden' }),
    })

    const runE2E = async () => {
      const target = ctx.instance as any
      const calls: Array<Record<string, any>> = []
      const rawSetData = target.setData
      target.setData = (payload: Record<string, any>, cb?: () => void) => {
        calls.push(payload)
        return rawSetData.call(target, payload, cb)
      }

      state.count = 1
      state.nested.value = 2
      state.list.push(3)
      ;(state.skip as any).secret = 'still-hidden'
      await nextTick()

      target.setData = rawSetData

      const mergedPayload = Object.assign({}, ...calls)
      const payloadKeys = Object.keys(mergedPayload)
      const hasSkipKey = payloadKeys.some(key => key.startsWith('skip'))

      const checks = {
        hasCalls: calls.length > 0,
        noSetData: !hasSkipKey,
        includesNested: payloadKeys.some(key => key.endsWith('.nested.value') || key.includes('.nested.')),
        includesList: payloadKeys.some(key => key.endsWith('.list') || key.includes('.list[') || key.includes('.list.')),
        isNoSetData: isNoSetData(state.skip),
      }

      const result = buildResult('diff', checks, {
        payloadKeys,
        callCount: calls.length,
      })

      target.setData({
        __e2e: result,
        __e2eText: stringifyResult(result),
      })

      return result
    }

    return {
      runE2E,
      state,
    }
  },
})
