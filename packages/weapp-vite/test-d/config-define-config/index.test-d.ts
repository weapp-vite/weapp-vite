import type { UserConfig } from '.'
import { expectAssignable, expectError } from 'tsd'
import { defineConfig } from '.'

const objectConfig = defineConfig({
  weapp: {
    srcRoot: 'src',
    wevu: {
      defaults: {
        component: {
          allowNullPropInput: false,
        },
      },
    },
    appPrelude: {
      mode: 'entry',
      webRuntime: true,
    },
    injectWebRuntimeGlobals: {
      enabled: true,
      prelude: true,
    },
    vue: {
      template: {
        htmlTagToWxml: {
          div: 'view',
        },
        htmlTagToWxmlTagClass: false,
        slotSingleRootNoWrapper: true,
      },
    },
    autoImportComponents: {
      vueComponents: true,
      resolvers: [
        {
          resolve(componentName) {
            return {
              name: componentName,
              from: '/components/issue-520/ResolverSlotCard/index',
              sourceType: 'wevu-sfc',
            }
          },
        },
      ],
    },
  },
})
expectAssignable<string | undefined>(objectConfig.weapp?.srcRoot)
expectAssignable<boolean | undefined>(objectConfig.weapp?.wevu?.defaults?.component?.allowNullPropInput)
expectAssignable<boolean | {
  enabled?: boolean
  mode?: 'inline' | 'entry' | 'require'
  webRuntime?: boolean | {
    enabled?: boolean
    targets?: ('fetch' | 'Headers' | 'Request' | 'Response' | 'TextEncoder' | 'TextDecoder' | 'AbortController' | 'AbortSignal' | 'XMLHttpRequest' | 'WebSocket' | 'atob' | 'btoa' | 'queueMicrotask' | 'performance' | 'crypto' | 'Event' | 'CustomEvent')[]
    dependencies?: (string | RegExp)[]
  }
} | undefined>(objectConfig.weapp?.appPrelude)
expectAssignable<boolean | {
  enabled?: boolean
  targets?: ('fetch' | 'Headers' | 'Request' | 'Response' | 'TextEncoder' | 'TextDecoder' | 'AbortController' | 'AbortSignal' | 'XMLHttpRequest' | 'WebSocket' | 'atob' | 'btoa' | 'queueMicrotask' | 'performance' | 'crypto' | 'Event' | 'CustomEvent')[]
  dependencies?: (string | RegExp)[]
  prelude?: boolean
} | undefined>(objectConfig.weapp?.injectWebRuntimeGlobals)
expectAssignable<boolean | Record<string, string> | undefined>(objectConfig.weapp?.vue?.template?.htmlTagToWxml)
expectAssignable<boolean | undefined>(objectConfig.weapp?.vue?.template?.htmlTagToWxmlTagClass)
expectAssignable<boolean | undefined>(objectConfig.weapp?.vue?.template?.slotSingleRootNoWrapper)

const promiseConfig = defineConfig(Promise.resolve({
  weapp: {
    srcRoot: 'src',
  },
}))
expectAssignable<Promise<UserConfig>>(promiseConfig)

const syncNoEnvConfig = defineConfig(() => ({
  weapp: {
    srcRoot: 'src',
    platform: 'alipay',
    autoImportComponents: {
      vueComponents: true,
    },
  },
}))
const syncNoEnvResolved = syncNoEnvConfig()
expectAssignable<string | undefined>(syncNoEnvResolved.weapp?.srcRoot)
expectAssignable<'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs' | undefined>(syncNoEnvResolved.weapp?.platform)
expectError(syncNoEnvResolved.then(() => {}))

const syncNoEnvVueComponents = syncNoEnvResolved.weapp?.autoImportComponents
  && typeof syncNoEnvResolved.weapp.autoImportComponents === 'object'
  ? syncNoEnvResolved.weapp.autoImportComponents.vueComponents
  : undefined
expectAssignable<boolean | string | undefined>(syncNoEnvVueComponents)

const objectConfigResolvers = objectConfig.weapp?.autoImportComponents
  && typeof objectConfig.weapp.autoImportComponents === 'object'
  ? objectConfig.weapp.autoImportComponents.resolvers
  : undefined
expectAssignable<Array<{
  resolve?: (componentName: string, baseName: string) => {
    name: string
    from: string
    resolvedId?: string
    sourceType?: 'wevu-sfc' | 'native'
  } | void
}> | undefined>(objectConfigResolvers)

const asyncNoEnvConfig = defineConfig(async () => ({
  weapp: {
    srcRoot: 'src',
  },
}))
expectAssignable<UserConfig | Promise<UserConfig>>(asyncNoEnvConfig())

const promiseNoEnvConfig = defineConfig(() => Promise.resolve({
  weapp: {
    srcRoot: 'src',
  },
}))
expectAssignable<UserConfig | Promise<UserConfig>>(promiseNoEnvConfig())

const envConfig = defineConfig(({ mode }) => ({
  weapp: {
    srcRoot: mode,
  },
}))
expectAssignable<string | undefined>(envConfig({ command: 'build', mode: 'production' }).weapp?.srcRoot)

const looseConfig = defineConfig({
  customFeature: {
    enabled: true,
  },
  weapp: {
    srcRoot: 'src',
  },
})
expectAssignable<{ enabled: boolean } | undefined>(looseConfig.customFeature)
expectAssignable<string | undefined>(looseConfig.weapp?.srcRoot)
