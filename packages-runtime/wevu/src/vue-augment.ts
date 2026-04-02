import type { WevuGlobalComponents, WevuGlobalDirectives } from './runtime/types'

declare module '@vue/runtime-core' {
  export interface GlobalComponents extends WevuGlobalComponents {}
  export interface GlobalDirectives extends WevuGlobalDirectives {}
}

export {}
