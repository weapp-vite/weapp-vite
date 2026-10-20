/// <reference types="miniprogram-api-typings" />
import './vue-augment'

export * from './macros'

export * from './reactivity'
export * from './runtime'
export type { MiniProgramTemplateRefElements } from './runtime/templateRefTypes'
export { nextTick } from './scheduler'
export * from './store'
export * from './version'
export * from '@wevu/web-apis'
