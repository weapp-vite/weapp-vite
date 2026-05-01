import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { findWevuVendorChunkContaining } from '../utils/wevu-vendor'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/plugin-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const PLUGIN_DIST_ROOT = path.join(APP_ROOT, 'dist-plugin')

describe.sequential('plugin-demo build e2e', () => {
  afterAll(async () => {
    await fs.remove(DIST_ROOT)
    await fs.remove(PLUGIN_DIST_ROOT)
  })

  it('emits plugin npm dependencies into the isolated plugin output', async () => {
    await fs.remove(DIST_ROOT)
    await fs.remove(PLUGIN_DIST_ROOT)

    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      label: 'ci:plugin-demo-build',
    })

    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'miniprogram_npm/dayjs/index.js'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'miniprogram_npm/lodash/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'pages/native-playground/index.js'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'pages/native-playground/index.wxml'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'components/native-meter/index.js'))).toBe(true)

    const pluginVendor = await findWevuVendorChunkContaining(PLUGIN_DIST_ROOT, [
      'miniprogram_npm/dayjs/index',
      'npm(dayjs) 构建标记',
    ])
    expect(pluginVendor.code).toContain('dayjs')
    expect(pluginVendor.code).toContain('2026-03-19T12:34:00')
    expect(pluginVendor.code).toContain('npm(dayjs) 构建标记')
  })
})
