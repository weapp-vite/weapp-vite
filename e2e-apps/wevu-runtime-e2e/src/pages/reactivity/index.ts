import {
  addMutationRecorder,
  batch,
  computed,
  defineComponent,
  effect,
  effectScope,
  endBatch,
  getCurrentScope,
  getDeepWatchStrategy,
  getReactiveVersion,
  isRaw,
  isReactive,
  isRef,
  isShallowReactive,
  isShallowRef,
  markRaw,
  nextTick,
  onScopeDispose,
  prelinkReactiveTree,
  reactive,
  readonly,
  ref,
  removeMutationRecorder,
  setDeepWatchStrategy,
  shallowReactive,
  shallowRef,
  startBatch,
  stop,
  toRaw,
  toRef,
  toRefs,
  touchReactive,
  toValue,
  traverse,
  triggerRef,
  unref,
  watch,
  watchEffect,
} from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

export default defineComponent({
  data: () => ({
    __e2e: {
      ok: false,
      checks: {},
    } as any,
    __e2eText: '',
  }),
  setup() {
    const runE2E = async () => {
      const state = reactive({ count: 0, nested: { value: 1 }, list: [1, 2] })
      const shallowState = shallowReactive({ nested: { value: 1 } })
      const ro = readonly(state)

      const countRef = ref(0)
      const countRefFromState = toRef(state, 'count')
      const refs = toRefs(state)

      const computedValue = computed(() => state.count * 2)
      const watchValues: number[] = []
      const watchEffectValues: number[] = []

      const stopHandle = watch(
        () => state.count,
        (value) => {
          watchValues.push(value)
        },
      )

      watchEffect(() => {
        watchEffectValues.push(state.nested.value)
      })

      const runner = effect(() => {
        void state.count
      })
      stop(runner)

      batch(() => {
        state.count = 1
        state.nested.value = 2
      })
      await nextTick()

      stopHandle.pause()
      startBatch()
      state.count = 2
      state.count = 3
      endBatch()
      await nextTick()
      stopHandle.resume()
      state.count = 4
      await nextTick()
      stopHandle.stop()
      state.count = 5
      await nextTick()

      const shallowValue = shallowRef({ n: 1 })
      let shallowTriggered = 0
      watch(shallowValue, () => {
        shallowTriggered += 1
      })
      shallowValue.value.n = 2
      await nextTick()
      triggerRef(shallowValue)
      await nextTick()

      const scope = effectScope()
      let scopeDisposed = false
      let scopeMatched = false
      scope.run(() => {
        scopeMatched = getCurrentScope() === scope
        const scoped = ref(0)
        scoped.value += 1
        watch(scoped, () => {})
        watchEffect(() => {
          void scoped.value
        })
        onScopeDispose(() => {
          scopeDisposed = true
        })
      })
      scope.stop()

      const mutationLogs: any[] = []
      const recorder = (record: any) => mutationLogs.push(record)
      addMutationRecorder(recorder)
      prelinkReactiveTree(state, { maxDepth: 2, maxKeys: 50 })
      state.count = 6
      touchReactive(state)
      await nextTick()
      removeMutationRecorder(recorder)

      const raw = markRaw({ raw: true })
      const rawContainer = reactive({ raw })
      const versionBefore = getReactiveVersion(state)
      state.count = 7
      await nextTick()
      const versionAfter = getReactiveVersion(state)

      const prevStrategy = getDeepWatchStrategy()
      setDeepWatchStrategy('traverse')
      const currentStrategy = getDeepWatchStrategy()
      setDeepWatchStrategy(prevStrategy)

      const checks = {
        isRef: isRef(countRef),
        isReactive: isReactive(state),
        isShallowReactive: isShallowReactive(shallowState),
        isShallowRef: isShallowRef(shallowValue),
        markRaw: isRaw(raw),
        toRaw: toRaw(rawContainer).raw === raw,
        computed: computedValue.value === state.count * 2,
        watchTriggered: watchValues.join(',') === '1,4',
        watchEffectTriggered: watchEffectValues.length > 0,
        shallowRefTrigger: shallowTriggered === 1,
        scopeDisposed,
        scopeMatched,
        deepStrategy: currentStrategy === 'traverse',
        unrefValue: unref(countRef) === 0,
        toValueRef: toValue(countRef) === 0,
        toValueGetter: toValue(() => state.count) === state.count,
        toRefsValue: refs.count.value === state.count,
        toRefValue: countRefFromState.value === state.count,
        readonlyValue: ro.count === state.count,
        traverseWorks: traverse(state) === state,
        versionUpdated: versionAfter >= versionBefore,
        mutationRecorded: mutationLogs.length > 0,
      }

      const result = buildResult('reactivity', checks, {
        watchValues,
        watchEffectValues,
        shallowTriggered,
        currentStrategy,
        versionBefore,
        versionAfter,
        mutationLogs: mutationLogs.length,
      })

      return result
    }

    return {
      async runE2E() {
        const result = await runE2E()
        this.setData({
          __e2e: result,
          __e2eText: stringifyResult(result),
        })
        return result
      },
    }
  },
})
