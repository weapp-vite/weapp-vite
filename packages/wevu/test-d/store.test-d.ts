import type { Ref } from '@/index'
import { expectType } from 'tsd'
import { defineStore, storeToRefs } from '@/index'

const useOptionsStore = defineStore('options', {
  state: () => ({ count: 0 }),
  getters: {
    double: state => state.count * 2,
  },
  actions: {
    inc() {
      this.count += 1
      return this.count
    },
  },
})

const optionsStore = useOptionsStore()
expectType<number>(optionsStore.count)
expectType<number>(optionsStore.double)
expectType<number>(optionsStore.inc())
expectType<{ count: number }>(optionsStore.$state)
expectType<void>(optionsStore.$patch({ count: 2 }))
expectType<void>(optionsStore.$patch((s) => {
  s.count++
}))
expectType<void>(optionsStore.$reset())
const unsub = optionsStore.$subscribe(() => {}, { detached: true })
expectType<() => void>(unsub)
const unsubAction = optionsStore.$onAction(() => () => {})
expectType<() => void>(unsubAction)

const optionsRefs = storeToRefs(optionsStore)
expectType<Ref<number>>(optionsRefs.count)
expectType<Ref<number>>(optionsRefs.double)

const useSetupStore = defineStore('setup', () => {
  const count = 1
  const inc = () => count + 1
  return { count, inc }
})

const setupStore = useSetupStore()
expectType<number>(setupStore.count)
expectType<number>(setupStore.inc())
expectType<string>(setupStore.$id)
const unsubSetup = setupStore.$subscribe(() => {})
expectType<() => void>(unsubSetup)
const unsubActionSetup = setupStore.$onAction(() => {})
expectType<() => void>(unsubActionSetup)
