import './runtime/templateRefTypes'

export * from './macros'
export * from './reactivity'
export * from './runtime'
export { nextTick } from './scheduler'
export * from './store'

declare module 'vue' {
  export * from 'wevu'
}
