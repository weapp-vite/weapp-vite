import { computed, ref } from 'wevu'

const count = ref(0)

export function useIndependentACounter() {
  const label = computed(() => `Independent A: ${count.value}`)

  function increment() {
    count.value += 1
  }

  function reset() {
    count.value = 0
  }

  return {
    count,
    label,
    increment,
    reset,
  }
}
