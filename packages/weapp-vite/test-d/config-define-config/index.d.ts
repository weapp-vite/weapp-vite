export interface AutoImportComponentsConfig {
  vueComponents?: boolean | string
  resolvers?: Array<{
    resolve?: (componentName: string, baseName: string) => {
      name: string
      from: string
      resolvedId?: string
      sourceType?: 'wevu-sfc' | 'native'
    } | void
  }>
}

export interface WeappViteConfig {
  srcRoot?: string
  platform?: 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs'
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
      slotSingleRootNoWrapper?: boolean
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
export type UserConfigExport
  = | UserConfig
    | Promise<UserConfig>
    | UserConfigFnObject
    | UserConfigFnPromise
    | UserConfigFn

export declare function defineConfig<T extends UserConfigExport>(config: T): T
