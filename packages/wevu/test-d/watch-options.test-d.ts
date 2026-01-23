import type { WatchScheduler, WatchSource } from '@/index'
import { expectError, expectType } from 'tsd'
import { computed, reactive, ref, watch, watchEffect } from '@/index'

const count = ref(0)
const doubled = computed(() => count.value * 2)

const source: WatchSource<number> = doubled
expectType<WatchSource<number>>(source)

watch(count, (value, oldValue) => {
  expectType<number>(value)
  expectType<number>(oldValue)
})

watch(count, (value, oldValue) => {
  expectType<number>(value)
  expectType<number | undefined>(oldValue)
}, { immediate: true as const })

const state = reactive({ a: 1, b: 'x' })
watch(state, (value, oldValue) => {
  expectType<{ a: number, b: string }>(value)
  expectType<{ a: number, b: string }>(oldValue)
})

const tupleSources = [count, () => 'ok', doubled] as const
watch(tupleSources, (values, oldValues) => {
  expectType<[number, string, number]>(values)
  expectType<[number, string, number]>(oldValues)
})

watch(tupleSources, (values, oldValues) => {
  expectType<[number, string, number]>(values)
  expectType<[number | undefined, string | undefined, number | undefined]>(oldValues)
}, { immediate: true as const })

const arraySources = [count, ref('a')]
watch(arraySources, (values) => {
  expectType<Array<number | string>>(values)
})

const scheduler: WatchScheduler = (job, isFirstRun) => {
  expectType<() => void>(job)
  expectType<boolean>(isFirstRun)
}

watch(count, () => {}, { scheduler, once: true })
watch(count, () => {}, { flush: 'pre' })
watch(count, () => {}, { flush: 'post' })
watch(count, () => {}, { flush: 'sync' })
watchEffect(() => {}, { flush: 'post' })

expectError(watch(count, () => {}, { flush: 'invalid' }))
expectError(watchEffect(() => {}, { flush: 'invalid' }))
