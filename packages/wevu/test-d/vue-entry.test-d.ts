import type { ComponentPublicInstance, DefineComponent } from 'vue'
import type { ExtractDefaultPropTypes, ExtractPropTypes } from 'wevu'
import { expectError, expectType } from 'tsd'

interface PropsOptions {
  msg: { type: StringConstructor, default: 'hi' }
  count: { type: NumberConstructor, required: true }
  flag: BooleanConstructor
}

type Props = ExtractPropTypes<PropsOptions>
type Defaults = ExtractDefaultPropTypes<PropsOptions>

type Demo = DefineComponent<PropsOptions>

declare const instance: InstanceType<Demo>
declare const publicInstance: ComponentPublicInstance

expectType<string | undefined>(instance.$props.msg)
expectType<number>(instance.$props.count)
expectType<boolean | undefined>(instance.$props.flag)
expectType<Record<string, any>>(instance.$slots)
expectType<(event: string, detail?: any, options?: any) => void>(instance.$emit)
expectError(instance.$props.nonexistent)

expectType<Record<string, any>>(publicInstance.$props)
expectType<Record<string, any>>(publicInstance.$slots)
expectType<(event: string, detail?: any, options?: any) => void>(publicInstance.$emit)

expectType<Props>({} as Props)
expectType<Defaults>({} as Defaults)
