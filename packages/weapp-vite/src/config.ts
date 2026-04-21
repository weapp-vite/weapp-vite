// 参考：https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/node/types/vite.ts
// 参考：https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/public/config.ts
import type { ConfigEnv, UserConfig as ViteUserConfig } from 'vite'
import type { WeappViteConfig } from './types'

export * from './json'
export * from './pluginHost'

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

export type UserConfigExport<T extends UserConfig = UserConfig>
  = | T
    | Promise<T>
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
 * @description 注意：这里不能继续使用对象/Promise/函数的多重重载；
 * @description 否则 `() => ({})` 这类函数式配置里的对象字面量会丢失上下文类型，
 * @description 导致 `platform` 等联合字面量字段被宽化为 `string`。
 */
export function defineConfig<T extends UserConfigExport>(config: T): T
export function defineConfig(config: UserConfigExport): UserConfigExport {
  return config
}

export type {
  WeappViteConfig,
}
