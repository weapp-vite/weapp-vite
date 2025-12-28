import type { Ref } from '@/index'
import { expectError, expectType } from 'tsd'
import { defineStore, storeToRefs } from '@/index'

const useOptionsStore = defineStore('options', {
  state: () => ({ count: 0 }),
  getters: {
    double: state => state.count * 2,
    doublePlus(): number {
      expectType<number>(this.double)
      return this.double + 1
    },
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
expectType<number>(optionsStore.doublePlus)
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
expectError(optionsStore.notExists)

const optionsRefs = storeToRefs(optionsStore)
expectType<Ref<number>>(optionsRefs.count)
expectType<Ref<number>>(optionsRefs.double)
expectType<Ref<number>>(optionsRefs.doublePlus)

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

const stopAction = optionsStore.$onAction((context) => {
  expectType<string>(context.name)
  expectType<typeof optionsStore>(context.store)
  expectType<any[]>(context.args)
  context.after((res) => {
    expectType<number>(res)
  })
  context.onError((err) => {
    expectType<any>(err)
  })
})
expectType<() => void>(stopAction)

const stopSub = optionsStore.$subscribe((mutation, state) => {
  expectType<'patch object' | 'patch function'>(mutation.type)
  expectType<string>(mutation.storeId)
  expectType<{ count: number }>(state)
})
expectType<() => void>(stopSub)
