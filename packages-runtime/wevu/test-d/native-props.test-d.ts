import type { InferNativeProps, InferNativePropType, NativePropType, NativeTypedProperty, NativeTypeHint } from '@/index'
import { expectType } from 'tsd'

type Tone = 'neutral' | 'success' | 'danger'

const _nativeProperties = {
  label: {
    type: String,
    value: '',
  },
  value: {
    type: Number,
    value: 0,
  },
  active: {
    type: Boolean,
    value: false,
  },
  tone: {
    type: String as NativePropType<Tone>,
    value: 'neutral',
  },
}

type NativeProps = InferNativeProps<typeof _nativeProperties>

expectType<string | undefined>(({} as NativeProps).label)
expectType<number | undefined>(({} as NativeProps).value)
expectType<boolean | undefined>(({} as NativeProps).active)
expectType<Tone | undefined>(({} as NativeProps).tone)

type ToneWithHint = InferNativePropType<NativeTypedProperty<Tone, { type: StringConstructor, value: 'neutral' }>>
expectType<Tone>({} as ToneWithHint)

type HintOnly = InferNativePropType<NativeTypeHint<{ id: string }>>
expectType<{ id: string }>({} as HintOnly)
