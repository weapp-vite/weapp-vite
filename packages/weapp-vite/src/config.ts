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
 */
export function defineConfig(config: UserConfigFnNoEnv): UserConfigFnNoEnv
export function defineConfig(config: UserConfigFnNoEnvPlain): UserConfigFnNoEnvPlain
export function defineConfig(config: UserConfigFnObject): UserConfigFnObject
export function defineConfig(config: UserConfigFnObjectPlain): UserConfigFnObjectPlain
export function defineConfig(config: UserConfigFnPromise): UserConfigFnPromise
export function defineConfig(config: UserConfigFn): UserConfigFn
export function defineConfig(config: UserConfigLoose): UserConfigLoose
export function defineConfig<const T extends UserConfig>(config: UserConfigFnNoEnv<T>): UserConfigFnNoEnv<T>
export function defineConfig<const T extends UserConfig>(config: UserConfigFnNoEnvPlain<T>): UserConfigFnNoEnvPlain<T>
export function defineConfig<const T extends UserConfig>(config: UserConfigFnObject<T>): UserConfigFnObject<T>
export function defineConfig<const T extends UserConfig>(config: UserConfigFnObjectPlain<T>): UserConfigFnObjectPlain<T>
export function defineConfig<const T extends UserConfig>(config: UserConfigFnPromise<T>): UserConfigFnPromise<T>
export function defineConfig<const T extends UserConfig>(config: UserConfigFn<T>): UserConfigFn<T>
export function defineConfig<const T extends UserConfig>(config: T): T
export function defineConfig<const T extends UserConfig>(config: Promise<T>): Promise<T>
export function defineConfig<const T extends UserConfig>(config: UserConfigExport<T>): UserConfigExport<T>
export function defineConfig(config: UserConfigExport): UserConfigExport {
  return config
}

export type {
  WeappViteConfig,
}
