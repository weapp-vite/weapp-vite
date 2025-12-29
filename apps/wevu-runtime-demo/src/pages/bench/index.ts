import { defineComponent, effect, getCurrentInstance, nextTick, reactive, ref, stop, touchReactive, traverse } from 'wevu'

const N = 1000

function now() {
  return Date.now()
}

defineComponent({
  setup() {
    const setDataCount = ref(0)
    const results = ref<string[]>([])

    // patch setData to count calls
    const inst = getCurrentInstance() as any
    if (inst && typeof inst.setData === 'function') {
      const original = inst.setData
      inst.setData = function patchedSetData(this: any, payload: Record<string, any>) {
        setDataCount.value += 1
        return original.call(this, payload)
      }
    }

    async function benchReactivityDeep() {
      const obj = reactive({ foo: { bar: 0 } })
      let scheduled = 0
      const runner = effect(
        () => {
          traverse(obj)
        },
        {
          scheduler: () => {
            scheduled += 1
          },
        },
      )
      const t0 = now()
      for (let i = 0; i < N; i++) {
        obj.foo.bar = i
      }
      await nextTick()
      const t1 = now()
      stop(runner)
      results.value = [`deep traverse: ${N} writes, scheduled: ${scheduled}, time: ${t1 - t0}ms`, ...results.value]
    }

    async function benchReactivityRoot() {
      const obj = reactive({ foo: { bar: 0 } })
      let scheduled = 0
      const runner = effect(
        () => {
          touchReactive(obj)
        },
        {
          scheduler: () => {
            scheduled += 1
          },
        },
      )
      const t0 = now()
      for (let i = 0; i < N; i++) {
        obj.foo.bar = i
      }
      await nextTick()
      const t1 = now()
      stop(runner)
      results.value = [`root version: ${N} writes, scheduled: ${scheduled}, time: ${t1 - t0}ms`, ...results.value]
    }

    // setData frequency: single batch vs micro-batch
    const benchState = reactive({
      count: 0,
    })

    async function benchSetDataSingleBatch() {
      setDataCount.value = 0
      const t0 = now()
      for (let i = 0; i < N; i++) {
        benchState.count = i
      }
      await nextTick()
      const t1 = now()
      results.value = [
        `setData (single batch): ${N} writes → setData calls: ${setDataCount.value}, time: ${t1 - t0}ms`,
        ...results.value,
      ]
    }

    async function benchSetDataMicroBatches() {
      setDataCount.value = 0
      const t0 = now()
      for (let i = 0; i < N; i++) {
        benchState.count = i
        // flush each write to force a setData per iteration
        await nextTick()
      }
      const t1 = now()
      results.value = [
        `setData (micro-batches): ${N} writes → setData calls: ${setDataCount.value}, time: ${t1 - t0}ms`,
        ...results.value,
      ]
    }

    function clearResults() {
      results.value = []
      setDataCount.value = 0
    }

    return {
      setDataCount,
      results,
      benchReactivityDeep,
      benchReactivityRoot,
      benchSetDataSingleBatch,
      benchSetDataMicroBatches,
      clearResults,
    }
  },
})
