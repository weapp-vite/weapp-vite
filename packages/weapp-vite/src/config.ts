// 参考：https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/node/types/vite.ts
// 参考：https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/public/config.ts
import type { ConfigEnv, UserConfig as ViteUserConfig } from 'vite'
import type { WeappViteConfig } from './types'

export * from './json'

/**
 * @description weapp-vite 的用户配置（扩展 Vite UserConfig）
 */
export type UserConfig = ViteUserConfig & { weapp?: WeappViteConfig }

export type UserConfigFnNoEnvPlain<T extends UserConfig = UserConfig> = () => T

export type UserConfigFnNoEnv<T extends UserConfig = UserConfig> = () => T | Promise<T>

export type UserConfigFnObjectPlain<T extends UserConfig = UserConfig> = (env: ConfigEnv) => T

export type UserConfigFnObject<T extends UserConfig = UserConfig> = (env: ConfigEnv) => T

export type UserConfigFnPromise<T extends UserConfig = UserConfig> = (env: ConfigEnv) => Promise<T>

export type UserConfigFn<T extends UserConfig = UserConfig> = (env: ConfigEnv) => T | Promise<T>

type UserConfigLoose = UserConfig & Record<string, any>

export type UserConfigExport<T extends UserConfig = UserConfig>
  = | T
    | Promise<T>
    | UserConfigFnNoEnv<T>
    | UserConfigFnObject<T>
    | UserConfigFnPromise<T>
    | UserConfigFn<T>

// 扩展 vite 的 UserConfig
declare module 'vite' {
  interface UserConfig {
    weapp?: WeappViteConfig
  }
}

/**
 * @description 为 weapp-vite 配置提供类型提示与推断
 * @description 注意：同步回调重载需要放在 Promise/联合返回前面，
 * 这样 `vite.config.ts` 里对象字面量属性（如 `weapp.srcRoot`）才能保留上下文类型，
 * 才能在编辑器中正确显示 JSDoc 与支持跳转。
 */
export function defineConfig(config: UserConfig): UserConfig
export function defineConfig(config: Promise<UserConfig>): Promise<UserConfig>
export function defineConfig(config: UserConfigFnNoEnvPlain): UserConfigFnNoEnvPlain
export function defineConfig(config: UserConfigFnNoEnv): UserConfigFnNoEnv
export function defineConfig(config: UserConfigFnObjectPlain): UserConfigFnObjectPlain
export function defineConfig(config: UserConfigFnPromise): UserConfigFnPromise
export function defineConfig(config: UserConfigFn): UserConfigFn
export function defineConfig(config: UserConfigLoose): UserConfigLoose
export function defineConfig(config: UserConfigExport): UserConfigExport {
  return config
}

export type {
  WeappViteConfig,
}
