import type { ComputedRef, Ref } from 'wevu'
import { expectError, expectType } from 'tsd'
import { computed, createPinia, defineStore, disposePinia, getActivePinia, ref, setActivePinia, storeToRefs } from 'wevu'

const useOptionsStore = defineStore('options', {
  state: () => ({ count: 0, nested: { counter: 1 } }),
  getters: {
    double: (state) => {
      expectType<{ count: number, nested: { counter: number } }>(state)
      return state.count * 2
    },
    upper(): string {
      expectType<number>(this.count)
      expectType<number>(this.double)
      return String(this.count).toUpperCase()
    },
    doublePlus(): number {
      expectType<number>(this.double)
      return this.double + 1
    },
    doubleCounter: (state) => {
      expectType<{ count: number, nested: { counter: number } }>(state)
      return state.nested.counter * 2
    },
  },
  actions: {
    inc() {
      this.$patch((state) => {
        expectType<number>(state.count)
      })
      expectType<number>(this.$state.count)
      expectType<void>(this.$reset())
      expectError(this.$patch({ count: 'invalid' }))
      this.count += 1
      return this.count
    },
  },
})

const optionsStore = useOptionsStore()
expectType<number>(optionsStore.count)
expectType<number>(optionsStore.double)
expectType<number>(optionsStore.doublePlus)
expectType<string>(optionsStore.upper)
expectType<number>(optionsStore.doubleCounter)
expectType<number>(optionsStore.inc())
expectType<{ count: number, nested: { counter: number } }>(optionsStore.$state)
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
optionsStore.$state = { count: 3, nested: { counter: 1 } }
expectError(optionsStore.$state = { count: 'invalid', nested: { counter: 1 } })

const optionsRefs = storeToRefs(optionsStore)
expectType<Ref<number>>(optionsRefs.count)
expectType<ComputedRef<number>>(optionsRefs.double)
expectType<ComputedRef<number>>(optionsRefs.doublePlus)
expectType<ComputedRef<string>>(optionsRefs.upper)
expectType<ComputedRef<number>>(optionsRefs.doubleCounter)

const useSetupStore = defineStore('setup', () => {
  const count = 1
  const inc = () => count + 1
  return { count, inc }
})

const setupStore = useSetupStore()
expectType<number>(setupStore.count)
expectType<number>(setupStore.inc())
expectType<'setup'>(setupStore.$id)
expectType<void>(setupStore.$reset())
const unsubSetup = setupStore.$subscribe(() => {})
expectType<() => void>(unsubSetup)
const unsubActionSetup = setupStore.$onAction(() => {})
expectType<() => void>(unsubActionSetup)
expectError(setupStore.notExists)

const stopAction = optionsStore.$onAction((context) => {
  expectType<'inc'>(context.name)
  expectType<typeof optionsStore>(context.store)
  expectType<[]>(context.args)
  context.after((res) => {
    expectType<number>(res)
  })
  context.onError((err) => {
    expectType<any>(err)
  })
})
expectType<() => void>(stopAction)

const stopSub = optionsStore.$subscribe((mutation, state) => {
  expectType<'direct' | 'patch object' | 'patch function'>(mutation.type)
  expectType<string>(mutation.storeId)
  expectType<{ count: number, nested: { counter: number } }>(state)
})
expectType<() => void>(stopSub)

const useAsyncStore = defineStore('async-actions', {
  state: () => ({ count: 0 }),
  actions: {
    async increment() {
      return ++this.count
    },
  },
})
useAsyncStore().$onAction(({ store, after }) => {
  expectType<number>(store.$state.count)
  expectType<void>(store.$patch({ count: 1 }))
  after((result) => {
    expectType<number>(result)
  })
})

const pinia = createPinia()
expectType<typeof pinia>(setActivePinia(pinia))
expectType<typeof pinia | undefined>(getActivePinia())
expectType<typeof optionsStore>(useOptionsStore(pinia))
expectType<void>(optionsStore.$dispose())
expectType<() => void>(optionsStore.$onAction(() => {}, true))
expectError(optionsStore.double = 4)
expectError(optionsRefs.double.value = 4)
expectError(optionsRefs.inc)
expectError(optionsRefs.$patch)
optionsStore.$patch({ nested: {} })
expectError(optionsStore.$patch({ nested: { counter: 'bad' } }))

const useTypedSetup = defineStore('typed-setup', () => {
  const n = ref(1)
  const doubled = computed(() => n.value * 2)
  const writable = computed({ get: () => n.value, set: (value: number) => n.value = value })
  return { n, doubled, writable, add: (value: number) => n.value += value }
})
const typedSetup = useTypedSetup(pinia)
expectType<number>(typedSetup.n)
expectType<number>(typedSetup.doubled)
expectType<number>(typedSetup.writable)
expectError(typedSetup.doubled = 1)
expectError(typedSetup.n.value)
expectError(typedSetup.add('wrong'))
expectError(typedSetup.$state.doubled)
expectError(typedSetup.$state.add)
const typedRefs = storeToRefs(typedSetup)
expectType<Ref<number>>(typedRefs.n)
expectType<ComputedRef<number>>(typedRefs.doubled)
expectType<Ref<number>>(typedRefs.writable)
expectError(typedRefs.add)
expectError(typedRefs.doubled.value = 1)
expectType<void>(typedSetup.$dispose())
expectType<void>(disposePinia(pinia))

const useActionTypes = defineStore('action-types', {
  actions: {
    add(n: number) {
      return n + 1
    },
    async label(value: string) {
      return value.toUpperCase()
    },
  },
})
useActionTypes(pinia).$onAction((context) => {
  if (context.name === 'add') {
    expectType<[n: number]>(context.args)
    context.after(value => expectType<number>(value))
  }
  else {
    expectType<[value: string]>(context.args)
    context.after(value => expectType<string>(value))
  }
})
expectType<() => void>(typedSetup.$onAction(() => {}, true))
