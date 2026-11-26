import type { ReactiveRuntime } from '@varo-ui/headless'
import { computed, shallowRef } from 'wevu'

export const varoReactiveRuntime: ReactiveRuntime = {
  computed,
  ref: shallowRef,
}
