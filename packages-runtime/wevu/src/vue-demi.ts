export * from './index'
export { version } from './version'

/**
 * 标记当前兼容层运行在 Vue 3 风格分支。
 */
export const isVue2 = false

/**
 * 标记当前兼容层运行在 Vue 3 风格分支。
 */
export const isVue3 = true

/**
 * 与 `vue-demi` 保持一致，Vue 3 分支下不暴露 Vue 2 构造器。
 */
export const Vue2 = undefined

/**
 * Vue 3 分支的 `vue-demi.install()` 为 no-op，这里保持同样语义。
 */
export function install() {}
