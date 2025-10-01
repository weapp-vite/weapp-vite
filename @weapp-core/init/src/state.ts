import { createContext } from './context'

export const ctx = createContext()

export function resetContext() {
  const next = createContext()
  Object.assign(ctx.projectConfig, next.projectConfig)
  Object.assign(ctx.packageJson, next.packageJson)
  Object.assign(ctx.viteConfig, next.viteConfig)
  Object.assign(ctx.tsconfig, next.tsconfig)
  Object.assign(ctx.tsconfigNode, next.tsconfigNode)
  Object.assign(ctx.dts, next.dts)
}
