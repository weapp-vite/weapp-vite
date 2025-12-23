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
  [key: string]: any
}

export function createWevuComponent(options: WevuComponentOptions) {
  const {
    type = 'page',
    ...restOptions
  } = options

  if (type === 'component') {
    defineComponent(restOptions as any)
  }
  else {
    definePage(restOptions as any)
  }
}
