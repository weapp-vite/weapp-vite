import { computed, defineComponent, onUnload, ref } from 'wevu'
import { zustandCounterStore } from '../../stores/zustandCounter'

function getSnapshot() {
  const { count, history, step } = zustandCounterStore.getState()
  return {
    count,
    history,
    step,
  }
}

defineComponent({
  setup() {
    const snapshot = ref(getSnapshot())

    const unsubscribe = zustandCounterStore.subscribe((state) => {
      snapshot.value = {
        count: state.count,
        history: state.history,
        step: state.step,
      }
    })

    onUnload(() => {
      unsubscribe()
    })

    const doubled = computed(() => snapshot.value.count * 2)
    const historySummary = computed(() =>
      snapshot.value.history.length
        ? snapshot.value.history.join(' / ')
        : '暂无状态变更',
    )

    function inc() {
      zustandCounterStore.getState().inc()
    }

    function dec() {
      zustandCounterStore.getState().dec()
    }

    function reset() {
      zustandCounterStore.getState().reset()
    }

    function useStep1() {
      zustandCounterStore.getState().setStep(1)
    }

    function useStep5() {
      zustandCounterStore.getState().setStep(5)
    }

    return {
      count: computed(() => snapshot.value.count),
      doubled,
      history: computed(() => snapshot.value.history),
      historySummary,
      step: computed(() => snapshot.value.step),
      dec,
      inc,
      reset,
      useStep1,
      useStep5,
    }
  },
})
