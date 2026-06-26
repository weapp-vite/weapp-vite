import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import { toRelativeImport, waitForWevuRuntimeChunkContaining } from '../utils/wevu-vendor'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const APP_JSON_PATH = path.join(APP_ROOT, 'src/app.json')
const COMPOSABLE_DIR = path.join(APP_ROOT, 'src/shared')
const COMPOSABLE_PATH = path.join(COMPOSABLE_DIR, 'root-import-hmr.ts')
const PAGE_DIR = path.join(APP_ROOT, 'src/pages/root-import-hmr')
const PAGE_SOURCE_PATH = path.join(PAGE_DIR, 'index.vue')
const PAGE_JS_PATH = path.join(DIST_ROOT, 'pages/root-import-hmr/index.js')
const PAGE_JSON_PATH = path.join(DIST_ROOT, 'pages/root-import-hmr/index.json')
const BASE_TITLE = 'Root Import HMR'
const PLATFORM_LIST = resolvePlatforms()

function createComposableSource(marker: string) {
  return [
    'import { computed, onShareAppMessage, ref, unref } from \'wevu\'',
    '',
    'export function useRootImportHmr() {',
    `  const title = ref('${marker}')`,
    '  const label = computed(() => `root:${unref(title)'.concat('}`)'),
    '  onShareAppMessage(() => ({ title: unref(label) }))',
    '  return { label }',
    '}',
    '',
  ].join('\n')
}

function createPageSource(title: string) {
  return [
    '<script setup lang="ts">',
    'import { useRootImportHmr } from \'../../shared/root-import-hmr\'',
    '',
    'definePageJson({',
    `  navigationBarTitleText: '${title}',`,
    '})',
    '',
    'const { label } = useRootImportHmr()',
    '</script>',
    '',
    '<template>',
    '  <view class="root-import-hmr">',
    '    {{ label }}',
    '  </view>',
    '</template>',
    '',
    '<style>',
    '.root-import-hmr {',
    '  padding: 24rpx;',
    '}',
    '</style>',
    '',
  ].join('\n')
}

async function waitForPageRequire(pageJsPath: string, marker: string) {
  const pageJs = await waitForFileContains(pageJsPath, marker, 90_000)
  if (!pageJs.includes('onShareAppMessage')) {
    throw new Error('Expected emitted page JS to register onShareAppMessage.')
  }
  return pageJs
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('wevu root import HMR regression (dev watch)', () => {
  it.each(PLATFORM_LIST)('keeps root wevu hook and reactivity imports stable after repeated page json saves (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)

    const originalAppJson = await fs.readFile(APP_JSON_PATH, 'utf8')
    const originalComposableSource = await fs.readFile(COMPOSABLE_PATH, 'utf8')
    const originalPageSource = await fs.readFile(PAGE_SOURCE_PATH, 'utf8')
    const initialMarker = createHmrMarker('ROOT-IMPORT-INITIAL', platform)
    const firstTitle = createHmrMarker('ROOT-IMPORT-TITLE-FIRST', platform)
    const secondTitle = createHmrMarker('ROOT-IMPORT-TITLE-SECOND', platform)
    const finalMarker = createHmrMarker('ROOT-IMPORT-FINAL', platform)

    await fs.writeFile(COMPOSABLE_PATH, createComposableSource(initialMarker), 'utf8')
    await fs.writeFile(PAGE_SOURCE_PATH, createPageSource(BASE_TITLE), 'utf8')

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000), `${platform} app.json generated`)
      const initialPageJs = await dev.waitFor(
        waitForPageRequire(PAGE_JS_PATH, initialMarker),
        `${platform} initial root import page js`,
      )
      await dev.waitFor(waitForFileContains(PAGE_JSON_PATH, BASE_TITLE, 90_000), `${platform} initial page json`)

      await replaceFileByRename(PAGE_SOURCE_PATH, createPageSource(firstTitle))
      await dev.waitFor(waitForFileContains(PAGE_JSON_PATH, firstTitle, 90_000), `${platform} first page json hmr`)

      await replaceFileByRename(PAGE_SOURCE_PATH, createPageSource(secondTitle))
      await dev.waitFor(waitForFileContains(PAGE_JSON_PATH, secondTitle, 90_000), `${platform} second page json hmr`)

      await replaceFileByRename(COMPOSABLE_PATH, createComposableSource(finalMarker))
      const finalPageJs = await dev.waitFor(
        waitForPageRequire(PAGE_JS_PATH, finalMarker),
        `${platform} composable hmr after page json saves`,
      )

      const reactivityChunk = await dev.waitFor(
        waitForWevuRuntimeChunkContaining(DIST_ROOT, 'Object.defineProperty(exports, "unref"', 90_000),
        `${platform} reactivity vendor exports unref`,
      )
      const runtimeChunk = await dev.waitFor(
        waitForWevuRuntimeChunkContaining(DIST_ROOT, 'assertInSetup("onShareAppMessage")', 90_000),
        `${platform} runtime vendor supports onShareAppMessage`,
      )

      expect(initialPageJs).toContain(initialMarker)
      expect(finalPageJs).toContain(finalMarker)
      expect(finalPageJs).toContain(`require("${toRelativeImport(PAGE_JS_PATH, reactivityChunk.path)}")`)
      expect(finalPageJs).toContain(`require("${toRelativeImport(PAGE_JS_PATH, runtimeChunk.path)}")`)
      expect(finalPageJs).toContain('onShareAppMessage || function(handler)')
      expect(finalPageJs).toContain('assertInSetup("onShareAppMessage")')
      expect(finalPageJs).not.toContain('from "wevu"')
      expect(dev.getOutput()).not.toContain('onShareAppMessage is not a function')
      expect(dev.getOutput()).not.toContain('unref(...) is not a function')
      expect(dev.getOutput()).not.toContain('Build failed')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(APP_JSON_PATH, originalAppJson, 'utf8')
      await fs.writeFile(COMPOSABLE_PATH, originalComposableSource, 'utf8')
      await fs.writeFile(PAGE_SOURCE_PATH, originalPageSource, 'utf8')
    }
  })
})
