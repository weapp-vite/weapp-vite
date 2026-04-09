import type { UserConfig } from '.'
import { expectError, expectType } from 'tsd'
import { defineConfig } from '.'

const objectConfig = defineConfig({
  weapp: {
    srcRoot: 'src',
    appPrelude: {
      mode: 'entry',
    },
    injectRequestGlobals: {
      enabled: true,
      prelude: true,
    },
    vue: {
      template: {
        htmlTagToWxml: {
          div: 'view',
        },
      },
    },
    autoImportComponents: {
      vueComponents: true,
    },
  },
})
expectType<string | undefined>(objectConfig.weapp?.srcRoot)
expectType<boolean | {
  enabled?: boolean
  mode?: 'inline' | 'entry' | 'require'
} | undefined>(objectConfig.weapp?.appPrelude)
expectType<boolean | {
  enabled?: boolean
  targets?: ('fetch' | 'Headers' | 'Request' | 'Response' | 'AbortController' | 'AbortSignal' | 'XMLHttpRequest' | 'WebSocket')[]
  dependencies?: (string | RegExp)[]
  prelude?: boolean
} | undefined>(objectConfig.weapp?.injectRequestGlobals)
expectType<boolean | Record<string, string> | undefined>(objectConfig.weapp?.vue?.template?.htmlTagToWxml)

const promiseConfig = defineConfig(Promise.resolve({
  weapp: {
    srcRoot: 'src',
  },
}))
expectType<Promise<UserConfig>>(promiseConfig)

const syncNoEnvConfig = defineConfig(() => ({
  weapp: {
    srcRoot: 'src',
    autoImportComponents: {
      vueComponents: true,
    },
  },
}))
const syncNoEnvResolved = syncNoEnvConfig()
expectType<string | undefined>(syncNoEnvResolved.weapp?.srcRoot)
expectError(syncNoEnvResolved.then(() => {}))

const syncNoEnvVueComponents = syncNoEnvResolved.weapp?.autoImportComponents
  && typeof syncNoEnvResolved.weapp.autoImportComponents === 'object'
  ? syncNoEnvResolved.weapp.autoImportComponents.vueComponents
  : undefined
expectType<boolean | string | undefined>(syncNoEnvVueComponents)

const asyncNoEnvConfig = defineConfig(async () => ({
  weapp: {
    srcRoot: 'src',
  },
}))
expectType<UserConfig | Promise<UserConfig>>(asyncNoEnvConfig())

const promiseNoEnvConfig = defineConfig(() => Promise.resolve({
  weapp: {
    srcRoot: 'src',
  },
}))
expectType<UserConfig | Promise<UserConfig>>(promiseNoEnvConfig())

const looseConfig = defineConfig({
  customFeature: {
    enabled: true,
  },
  weapp: {
    srcRoot: 'src',
  },
})
expectType<{ enabled: boolean } | undefined>(looseConfig.customFeature)
expectType<string | undefined>(looseConfig.weapp?.srcRoot)
