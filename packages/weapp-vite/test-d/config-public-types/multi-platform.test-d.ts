import type { MultiPlatformProjectConfig as ConfigProjectConfig, MultiPlatformProjectConfigs as ConfigProjectConfigs } from 'weapp-vite/config'
import type { MpPlatform, MultiPlatformConfig, MultiPlatformProjectConfig, MultiPlatformProjectConfigs, WeappViteConfig } from 'weapp-vite/types'
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
const projects = {
  weapp: { ...common, appid: 'wx-app', setting: { es6: false, useCompilerPlugins: false, nativeExtension: true } },
  alipay: { ...common, appId: 'alipay-app', format: 2, compileOptions: { typescript: false, resolveAlias: { '@': './src' } } },
  tt: { appid: 'tt-app', setting: { compileHotReLoad: true, useCompilerPlugins: ['typescript'] }, packOptions: { ignore: [{ type: 'glob', value: '**/*.test.js' }] } },
  swan: { 'appid': 'swan-app', 'developType': 'normal', 'compilation-args': { common: { ignoreTransJs: true } } },
  jd: { appid: 'jd-app', nativePlatformExtension: { enabled: true } },
  xhs: { ...common, appid: 'xhs-app', setting: { minified: false, urlCheck: true } },
} satisfies MultiPlatformProjectConfigs
expectAssignable<ConfigProjectConfigs>(projects)
expectType<MpPlatform>({} as keyof MultiPlatformProjectConfigs)

const inferredCommon = {
  projectname: 'shared-app',
  compileType: 'miniprogram',
  setting: { urlCheck: false },
  packOptions: { ignore: [{ type: 'folder', value: 'tests' }] },
}
expectAssignable<MultiPlatformProjectConfigs>({
  weapp: { ...inferredCommon, appid: 'wx-app' },
  tt: { ...inferredCommon, appid: 'tt-app' },
  xhs: { ...inferredCommon, appid: 'xhs-app' },
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
expectError({ weapp: common, unknown: common } satisfies MultiPlatformProjectConfigs)
expectError(defineConfig({ weapp: { multiPlatform: { projectConfigs: { swan: { smartProgramRoot: 'dist' } } } } }))

declare const nativeConfigs: MultiPlatformProjectConfigs
expectType<boolean | undefined>(nativeConfigs.weapp?.setting?.es6)
expectType<boolean | undefined>(nativeConfigs.alipay?.compileOptions?.typescript)
expectType<string | undefined>(nativeConfigs.alipay?.compileOptions?.resolveAlias?.['@'])
expectType<string[] | undefined>(nativeConfigs.tt?.setting?.useCompilerPlugins)
expectType<boolean | undefined>(nativeConfigs.xhs?.setting?.minified)
expectType<boolean | undefined>(nativeConfigs.swan?.['compilation-args']?.common?.ignoreTransJs)
expectType<unknown>(nativeConfigs.jd?.nativePlatformExtension)

expectNotAssignable<MultiPlatformProjectConfigs>({ weapp: { setting: { es6: 'false' } } })
expectNotAssignable<MultiPlatformProjectConfigs>({ weapp: { packOptions: { ignore: [{ type: 'folder', value: 1 }] } } })
expectNotAssignable<MultiPlatformProjectConfigs>({ alipay: { compileOptions: { typescript: 'false' } } })
expectNotAssignable<MultiPlatformProjectConfigs>({ alipay: { developOptions: { hotReload: 'true' } } })
expectNotAssignable<MultiPlatformProjectConfigs>({ tt: { setting: { useCompilerPlugins: false } } })
expectNotAssignable<MultiPlatformProjectConfigs>({ xhs: { setting: { minified: 'false' } } })
expectNotAssignable<MultiPlatformProjectConfigs>({ swan: { 'compilation-args': { common: { ignoreTransJs: 'true' } } } })
expectError(defineConfig({ weapp: { multiPlatform: { projectConfigs: { alipay: { compileOptions: { typescript: 'false' } } } } } }))

const futureOption = { revision: 1, flags: ['new-native-feature'] }
const futureConfigs = {
  weapp: {
    futureOption,
    compileType: 'future-project-type',
    libVersion: 'future-base-library',
    setting: { futureOption, babelSetting: { futureOption } },
    packOptions: { futureOption, ignore: [{ type: 'future-rule', value: 'src', futureOption }, { futurePattern: 'src/**' }] },
  },
  alipay: {
    futureOption,
    compileType: 'future-project-type',
    compileOptions: {
      futureOption,
      globalObjectMode: 'future-global-mode',
      transpile: { futureOption, script: { futureOption } },
    },
    developOptions: { futureOption },
    scripts: { futureOption },
  },
  tt: {
    futureOption,
    setting: { futureOption, useCompilerPlugins: ['future-compiler'] },
    packOptions: { futureOption, include: [{ type: 'future-rule', value: 'src', futureOption }, { futurePattern: 'src/**' }] },
  },
  xhs: {
    futureOption,
    compileType: 'future-project-type',
    setting: { futureOption },
  },
  jd: {
    futureOption,
    setting: { futureOption },
  },
  swan: {
    futureOption,
    'developType': 'future-develop-type',
    'setting': { futureOption },
    'compilation-args': { futureOption, common: { futureOption } },
  },
} satisfies MultiPlatformProjectConfigs

expectAssignable<ConfigProjectConfigs>(futureConfigs)
expectType<number>(futureConfigs.weapp.setting.babelSetting.futureOption.revision)
defineConfig({ weapp: { multiPlatform: { projectConfigs: futureConfigs } } })
