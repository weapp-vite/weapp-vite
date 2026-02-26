import type { NativeComponent } from 'wevu'

export interface NativeMeterTsProps {
  readonly label?: string
  readonly value?: number
  readonly tone?: 'neutral' | 'success' | 'danger'
}

Component({
  properties: {
    label: {
      type: String,
      value: '',
    },
    value: {
      type: Number,
      value: 0,
    },
    tone: {
      type: String,
      value: 'neutral',
    },
  },
})

const nativeMeterTs = {} as NativeComponent<NativeMeterTsProps>

export default nativeMeterTs
