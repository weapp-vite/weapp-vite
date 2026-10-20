import type { Ref as VueRef } from '@vue/reactivity'
import type { ComputedDefinitions, ComputedGetter, ExtractComputed, MethodDefinitions, Ref, WritableComputedOptions } from 'wevu/types'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

declare const ref: Ref<number, number | string>
declare const vueRef: VueRef<number, number | string>
expectType<VueRef<number, number | string>>(ref)
expectType<Ref<number, number | string>>(vueRef)
expectType<number>(ref.value)
ref.value = '1'
expectNotAssignable<Ref<number>>(1)
expectNotAssignable<Ref<number>>({ value: 1 })
expectAssignable<ComputedDefinitions>({
  count: () => 1,
  writable: {
    get: () => 1,
    set(value: number) {
      void value
    },
  },
})
expectAssignable<MethodDefinitions>({
  update(value: string) {
    return value
  },
})
expectNotAssignable<ComputedDefinitions>({ count: 1 })
expectNotAssignable<ComputedDefinitions>({ count: (value: number) => value })
expectAssignable<WritableComputedOptions<number>>({
  get: () => 1,
  set(value: number) {
    void value
  },
})
expectNotAssignable<WritableComputedOptions<number>>({
  get: () => 'value',
  set(value: number) {
    void value
  },
})
expectNotAssignable<WritableComputedOptions<number>>({
  get: () => 1,
  set(value: string) {
    void value
  },
})
expectType<{ count: number }>({} as ExtractComputed<{ count: ComputedGetter<number> }>)
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void wx
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void my
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void tt
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void document
// @ts-expect-error 纯类型入口不得合入小程序模板的 DOM 标签接口。
export type NoDomTagMap = HTMLElementTagNameMap
