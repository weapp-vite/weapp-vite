import type { RouterNavigation } from 'wevu/dev/router'
import { expectType } from 'tsd'
import { createApp, defineComponent, ref } from 'wevu/dev'
import { createRouter } from 'wevu/dev/router'
import { createStore, defineStore } from 'wevu/dev/store'

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

const useCounter = defineStore('dev-counter', {
  state: () => ({
    count: 0,
  }),
})
expectType<number>(useCounter().count)
