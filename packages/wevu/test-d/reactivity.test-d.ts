import type { Ref } from '@/index'
import { expectError, expectType } from 'tsd'
import { computed, effect, getDeepWatchStrategy, isRaw, isReactive, isRef, isShallowReactive, isShallowRef, markRaw, reactive, readonly, ref, setDeepWatchStrategy, shallowReactive, shallowRef, stop, toRaw, toRef, toRefs, touchReactive, traverse, triggerRef, unref, watch, watchEffect } from '@/index'

const n = ref(1)
expectType<number>(n.value)
expectType<boolean>(isRef(n))

const doubled = computed(() => n.value * 2)
expectType<number>(doubled.value)

const stopWatch = watch(n, (value, oldValue) => {
  expectType<number>(value)
  expectType<number>(oldValue)
})
expectType<() => void>(stopWatch)

const stopEffect = watchEffect((onCleanup) => {
  onCleanup(() => {})
})
expectType<() => void>(stopEffect)
setDeepWatchStrategy('version')
expectType<'version' | 'traverse'>(getDeepWatchStrategy())

const ro = readonly(n)
expectType<number>(ro.value)
expectError(ro.value = 2)
expectType<number>(unref(ro))

const obj = { foo: ref('bar'), count: 0 }
const objRefs = toRefs(obj)
expectType<Ref<string>>(objRefs.foo)
expectType<Ref<number>>(objRefs.count)
const singleRef = toRef(obj, 'count')
expectType<Ref<number>>(singleRef)

const state = reactive({ a: 1, nested: { b: 2 } })
expectType<boolean>(isReactive(state))
expectType<number>(state.a)
const raw = toRaw(state)
expectType<{ a: number, nested: { b: number } }>(raw)

const sState = shallowReactive({ a: { deep: true } })
expectType<boolean>(isShallowReactive(sState))

const r = shallowRef({ a: 1 })
expectType<boolean>(isShallowRef(r))
triggerRef(r)

const marked = markRaw({ locked: true })
expectType<{ locked: boolean }>(marked)
expectType<boolean>(isRaw(marked))

touchReactive(state)
traverse(state)

const runner = effect(() => n.value)
expectType<() => void>(() => stop(runner))
