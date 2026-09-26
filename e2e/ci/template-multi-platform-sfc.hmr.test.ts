import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { findMissingWevuVendorExports, findWevuVendorChunk } from '../utils/wevu-vendor'
import { waitForFile } from '../wevu-runtime.utils'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-multi-platform-sfc-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist/tt/dist')
const PAGE_SOURCE_PATH = path.join(TEMPLATE_ROOT, 'src/pages/index/index.vue')
const APP_SOURCE_PATH = path.join(TEMPLATE_ROOT, 'src/app.vue')
const REQUIRE_REQUEST_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function replaceSource(source: string, original: string, replacement: string) {
  if (!source.includes(original)) {
    throw new Error(`Failed to find template source to replace: ${original}`)
  }
  return source.replace(original, replacement)
}

async function expectVendorExportsIntact() {
  const runtimeChunk = await findWevuVendorChunk(
    DIST_ROOT,
    code => code.includes('__wevu_runtime') && code.includes('__wevu_options'),
    'TT SFC runtime',
  )
  const reactivityChunk = await findWevuVendorChunk(
    DIST_ROOT,
    code => code.includes('__wevuCurrentSetupState__'),
    'TT SFC reactivity',
  )

  // 开发产物必须实际覆盖 runtime 到 reactivity 的跨 vendor 依赖。
  expect(runtimeChunk.path).not.toBe(reactivityChunk.path)
  const importsReactivity = [...runtimeChunk.code.matchAll(REQUIRE_REQUEST_RE)].some(([, request]) =>
    request && path.resolve(path.dirname(runtimeChunk.path), request) === reactivityChunk.path,
  )
  expect(importsReactivity).toBe(true)
  expect(
    await findMissingWevuVendorExports(DIST_ROOT),
    'TT entry and vendor imports must resolve to exported members',
  ).toEqual([])
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe('multi-platform SFC template TT classic HMR', { concurrent: false }, () => {
  it('preserves vendor exports on initial build and template, page script and app script updates', async () => {
    const originalPageSource = await fs.readFile(PAGE_SOURCE_PATH, 'utf8')
    const originalAppSource = await fs.readFile(APP_SOURCE_PATH, 'utf8')
    await fs.remove(path.join(TEMPLATE_ROOT, 'dist/tt'))

    const dev = startDevProcess(process.execPath, [CLI_PATH, 'dev', TEMPLATE_ROOT, '--platform', 'tt', '--skipNpm'], {
      cwd: TEMPLATE_ROOT,
      env: createDevProcessEnv(),
      all: true,
    })

    try {
      await dev.waitForInitialBuild()
      expect(dev.getOutput()).toContain('HMR 模式：classic')
      for (const output of [
        'app.js',
        'app.json',
        'pages/index/index.js',
        'pages/index/index.json',
        'pages/index/index.ttml',
        'components/PlatformCard/index.js',
        'components/PlatformCard/index.json',
        'components/PlatformCard/index.ttml',
      ]) {
        await dev.waitFor(waitForFile(path.join(DIST_ROOT, output)), `TT template ${output}`)
      }
      await expectVendorExportsIntact()

      const rebuildCount = () => dev.getOutput().split('小程序已重新构建').length - 1
      let previousBuildCount = rebuildCount()
      const templateMarker = 'TT SFC template HMR ready'
      const updatedTemplate = replaceSource(originalPageSource, 'Vue SFC 多平台 + Web', templateMarker)
      await replaceFileByRename(PAGE_SOURCE_PATH, updatedTemplate)
      await dev.waitFor(
        waitForFileContains(path.join(DIST_ROOT, 'pages/index/index.ttml'), templateMarker),
        'TT template text update',
      )
      await expect.poll(rebuildCount, { timeout: 30_000 }).toBeGreaterThan(previousBuildCount)
      await expectVendorExportsIntact()

      previousBuildCount = rebuildCount()
      const pageScriptMarker = 'tt-page-script-hmr-ready'
      const updatedPageScript = replaceSource(updatedTemplate, 'ref(\'ready\')', `ref('${pageScriptMarker}')`)
      await replaceFileByRename(PAGE_SOURCE_PATH, updatedPageScript)
      await dev.waitFor(
        waitForFileContains(path.join(DIST_ROOT, 'pages/index/index.js'), pageScriptMarker),
        'TT page script update',
      )
      await expect.poll(rebuildCount, { timeout: 30_000 }).toBeGreaterThan(previousBuildCount)
      await expectVendorExportsIntact()

      previousBuildCount = rebuildCount()
      const appScriptMarker = 'tt-app-script-hmr-ready'
      const updatedAppScript = replaceSource(originalAppSource, 'defineAppJson({', `console.info('${appScriptMarker}')\n\ndefineAppJson({`)
      await replaceFileByRename(APP_SOURCE_PATH, updatedAppScript)
      await dev.waitFor(
        waitForFileContains(path.join(DIST_ROOT, 'app.js'), appScriptMarker),
        'TT app script update',
      )
      await expect.poll(rebuildCount, { timeout: 30_000 }).toBeGreaterThan(previousBuildCount)
      await expectVendorExportsIntact()
    }
    finally {
      try {
        await dev.stop(5_000)
      }
      finally {
        await replaceFileByRename(PAGE_SOURCE_PATH, originalPageSource)
        await replaceFileByRename(APP_SOURCE_PATH, originalAppSource)
      }
    }
  })
})
