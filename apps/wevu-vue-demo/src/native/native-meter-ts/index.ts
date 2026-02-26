import type { InferNativeProps, NativeComponent, NativePropType } from 'wevu'

type NativeMeterTone = 'neutral' | 'success' | 'danger'

const nativeMeterProperties = {
  label: {
    type: String,
    value: '',
  },
  value: {
    type: Number,
    value: 0,
  },
  tone: {
    type: String as NativePropType<NativeMeterTone>,
    value: 'neutral',
  },
}

type NativeMeterTsProps = InferNativeProps<typeof nativeMeterProperties>

Component({
  properties: nativeMeterProperties,
})

const nativeMeterTs = {} as NativeComponent<NativeMeterTsProps>

export default nativeMeterTs
