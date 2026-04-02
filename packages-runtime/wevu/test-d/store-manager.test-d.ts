import { expectType } from 'tsd'
import { createStore } from '@/index'

const manager = createStore()
expectType<Map<string, any>>(manager._stores)
const returned = manager.use(() => {})
expectType<typeof manager>(returned)
