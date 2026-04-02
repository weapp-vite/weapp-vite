import type { ComponentRuntimeState } from './state'
import type {
  ComponentOptions,
  ComponentPublicInstance,
  PageLifeTimeHooks,
} from './types'

export interface WeappComponentInstance extends ComponentPublicInstance {
  __weappSync: (nextMethods: ComponentOptions['methods']) => void
  __weappInvokePageLifetime: (type: keyof PageLifeTimeHooks) => void
}

export interface CreateComponentElementClassOptions {
  BaseElement: typeof HTMLElement
  runtimeState: ComponentRuntimeState
  instances: Set<WeappComponentInstance>
}
