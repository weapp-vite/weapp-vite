import type { UserConfig } from 'weapp-vite/config'
import { expectError, expectType } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

const objectConfig = defineConfig({
  weapp: {
    srcRoot: 'src',
    autoImportComponents: {
      vueComponents: true,
    },
  },
})
expectType<string | undefined>(objectConfig.weapp?.srcRoot)

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

const syncEnvConfig = defineConfig((env) => {
  expectType<'build' | 'serve'>(env.command)
  expectType<string>(env.mode)

  return {
    weapp: {
      srcRoot: env.command === 'build' ? 'build-src' : 'serve-src',
    },
  }
})
expectType<UserConfig>(syncEnvConfig({ command: 'build', mode: 'production' }))

const asyncEnvConfig = defineConfig(async (env) => {
  expectType<'build' | 'serve'>(env.command)
  expectType<string>(env.mode)

  return {
    weapp: {
      srcRoot: env.mode,
    },
  }
})
expectType<Promise<UserConfig>>(asyncEnvConfig({ command: 'serve', mode: 'development' }))

const unionEnvConfig = defineConfig((env) => {
  if (env.command === 'build') {
    return Promise.resolve({
      weapp: {
        srcRoot: 'build-src',
      },
    })
  }

  return {
    weapp: {
      srcRoot: 'serve-src',
    },
  }
})
expectType<UserConfig | Promise<UserConfig>>(unionEnvConfig({ command: 'build', mode: 'production' }))

const looseConfig = defineConfig({
  customFeature: {
    enabled: true,
  },
  weapp: {
    srcRoot: 'src',
  },
})
expectType<any>(looseConfig.customFeature)
expectType<string | undefined>(looseConfig.weapp?.srcRoot)

expectError(defineConfig({
  weapp: {
    srcRoot: 1,
  },
}))

expectError(defineConfig(() => ({
  weapp: {
    srcRootTypo: 'src',
  },
})))

expectError(defineConfig(() => ({
  weapp: {
    autoImportComponents: {
      vueComponents: 123,
    },
  },
})))
