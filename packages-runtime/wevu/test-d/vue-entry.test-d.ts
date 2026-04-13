import type { ComponentOptionsMixin, ComponentProvideOptions, ComponentPublicInstance, DefineComponent, PublicProps } from 'vue'
import type { ExtractDefaultPropTypes, ExtractPropTypes } from 'wevu'
import { expectError, expectType } from 'tsd'

interface PropsOptions {
  msg: { type: StringConstructor, default: 'hi' }
  count: { type: NumberConstructor, required: true }
  flag: BooleanConstructor
}

type Props = ExtractPropTypes<PropsOptions>
type Defaults = ExtractDefaultPropTypes<PropsOptions>
type EmptyRecord = Record<string, never>

type Demo = DefineComponent<PropsOptions>
type ExposedDemo = DefineComponent<
  EmptyRecord,
  {
    close: () => void
    open: () => void
  },
  EmptyRecord,
  EmptyRecord,
  EmptyRecord,
  ComponentOptionsMixin,
  ComponentOptionsMixin,
  EmptyRecord,
  string,
  PublicProps,
  EmptyRecord,
  EmptyRecord,
  EmptyRecord,
  EmptyRecord,
  EmptyRecord,
  'open',
  ComponentProvideOptions,
  true,
  {
    panel: {
      open: () => void
    }
  },
  HTMLElementTagNameMap['view']
>

declare const instance: InstanceType<Demo>
declare const exposedInstance: InstanceType<ExposedDemo>
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

expectType<() => void>(exposedInstance.open)
expectError(exposedInstance.close)
expectType<() => void>(exposedInstance.$refs.panel.open)
expectType<HTMLElementTagNameMap['view']>(exposedInstance.$el)

expectType<Props>({} as Props)
expectType<Defaults>({} as Defaults)
