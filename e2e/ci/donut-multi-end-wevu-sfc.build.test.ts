import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/donut-multi-end-wevu-sfc')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function readJson<T>(filePath: string) {
  return await fs.readJson(filePath) as T
}

describe.sequential('e2e app: donut-multi-end-wevu-sfc (build)', () => {
  it('builds a WeChat Donut multi-end fixture authored with wevu SFC', async () => {
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: 'ci:donut-multi-end-wevu-sfc',
      skipNpm: true,
    })

    expect(await fs.pathExists(path.join(DIST_ROOT, 'app.json'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'app.miniapp.json'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'app.js'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'app.wxss'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/index/index.wxml'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/data/index.wxml'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/form/index.wxml'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/ability/index.wxml'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/profile/index.wxml'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/status/index.wxml'))).toBe(true)

    const appJson = await readJson<{
      pages?: string[]
      componentFramework?: string
    }>(path.join(DIST_ROOT, 'app.json'))
    expect(appJson.pages).toEqual([
      'pages/index/index',
      'pages/data/index',
      'pages/form/index',
      'pages/ability/index',
      'pages/profile/index',
      'pages/status/index',
    ])
    expect(appJson.componentFramework).toBe('glass-easel')

    const projectConfig = await readJson<{
      appid?: string
      projectArchitecture?: string
      miniprogramRoot?: string
      compileType?: string
      simulatorPluginLibVersion?: Record<string, string>
    }>(path.join(APP_ROOT, 'project.config.json'))
    expect(projectConfig.appid).toBe('wxb3d842a4a7e3440d')
    expect(projectConfig.projectArchitecture).toBe('multiPlatform')
    expect(projectConfig.miniprogramRoot).toBe('dist')
    expect(projectConfig.compileType).toBe('miniprogram')
    expect(projectConfig.simulatorPluginLibVersion?.wxext14566970e7e9f62).toBe('3.6.5-26')

    const miniappConfig = await readJson<{
      'miniVersion'?: string
      'name'?: string
      'version'?: string
      'versionCode'?: number
      'i18nFilePath'?: string
      'mini-android'?: {
        resourcePath?: string
        sdkVersion?: string
        toolkitVersion?: string
        enableVConsole?: string
      }
      'mini-ios'?: {
        sdkVersion?: string
        toolkitVersion?: string
        enableOpenUrlNavigate?: boolean
      }
      'mini-ohos'?: {
        sdkVersion?: string
      }
    }>(path.join(APP_ROOT, 'project.miniapp.json'))
    expect(miniappConfig.miniVersion).toBe('v2')
    expect(miniappConfig.name).toBe('Weapp Vite Wevu 多端 E2E')
    expect(miniappConfig.version).toBe('0.0.1')
    expect(miniappConfig.versionCode).toBe(1)
    expect(miniappConfig.i18nFilePath).toBe('i18n')
    expect(miniappConfig['mini-ohos']?.sdkVersion).toBe('0.5.4')
    expect(miniappConfig['mini-android']?.resourcePath).toBe('miniapp/android/nativeResources')
    expect(miniappConfig['mini-android']?.sdkVersion).toBe('1.5.2')
    expect(miniappConfig['mini-android']?.toolkitVersion).toBe('0.11.0')
    expect(miniappConfig['mini-android']?.enableVConsole).toBe('open')
    expect(miniappConfig['mini-ios']?.sdkVersion).toBe('1.6.8')
    expect(miniappConfig['mini-ios']?.toolkitVersion).toBe('0.0.9')
    expect(miniappConfig['mini-ios']?.enableOpenUrlNavigate).toBe(true)

    const sourceRuntimeMiniappConfig = await readJson<{
      adapteByMiniprogram?: {
        userName?: string
      }
      identityServiceConfig?: {
        authorizeMiniprogramType?: number
        miniprogramLoginPath?: string
        adaptWxLogin?: boolean
      }
    }>(path.join(APP_ROOT, 'src/app.miniapp.json'))
    expect(sourceRuntimeMiniappConfig.identityServiceConfig?.authorizeMiniprogramType).toBe(1)
    expect(sourceRuntimeMiniappConfig.identityServiceConfig?.miniprogramLoginPath).toBe('__default__')
    expect(sourceRuntimeMiniappConfig.identityServiceConfig?.adaptWxLogin).toBe(true)

    const runtimeMiniappConfig = await readJson<typeof sourceRuntimeMiniappConfig>(path.join(DIST_ROOT, 'app.miniapp.json'))
    expect(runtimeMiniappConfig).toEqual(sourceRuntimeMiniappConfig)

    const indexWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/index/index.wxml'), 'utf8')
    const indexJs = await fs.readFile(path.join(DIST_ROOT, 'pages/index/index.js'), 'utf8')
    expect(indexWxml).toContain('E2E State')
    expect(indexWxml).toContain('class="action"')
    expect(indexWxml).toContain('bindtap="__weapp_vite_inline"')
    expect(indexWxml).toContain('data-wi-tap=')
    expect(indexWxml).toContain('wx:for="{{cards}}"')
    expect(indexWxml).toContain('t-notice-bar')
    expect(indexWxml).toContain('t-grid')
    expect(indexJs).toContain('donut-multi-end-wevu-sfc')
    expect(indexJs).toContain('recordTap')
    expect(indexJs).toContain('/pages/profile/index?from=index')
    expect(indexJs).toContain('/pages/status/index')

    const indexJson = await readJson<{
      usingComponents?: Record<string, string>
    }>(path.join(DIST_ROOT, 'pages/index/index.json'))
    expect(indexJson.usingComponents?.['t-grid']).toContain('tdesign-miniprogram/grid/grid')
    expect(indexJson.usingComponents?.['t-notice-bar']).toContain('tdesign-miniprogram/notice-bar/notice-bar')

    const dataWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/data/index.wxml'), 'utf8')
    const formWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/form/index.wxml'), 'utf8')
    const abilityWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/ability/index.wxml'), 'utf8')
    expect(dataWxml).toContain('数据总线')
    expect(dataWxml).toContain('t-tabs')
    expect(formWxml).toContain('巡检表单')
    expect(formWxml).toContain('t-stepper')
    expect(abilityWxml).toContain('能力矩阵')
    expect(abilityWxml).toContain('t-empty')
  })
})
