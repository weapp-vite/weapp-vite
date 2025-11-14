import { computed, ref } from 'wevu'
import { defineStore } from 'wevu/store'

export const useCounter = defineStore('counter', () => {
  const count = ref(0)
  const double = computed(() => count.value * 2)
  function inc() {
    count.value += 1
  }
  function dec() {
    if (count.value > 0) {
      count.value -= 1
    }
  }
  function reset() {
    count.value = 0
  }
  return { count, double, inc, dec, reset }
})
