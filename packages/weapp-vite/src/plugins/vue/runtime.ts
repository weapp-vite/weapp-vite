import type {
  ComputedDefinitions,
  MethodDefinitions,
} from 'wevu'
import { defineComponent, definePage } from 'wevu'

export interface WevuComponentOptions<D extends object = Record<string, any>, C extends ComputedDefinitions = ComputedDefinitions, M extends MethodDefinitions = MethodDefinitions> {
  type?: 'page' | 'component'
  data?: () => D
  computed?: C
  methods?: M
  watch?: any
  setup?: (...args: any[]) => any
  properties?: Record<string, any>
  [key: string]: any
}

/**
 * Create a wevu component from Vue SFC options
 * Supports both Vue 2 style (Options API) and Vue 3 style (Composition API)
 */
export function createWevuComponent(options: WevuComponentOptions) {
  const {
    type = 'page',
    properties,
    ...restOptions
  } = options

  // Merge properties into mini-program options
  const mpOptions: Record<string, any> = {}
  if (properties) {
    mpOptions.properties = properties
  }

  // Merge other options
  const finalOptions = {
    ...restOptions,
    ...mpOptions,
  }

  if (type === 'component') {
    defineComponent(finalOptions as any)
  }
  else {
    definePage(finalOptions as any)
  }
}

/**
 * Define component with Vue 3 style props
 */
export function defineProps<T extends Record<string, any>>(props: T): T {
  return props
}

/**
 * Define emits with Vue 3 style
 */
export function defineEmits<T extends Record<string, any> | string[]>(emits: T): T {
  return emits
}
