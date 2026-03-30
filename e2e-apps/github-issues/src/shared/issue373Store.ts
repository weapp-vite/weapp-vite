import { computed, defineStore, ref } from 'wevu'

export const useIssue373Store = defineStore('issue-373-store', () => {
  const count = ref(1)
  const doubled = computed(() => count.value * 2)

  function increment() {
    count.value += 1
  }

  function reset() {
    count.value = 1
  }

  return {
    count,
    doubled,
    increment,
    reset,
  }
})
