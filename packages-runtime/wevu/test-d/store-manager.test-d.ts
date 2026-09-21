import type { Pinia, StoreManager } from 'wevu'
import { expectType } from 'tsd'
import { createPinia, createStore } from 'wevu'
import { createPinia as createDevPinia, createStore as createDevStore } from 'wevu/dev'
import { createPinia as createSubpathPinia, createStore as createSubpathStore } from 'wevu/store'

expectType<typeof createPinia>(createStore)
expectType<typeof createPinia>(createSubpathPinia)
expectType<typeof createPinia>(createSubpathStore)
expectType<typeof createPinia>(createDevPinia)
expectType<typeof createPinia>(createDevStore)
expectType<Pinia>(createPinia())
expectType<StoreManager>(createPinia())
expectType<StoreManager>(createStore())

const manager = createStore()
expectType<Map<string, any>>(manager._stores)
const returned = manager.use(() => {})
expectType<typeof manager>(returned)
expectType<Pinia>(manager.use(({ pinia, options }) => {
  expectType<Pinia>(pinia)
  return { definition: options }
}))
