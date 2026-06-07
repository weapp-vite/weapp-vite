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
    expect(await fs.pathExists(path.join(DIST_ROOT, 'app.js'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'app.wxss'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/index/index.wxml'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/profile/index.wxml'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/status/index.wxml'))).toBe(true)

    const appJson = await readJson<{
      pages?: string[]
      componentFramework?: string
    }>(path.join(DIST_ROOT, 'app.json'))
    expect(appJson.pages).toEqual([
      'pages/index/index',
      'pages/profile/index',
      'pages/status/index',
    ])
    expect(appJson.componentFramework).toBe('glass-easel')

    const projectConfig = await readJson<{
      projectArchitecture?: string
      miniprogramRoot?: string
    }>(path.join(APP_ROOT, 'project.config.json'))
    expect(projectConfig.projectArchitecture).toBe('multiPlatform')
    expect(projectConfig.miniprogramRoot).toBe('dist')

    const miniappConfig = await readJson<{
      'miniVersion'?: string
      'name'?: string
      'i18nFilePath'?: string
      'mini-android'?: {
        resourcePath?: string
      }
      'mini-ios'?: {
        enableOpenUrlNavigate?: boolean
      }
    }>(path.join(APP_ROOT, 'project.miniapp.json'))
    expect(miniappConfig.miniVersion).toBe('v2')
    expect(miniappConfig.name).toBe('Weapp Vite Wevu 多端 E2E')
    expect(miniappConfig.i18nFilePath).toBe('i18n')
    expect(miniappConfig['mini-android']?.resourcePath).toBe('miniapp/android/nativeResources')
    expect(miniappConfig['mini-ios']?.enableOpenUrlNavigate).toBe(true)

    const indexWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/index/index.wxml'), 'utf8')
    const indexJs = await fs.readFile(path.join(DIST_ROOT, 'pages/index/index.js'), 'utf8')
    expect(indexWxml).toContain('E2E State')
    expect(indexWxml).toContain('class="action"')
    expect(indexWxml).toContain('bindtap="__weapp_vite_inline"')
    expect(indexWxml).toContain('data-wi-tap=')
    expect(indexWxml).toContain('wx:for="{{cards}}"')
    expect(indexJs).toContain('donut-multi-end-wevu-sfc')
    expect(indexJs).toContain('recordTap')
    expect(indexJs).toContain('/pages/profile/index?from=index')
    expect(indexJs).toContain('/pages/status/index')
  })
})
