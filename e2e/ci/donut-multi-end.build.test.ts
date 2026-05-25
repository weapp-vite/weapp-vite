import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/donut-multi-end')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function readJson<T>(filePath: string) {
  return await fs.readJson(filePath) as T
}

describe.sequential('e2e app: donut-multi-end (build)', () => {
  it('builds a WeChat Donut multi-end miniprogram fixture', async () => {
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: 'ci:donut-multi-end',
      skipNpm: true,
    })

    expect(await fs.pathExists(path.join(DIST_ROOT, 'app.json'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/index/index.wxml'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/profile/index.wxml'))).toBe(true)

    const projectConfig = await readJson<{
      appid?: string
      projectArchitecture?: string
      miniprogramRoot?: string
    }>(path.join(APP_ROOT, 'project.config.json'))
    expect(projectConfig.appid).toBe('wxb3d842a4a7e3440d')
    expect(projectConfig.projectArchitecture).toBe('multiPlatform')
    expect(projectConfig.miniprogramRoot).toBe('dist')

    const miniappConfig = await readJson<{
      'miniVersion'?: string
      'name'?: string
      'version'?: string
      'versionCode'?: number
      'i18nFilePath'?: string
      'mini-android'?: {
        resourcePath?: string
        enableVConsole?: string
      }
      'mini-ios'?: {
        enableOpenUrlNavigate?: boolean
      }
    }>(path.join(APP_ROOT, 'project.miniapp.json'))
    expect(miniappConfig.miniVersion).toBe('v2')
    expect(miniappConfig.name).toBe('Weapp Vite 多端 E2E')
    expect(miniappConfig.version).toBe('0.0.1')
    expect(miniappConfig.versionCode).toBe(1)
    expect(miniappConfig.i18nFilePath).toBe('i18n')
    expect(miniappConfig['mini-android']?.resourcePath).toBe('miniapp/android/nativeResources')
    expect(miniappConfig['mini-android']?.enableVConsole).toBe('open')
    expect(miniappConfig['mini-ios']?.enableOpenUrlNavigate).toBe(true)
  })
})
