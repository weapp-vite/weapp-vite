import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fs } from '@weapp-core/shared/node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDevBuildCompletion } from '../utils/devBuildCompletion'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'
import { captureNativePublication } from '../utils/nativePublication'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SOURCE_ROOT = path.join(ROOT, 'apps/vite-native-skyline')
const APP_ROOT = path.join(ROOT, '.tmp/e2e/skyline-hmr-fallback')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const PRIVATE_CONFIG_PATH = path.join(APP_ROOT, 'project.private.config.json')
const SOURCE_WXML_PATH = path.join(APP_ROOT, 'pages/index/index.wxml')
const DIST_WXML_PATH = path.join(APP_ROOT, 'dist/pages/index/index.wxml')
const PROFILE_PATH = path.join(APP_ROOT, '.tmp/hmr-profile.jsonl')
const COPY_EXCLUDED_ROOTS = new Set(['.weapp-vite', 'dist', 'node_modules'])

interface PrivateConfig {
  setting?: Record<string, unknown>
  [key: string]: unknown
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
      `import { nativePublicationPlugin } from ${JSON.stringify(pathToFileURL(path.join(ROOT, 'e2e/utils/nativePublication/plugin.ts')).href)}`,
      '',
      'export default defineConfig({',
      '  plugins: [nativePublicationPlugin({ sourceRoot: \'pages\', profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })],',
      '})',
      '',
    ].join('\n'), 'utf8'),
    fs.writeFile(path.join(APP_ROOT, 'app.js'), 'App({})\n', 'utf8'),
    fs.remove(path.join(APP_ROOT, 'tailwind.css')),
    fs.writeFile(path.join(APP_ROOT, 'app.wxss'), '@import "./common.wxss";\n', 'utf8'),
    fs.remove(path.join(APP_ROOT, 'postcss.config.js')),
    fs.remove(path.join(APP_ROOT, 'tailwind.config.js')),
  ])
  const privateConfig = await fs.readJson(PRIVATE_CONFIG_PATH) as PrivateConfig
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

describe('Skyline HMR compatibility fallback', { concurrent: false }, () => {
  it('preserves the DevTools hot reload choice and publishes classic updates and restoration', async () => {
    const originalSource = await fs.readFile(SOURCE_WXML_PATH, 'utf8')
    const originalPrivateConfig = await fs.readFile(PRIVATE_CONFIG_PATH, 'utf8')
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
      env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: PROFILE_PATH },
      reject: false,
    })
    const initialPublication = captureNativePublication(dev, APP_ROOT, { sourceRoot: 'pages' })
    const publication = createNativeHmrPublication(APP_ROOT, dev, 'stateful-experimental', ['skyline'], PROFILE_PATH)

    async function assertClassic() {
      await publication.assertClassicOutput()
      const privateConfig = await fs.readJson(PRIVATE_CONFIG_PATH) as PrivateConfig
      expect(privateConfig.setting).toMatchObject({
        compileHotReLoad: true,
        skylineRenderEnable: true,
        urlCheck: false,
      })
      expect(await fs.readFile(PRIVATE_CONFIG_PATH, 'utf8')).toBe(originalPrivateConfig)
      expect(dev.getBuildErrors()).toEqual([])
    }

    try {
      await dev.waitForOutput('[weapp-vite] HMR classic ready ', 'Skyline startup classic readiness')
      await initialPublication.wait(90_000)
      await assertClassic()
      const app = await fs.readJson(path.join(APP_ROOT, 'dist/app.json')) as { pages?: string[], renderer?: string, componentFramework?: string }
      expect(app).toMatchObject({
        pages: ['pages/index/index'],
        renderer: 'skyline',
        componentFramework: 'glass-easel',
      })
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await fs.pathExists(path.join(APP_ROOT, `dist/pages/index/index.${extension}`))).toBe(true)
      }
      const initialOutput = await dev.waitFor(waitForFileContains(DIST_WXML_PATH, '111'), 'Skyline initial classic page')

      for (const marker of [createHmrMarker('SKYLINE', 'CLASSIC-A'), createHmrMarker('SKYLINE', 'CLASSIC-B'), '111']) {
        const nextSource = marker === '111' ? originalSource : originalSource.replace('111', marker)
        expect(nextSource).toContain(marker)
        const write = captureNativePublication(dev, APP_ROOT, { sourceRoot: 'pages' })
        const completion = createDevBuildCompletion(dev, { source: { file: SOURCE_WXML_PATH, profilePath: PROFILE_PATH } })
        await replaceFileByRename(SOURCE_WXML_PATH, nextSource)
        const receipt = await write.wait(90_000)
        if (!receipt.profileCursor) {
          throw new Error('Skyline classic write is missing its native profile cursor')
        }
        await completion.wait(90_000, receipt.profileCursor)
        await dev.waitFor(waitForFileContains(DIST_WXML_PATH, marker), `Skyline classic ${marker} output`)
        await assertClassic()
      }
      expect(await fs.readFile(SOURCE_WXML_PATH, 'utf8')).toBe(originalSource)
      expect(await fs.readFile(DIST_WXML_PATH, 'utf8')).toBe(initialOutput)
    }
    finally {
      await dev.stop(5_000)
    }
    expect(await fs.readFile(PRIVATE_CONFIG_PATH, 'utf8')).toBe(originalPrivateConfig)
  })
})
