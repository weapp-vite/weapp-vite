import { defineStore, ref } from 'wevu'

export const useCounterStore = defineStore('stateful-hmr-counter', () => {
  const count = ref(0)
  return {
    count,
    increment: (delta: number) => { count.value += delta },
  }
})
