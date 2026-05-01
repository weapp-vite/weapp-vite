import type { RouterNavigation } from 'wevu/debug/router'
import { expectType } from 'tsd'
import { createApp, defineComponent, ref } from 'wevu/debug'
import { createRouter } from 'wevu/debug/router'
import { createStore, defineStore } from 'wevu/debug/store'

const count = ref(0)
expectType<number>(count.value)

expectType<ReturnType<typeof defineComponent>>(defineComponent({
  setup() {
    return {
      count,
    }
  },
}))

expectType<ReturnType<typeof createApp>>(createApp({ setup() {} }))
expectType<RouterNavigation>(createRouter())
expectType<ReturnType<typeof createStore>>(createStore())

const useCounter = defineStore('debug-counter', {
  state: () => ({
    count: 0,
  }),
})
expectType<number>(useCounter().count)
