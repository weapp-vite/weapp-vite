import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { waitForFile } from '../wevu-runtime.utils'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SOURCE_ROOT = path.join(ROOT, 'apps/vite-native-skyline')
const APP_ROOT = path.join(ROOT, '.tmp/e2e/skyline-hmr-fallback')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const PRIVATE_CONFIG_PATH = path.join(APP_ROOT, 'project.private.config.json')
const SOURCE_WXML_PATH = path.join(APP_ROOT, 'pages/index/index.wxml')
const DIST_WXML_PATH = path.join(APP_ROOT, 'dist/pages/index/index.wxml')
const STATEFUL_CONTROL_PATH = path.join(APP_ROOT, 'dist/__weapp_vite_hmr/control.js')
const COPY_EXCLUDED_ROOTS = new Set(['.weapp-vite', 'dist', 'node_modules'])

async function waitForHotReloadDisabled(timeoutMs = 30_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const config = await fs.readJson(PRIVATE_CONFIG_PATH).catch(() => undefined) as {
      setting?: { compileHotReLoad?: unknown }
    } | undefined
    if (config?.setting?.compileHotReLoad === false) {
      return config
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Timed out waiting for Skyline hot reload fallback config update.')
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
  await fs.remove(APP_ROOT)
  await fs.copy(SOURCE_ROOT, APP_ROOT, {
    filter: (source) => {
      const relativePath = path.relative(SOURCE_ROOT, source)
      const [rootSegment] = relativePath.split(path.sep)
      return !rootSegment || !COPY_EXCLUDED_ROOTS.has(rootSegment)
    },
  })
  await Promise.all([
    fs.writeFile(path.join(APP_ROOT, 'vite.config.ts'), [
      'import { defineConfig } from \'weapp-vite/config\'',
      '',
      'export default defineConfig({})',
      '',
    ].join('\n'), 'utf8'),
    fs.writeFile(path.join(APP_ROOT, 'app.wxss'), '@import "./common.wxss";\n', 'utf8'),
    fs.remove(path.join(APP_ROOT, 'postcss.config.js')),
    fs.remove(path.join(APP_ROOT, 'tailwind.config.js')),
  ])
  const privateConfig = await fs.readJson(PRIVATE_CONFIG_PATH) as Record<string, any>
  privateConfig.setting = {
    ...(privateConfig.setting ?? {}),
    compileHotReLoad: true,
  }
  await fs.writeJson(PRIVATE_CONFIG_PATH, privateConfig, { spaces: 2 })
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
  await fs.remove(APP_ROOT)
})

describe.sequential('Skyline HMR compatibility fallback', () => {
  it('disables DevTools hot reload and keeps classic rebuilds working', async () => {
    const originalSource = await fs.readFile(SOURCE_WXML_PATH, 'utf8')
    const marker = createHmrMarker('SKYLINE', 'CLASSIC-FALLBACK')
    const updatedSource = originalSource.replace('111', marker)
    const dev = startDevProcess(process.execPath, [
      CLI_PATH,
      'dev',
      APP_ROOT,
      '--platform',
      'weapp',
      '--skipNpm',
    ], {
      all: true,
      cwd: APP_ROOT,
      env: createDevProcessEnv(),
      reject: false,
    })

    try {
      const output = await dev.waitForOutput(
        '暂不支持 Skyline 热重载',
        'Skyline compatibility warning',
      )
      expect(output).toContain('并降级为 classic')
      expect(output).toContain('developers.weixin.qq.com')
      await dev.waitFor(waitForHotReloadDisabled(), 'project private config hot reload fallback')
      const privateConfig = await fs.readJson(PRIVATE_CONFIG_PATH) as Record<string, any>
      expect(privateConfig.setting).toMatchObject({
        compileHotReLoad: false,
        skylineRenderEnable: true,
        urlCheck: false,
      })
      await dev.waitFor(waitForFile(path.join(APP_ROOT, 'dist/app.json')), 'Skyline classic initial output')
      expect(await fs.pathExists(STATEFUL_CONTROL_PATH)).toBe(false)

      await replaceFileByRename(SOURCE_WXML_PATH, updatedSource)
      await dev.waitFor(
        waitForFileContains(DIST_WXML_PATH, marker),
        'Skyline classic rebuilt page output',
      )
    }
    finally {
      await dev.stop(5_000)
    }
  })
})
