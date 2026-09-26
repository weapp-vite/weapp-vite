import type { MultiPlatformProjectConfig as ConfigProjectConfig } from 'weapp-vite/config'
import type { MpPlatform, MultiPlatformConfig, MultiPlatformProjectConfig, WeappViteConfig } from 'weapp-vite/types'
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

const common: MultiPlatformProjectConfig = {
  projectname: 'shared-app',
  setting: { urlCheck: false, es6: true },
  packOptions: { ignore: [{ type: 'folder', value: 'tests' }] },
  nativePlatformExtension: { enabled: true },
}
expectAssignable<ConfigProjectConfig>(common)
expectAssignable<MultiPlatformProjectConfig>({ appid: 'wx-app', appId: 'alipay-app' })
expectAssignable<Partial<Record<MpPlatform, MultiPlatformProjectConfig>>>({
  weapp: { ...common, appid: 'wx-app' },
  alipay: { ...common, appId: 'alipay-app' },
  tt: { appid: 'tt-app' },
  swan: { appid: 'swan-app' },
  jd: { appid: 'jd-app' },
  xhs: { ...common, appid: 'xhs-app' },
})
expectAssignable<WeappViteConfig>({ multiPlatform: { projectConfigs: { weapp: common }, targets: ['weapp'] } })
expectAssignable<MultiPlatformConfig>({ projectConfigRoot: 'config', targets: 'all' })

defineConfig(({ mode }) => {
  expectType<string>(mode)
  return {
    weapp: {
      multiPlatform: {
        projectConfigs: {
          weapp: { ...common, appid: mode === 'production' ? 'wx-prod' : 'wx-dev' },
          xhs: { ...common, appid: 'xhs-app' },
        },
      },
    },
  }
})

expectNotAssignable<MultiPlatformProjectConfig>({ appid: 123 })
expectNotAssignable<MultiPlatformProjectConfig>({ appId: 123 })
expectNotAssignable<MultiPlatformProjectConfig>({ miniprogramRoot: 'dist' })
expectNotAssignable<MultiPlatformProjectConfig>({ srcMiniprogramRoot: 'dist' })
expectNotAssignable<MultiPlatformProjectConfig>({ smartProgramRoot: 'dist' })
expectNotAssignable<MultiPlatformConfig>({ projectConfigs: { wechat: common } })
expectNotAssignable<MultiPlatformConfig>({ projectConfigs: { web: common } })
expectError<MultiPlatformConfig>({ projectConfigs: { weapp: common, unknown: common } })
expectError(defineConfig({ weapp: { multiPlatform: { projectConfigs: { swan: { smartProgramRoot: 'dist' } } } } }))
