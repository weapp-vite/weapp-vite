export interface AutoImportComponentsConfig {
  vueComponents?: boolean | string
}

export interface WeappViteConfig {
  srcRoot?: string
  wevu?: {
    defaults?: {
      component?: {
        allowNullPropInput?: boolean
      }
    }
  }
  appPrelude?: boolean | {
    enabled?: boolean
    mode?: 'inline' | 'entry' | 'require'
    webRuntime?: boolean | {
      enabled?: boolean
      targets?: ('fetch' | 'Headers' | 'Request' | 'Response' | 'TextEncoder' | 'TextDecoder' | 'AbortController' | 'AbortSignal' | 'XMLHttpRequest' | 'WebSocket' | 'atob' | 'btoa' | 'queueMicrotask' | 'performance' | 'crypto' | 'Event' | 'CustomEvent')[]
      dependencies?: (string | RegExp)[]
    }
  }
  injectWebRuntimeGlobals?: boolean | {
    enabled?: boolean
    targets?: ('fetch' | 'Headers' | 'Request' | 'Response' | 'TextEncoder' | 'TextDecoder' | 'AbortController' | 'AbortSignal' | 'XMLHttpRequest' | 'WebSocket' | 'atob' | 'btoa' | 'queueMicrotask' | 'performance' | 'crypto' | 'Event' | 'CustomEvent')[]
    dependencies?: (string | RegExp)[]
    prelude?: boolean
  }
  injectRequestGlobals?: boolean | {
    enabled?: boolean
    targets?: ('fetch' | 'Headers' | 'Request' | 'Response' | 'TextEncoder' | 'TextDecoder' | 'AbortController' | 'AbortSignal' | 'XMLHttpRequest' | 'WebSocket' | 'atob' | 'btoa' | 'queueMicrotask' | 'performance' | 'crypto' | 'Event' | 'CustomEvent')[]
    dependencies?: (string | RegExp)[]
    prelude?: boolean
  }
  autoImportComponents?: boolean | AutoImportComponentsConfig
  vue?: {
    template?: {
      htmlTagToWxml?: boolean | Record<string, string>
      htmlTagToWxmlTagClass?: boolean
    }
  }
}

export interface UserConfig {
  weapp?: WeappViteConfig
  customFeature?: {
    enabled: boolean
  }
}

export interface ConfigEnv {
  command: 'build' | 'serve'
  mode: string
}

export type UserConfigFnNoEnvPlain = () => UserConfig
export type UserConfigFnNoEnv = () => UserConfig | Promise<UserConfig>
export type UserConfigFnObject = (env: ConfigEnv) => UserConfig
export type UserConfigFnPromise = (env: ConfigEnv) => Promise<UserConfig>
export type UserConfigFn = (env: ConfigEnv) => UserConfig | Promise<UserConfig>
export type UserConfigLoose = UserConfig & Record<string, any>
export type UserConfigExport
  = | UserConfigLoose
    | Promise<UserConfig>
    | UserConfigFnNoEnvPlain
    | UserConfigFnNoEnv
    | UserConfigFnObject
    | UserConfigFnPromise
    | UserConfigFn

export declare function defineConfig(config: UserConfig): UserConfig
export declare function defineConfig(config: Promise<UserConfig>): Promise<UserConfig>
export declare function defineConfig(config: UserConfigFnNoEnvPlain): UserConfigFnNoEnvPlain
export declare function defineConfig(config: UserConfigFnNoEnv): UserConfigFnNoEnv
export declare function defineConfig(config: UserConfigFnObject): UserConfigFnObject
export declare function defineConfig(config: UserConfigFn): UserConfigFn
export declare function defineConfig(config: UserConfigFnPromise): UserConfigFnPromise
export declare function defineConfig(config: UserConfigLoose): UserConfigLoose
export declare function defineConfig(config: UserConfigExport): UserConfigExport
