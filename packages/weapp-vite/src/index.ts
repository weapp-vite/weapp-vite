export * from './config'
export * from './createContext'
export { defineEmits, defineProps } from './plugins/vue/runtime'
export type { WevuComponentOptions } from './plugins/vue/runtime'

export * from './types/external'
// 运行时 API（Vue）
// 从 wevu 重新导出 createWevuComponent
export { createWevuComponent } from 'wevu'
