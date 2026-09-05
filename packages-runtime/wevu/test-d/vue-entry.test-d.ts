import type { ComponentProvideOptions } from 'vue'
import type { ComponentOptionsMixin, ComponentPublicInstance, DefineComponent, ExtractDefaultPropTypes, ExtractPropTypes, PublicProps } from 'wevu'
import { expectAssignable, expectError, expectType } from 'tsd'

const _propsOptions = {
  msg: { type: String, default: 'hi' },
  count: { type: Number, required: true },
  flag: Boolean,
} as const
type PropsOptions = typeof _propsOptions

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
  HTMLElement
>

declare const instance: InstanceType<Demo>
declare const exposedInstance: InstanceType<ExposedDemo>
declare const publicInstance: ComponentPublicInstance

expectType<string | undefined>(instance.$props.msg)
expectType<number>(instance.$props.count)
expectType<boolean | undefined>(instance.$props.flag)
expectAssignable<Record<string, any>>(instance.$slots)
expectType<void>(instance.$emit('change', { count: 1 }, 'extra'))
expectError(instance.$props.nonexistent)

expectType<Record<string, any>>(publicInstance.$props)
expectType<Record<string, any>>(publicInstance.$slots)
expectType<void>(publicInstance.$emit('change', { count: 1 }, 'extra'))

expectType<() => void>(exposedInstance.open)
expectError(exposedInstance.close)
expectType<() => void>(exposedInstance.$refs.panel.open)
expectType<HTMLElement>(exposedInstance.$el)

declare const props: Props
declare const defaults: Defaults
expectType<string>(props.msg)
expectType<number>(props.count)
expectType<string>(defaults.msg)
expectError(defaults.count)
