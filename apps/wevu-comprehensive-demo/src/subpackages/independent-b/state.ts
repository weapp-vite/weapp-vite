import { computed, ref } from 'wevu'

const count = ref(10)

export function useIndependentBCounter() {
  const label = computed(() => `Independent B: ${count.value}`)

  function increment() {
    count.value += 1
  }

  function reset() {
    count.value = 10
  }

  return {
    count,
    label,
    increment,
    reset,
  }
}
