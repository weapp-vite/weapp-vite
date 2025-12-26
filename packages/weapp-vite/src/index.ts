export * from './config'
export * from './createContext'
export { defineEmits, defineProps } from './plugins/vue/runtime'
export type { WevuComponentOptions } from './plugins/vue/runtime'

export * from './types/external'
// Vue Runtime API
// createWevuComponent is re-exported from wevu
export { createWevuComponent } from 'wevu'
