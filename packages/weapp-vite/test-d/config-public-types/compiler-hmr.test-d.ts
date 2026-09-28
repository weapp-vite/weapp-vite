import type { MultiPlatformProjectConfigs, WeappCompilerHmrAsset, WeappCompilerHmrPreparation, WeappCompilerHmrRequest, WeappCompilerPlugin } from 'weapp-vite/config'
import { expectAssignable, expectType } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

const projectConfigs = {
  weapp: { appid: 'wx-app' },
} satisfies MultiPlatformProjectConfigs

const compiler: WeappCompilerPlugin = {
  name: 'public-hmr-contract',
  capabilities: { hmr: true },
  create: () => ({
    prepareHmr(request) {
      expectType<WeappCompilerHmrRequest>(request)
      expectType<ReadonlyMap<string, string | null>>(request.sources)
      const asset: WeappCompilerHmrAsset = { fileName: 'theme.wxss', code: '.theme {}' }
      const preparation: WeappCompilerHmrPreparation = {
        assets: [asset],
        dependencies: request.changedFiles,
      }
      return preparation
    },
  }),
}

const config = defineConfig({
  weapp: {
    multiPlatform: { projectConfigs },
    compilerPlugins: [compiler],
  },
})

expectAssignable<WeappCompilerPlugin[]>(config.weapp.compilerPlugins)
