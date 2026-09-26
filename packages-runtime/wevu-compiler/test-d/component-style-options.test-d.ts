import type { ComponentStyleOptions, ComponentStylePrimitive, StaticComponentStyleOption, TransformResult, VueTransformResult } from '@wevu/compiler'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

declare const script: TransformResult
declare const compiled: VueTransformResult
expectType<ComponentStyleOptions | undefined>(script.componentStyleOptions)
expectType<ComponentStyleOptions | undefined>(compiled.meta?.componentStyleOptions)
expectAssignable<StaticComponentStyleOption>({ kind: 'absent' })
expectAssignable<StaticComponentStyleOption>({ kind: 'unknown' })
expectAssignable<StaticComponentStyleOption>({ kind: 'known', value: undefined })
expectNotAssignable<StaticComponentStyleOption>({ kind: 'known' })
expectNotAssignable<StaticComponentStyleOption>({ kind: 'known', value: {} })
if (compiled.meta?.componentStyleOptions?.styleIsolation.kind === 'known') {
  expectType<ComponentStylePrimitive>(compiled.meta.componentStyleOptions.styleIsolation.value)
}
