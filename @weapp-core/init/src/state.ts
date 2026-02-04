import { createContext } from './context'

/**
 * @description 全局上下文（用于 init 过程中的状态存储）
 */
export const ctx = createContext()

/**
 * @description 重置全局上下文
 */
export function resetContext() {
  const next = createContext()
  Object.assign(ctx.projectConfig, next.projectConfig)
  Object.assign(ctx.packageJson, next.packageJson)
  Object.assign(ctx.viteConfig, next.viteConfig)
  Object.assign(ctx.tsconfig, next.tsconfig)
  Object.assign(ctx.tsconfigApp, next.tsconfigApp)
  Object.assign(ctx.tsconfigNode, next.tsconfigNode)
  Object.assign(ctx.dts, next.dts)
}
