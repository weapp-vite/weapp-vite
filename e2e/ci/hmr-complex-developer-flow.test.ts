import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import {
  createHmrMarker,
  PLATFORM_EXT,
  replaceFileByRename,
  replaceHmrSfcTitle,
  resolvePlatforms,
  waitForFileContains,
} from '../utils/hmr-helpers'
import { toRelativeImport, waitForWevuRuntimeChunkContaining } from '../utils/wevu-vendor'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const HMR_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr')
const HMR_TEMPLATE = path.join(HMR_SRC_DIR, 'index.wxml')
const HMR_STYLE = path.join(HMR_SRC_DIR, 'index.wxss')
const HMR_SCRIPT = path.join(HMR_SRC_DIR, 'index.ts')
const HMR_JSON = path.join(HMR_SRC_DIR, 'index.json')
const HMR_SFC = path.join(APP_ROOT, 'src/pages/hmr-sfc/index.vue')
const SHARED_STORE = path.join(APP_ROOT, 'src/shared/store.ts')

const PLATFORM_LIST = resolvePlatforms()

async function updateSourceAndWait(options: {
  sourcePath: string
  distPath: string
  nextSource: string
  marker: string
  timeoutMs?: number
}) {
  const { sourcePath, distPath, nextSource, marker, timeoutMs = 90_000 } = options
  await replaceFileByRename(sourcePath, nextSource)
  try {
    return await waitForFileContains(distPath, marker, timeoutMs)
  }
  catch {
    await replaceFileByRename(sourcePath, `${nextSource}\n`)
    return await waitForFileContains(distPath, marker, timeoutMs)
  }
}

function expectUpdatedSource(source: string, updated: string, label: string) {
  if (source === updated) {
    throw new Error(`Failed to inject HMR marker into ${label}.`)
  }
}

function replaceSharedStoreName(source: string, marker: string) {
  const updated = source.replace(`const name = ref('init')`, `const name = ref('${marker}')`)
  expectUpdatedSource(source, updated, 'shared store')
  return updated
}

function createBrokenPageScript(source: string) {
  const updated = source.replace(
    `const setupStore = useSetupStore()`,
    `const setupStore = useSetupStore(\n`,
  )
  expectUpdatedSource(source, updated, 'broken page script')
  return updated
}

function createPageScriptWithMarker(source: string, marker: string) {
  const updated = source.replace(`buildResult('hmr',`, `buildResult('${marker}',`)
  expectUpdatedSource(source, updated, 'page script')
  return updated
}

async function waitForSharedStoreMarker(marker: string, retrySource: string) {
  try {
    return await waitForWevuRuntimeChunkContaining(DIST_ROOT, marker, 30_000)
  }
  catch {
    await replaceFileByRename(SHARED_STORE, `${retrySource}\n`)
    return await waitForWevuRuntimeChunkContaining(DIST_ROOT, marker, 90_000)
  }
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('HMR complex developer flows (dev watch)', () => {
  it.each(PLATFORM_LIST)('converges after mixed page, sfc, json and shared dependency saves (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)

    const originalSources = new Map<string, string>()
    for (const filePath of [
      HMR_TEMPLATE,
      HMR_STYLE,
      HMR_SCRIPT,
      HMR_JSON,
      HMR_SFC,
      SHARED_STORE,
    ]) {
      originalSources.set(filePath, await fs.readFile(filePath, 'utf8'))
    }

    const ext = PLATFORM_EXT[platform]
    const hmrTemplateDist = path.join(DIST_ROOT, `pages/hmr/index.${ext.template}`)
    const hmrStyleDist = path.join(DIST_ROOT, `pages/hmr/index.${ext.style}`)
    const hmrScriptDist = path.join(DIST_ROOT, 'pages/hmr/index.js')
    const hmrJsonDist = path.join(DIST_ROOT, 'pages/hmr/index.json')
    const hmrSfcTemplateDist = path.join(DIST_ROOT, `pages/hmr-sfc/index.${ext.template}`)
    const hmrSfcStyleDist = path.join(DIST_ROOT, `pages/hmr-sfc/index.${ext.style}`)
    const storePageDist = path.join(DIST_ROOT, 'pages/store/index.js')
    const storeSharePageDist = path.join(DIST_ROOT, 'pages/store-share/index.js')

    const pageTemplateMarker = createHmrMarker('COMPLEX-PAGE-TEMPLATE', platform)
    const pageStyleMarker = createHmrMarker('COMPLEX-PAGE-STYLE', platform)
    const brokenScriptMarker = createHmrMarker('COMPLEX-BROKEN-SCRIPT', platform)
    const fixedScriptMarker = createHmrMarker('COMPLEX-FIXED-SCRIPT', platform)
    const pageJsonMarker = createHmrMarker('COMPLEX-PAGE-JSON', platform)
    const firstSfcMarker = createHmrMarker('COMPLEX-SFC-FIRST', platform)
    const secondSfcMarker = createHmrMarker('COMPLEX-SFC-SECOND', platform)
    const sfcStyleMarker = createHmrMarker('COMPLEX-SFC-STYLE', platform)
    const sharedStoreMarker = createHmrMarker('COMPLEX-SHARED-STORE', platform)

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(hmrTemplateDist, 'HMR', 90_000), `${platform} initial page template`)
      await dev.waitFor(waitForFileContains(hmrScriptDist, 'buildResult', 90_000), `${platform} initial page script`)
      await dev.waitFor(waitForFileContains(hmrSfcTemplateDist, 'HMR-SFC', 90_000), `${platform} initial sfc template`)
      await dev.waitFor(waitForFileContains(storePageDist, 'setupCounter', 90_000), `${platform} initial store page`)
      await dev.waitFor(waitForFile(storeSharePageDist, 90_000), `${platform} initial store-share page`)

      const templateSource = originalSources.get(HMR_TEMPLATE)!
      const updatedTemplate = templateSource.replace('HMR', pageTemplateMarker)
      expectUpdatedSource(templateSource, updatedTemplate, 'page template')
      const templateOutput = await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_TEMPLATE,
          distPath: hmrTemplateDist,
          nextSource: updatedTemplate,
          marker: pageTemplateMarker,
        }),
        `${platform} page template update emitted`,
      )
      expect(templateOutput).toContain(pageTemplateMarker)

      const styleSource = originalSources.get(HMR_STYLE)!
      const updatedStyle = styleSource.replace('.page {', `.page {\n  --hmr-marker: '${pageStyleMarker}';`)
      expectUpdatedSource(styleSource, updatedStyle, 'page style')
      const styleOutput = await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_STYLE,
          distPath: hmrStyleDist,
          nextSource: updatedStyle,
          marker: pageStyleMarker,
        }),
        `${platform} page style update emitted`,
      )
      expect(styleOutput).toContain(pageStyleMarker)

      const scriptSource = originalSources.get(HMR_SCRIPT)!
      await replaceFileByRename(HMR_SCRIPT, createBrokenPageScript(scriptSource))
      await dev.waitFor(
        waitForFileContains(hmrScriptDist, 'buildResult', 90_000),
        `${platform} previous script output stays readable after broken save`,
      )

      const fixedScript = createPageScriptWithMarker(scriptSource, fixedScriptMarker)
      const scriptOutput = await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_SCRIPT,
          distPath: hmrScriptDist,
          nextSource: fixedScript,
          marker: fixedScriptMarker,
        }),
        `${platform} fixed page script emitted`,
      )
      expect(scriptOutput).toContain(fixedScriptMarker)
      expect(scriptOutput).not.toContain(brokenScriptMarker)

      const jsonSource = originalSources.get(HMR_JSON)!
      const jsonData = JSON.parse(jsonSource) as Record<string, unknown>
      jsonData.hmrMarker = pageJsonMarker
      const updatedJson = `${JSON.stringify(jsonData, null, 2)}\n`
      const jsonOutput = await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_JSON,
          distPath: hmrJsonDist,
          nextSource: updatedJson,
          marker: pageJsonMarker,
        }),
        `${platform} page json update emitted`,
      )
      expect(jsonOutput).toContain(pageJsonMarker)

      const sfcSource = originalSources.get(HMR_SFC)!
      const firstSfcUpdate = replaceHmrSfcTitle(sfcSource, firstSfcMarker)
      const secondSfcUpdate = replaceHmrSfcTitle(sfcSource, secondSfcMarker)
      expectUpdatedSource(sfcSource, firstSfcUpdate, 'first sfc template')
      expectUpdatedSource(sfcSource, secondSfcUpdate, 'second sfc template')
      await replaceFileByRename(HMR_SFC, firstSfcUpdate)
      await replaceFileByRename(HMR_SFC, secondSfcUpdate)
      const sfcTemplateOutput = await dev.waitFor(
        waitForFileContains(hmrSfcTemplateDist, secondSfcMarker, 90_000),
        `${platform} rapid sfc template update emitted`,
      )
      expect(sfcTemplateOutput).toContain(secondSfcMarker)
      expect(sfcTemplateOutput).not.toContain(firstSfcMarker)

      const sfcStyleUpdate = secondSfcUpdate.replace('.marker {', `.marker {\n  --hmr-marker: '${sfcStyleMarker}';`)
      expectUpdatedSource(secondSfcUpdate, sfcStyleUpdate, 'sfc style')
      const sfcStyleOutput = await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_SFC,
          distPath: hmrSfcStyleDist,
          nextSource: sfcStyleUpdate,
          marker: sfcStyleMarker,
        }),
        `${platform} sfc style update emitted`,
      )
      expect(sfcStyleOutput).toContain(sfcStyleMarker)
      expect(sfcStyleOutput).toContain('@import \'../hmr/index.wxss\';')
      expect(sfcStyleOutput).not.toContain('@wv-keep-import')

      const storeSource = originalSources.get(SHARED_STORE)!
      const updatedStore = replaceSharedStoreName(storeSource, sharedStoreMarker)
      await replaceFileByRename(SHARED_STORE, updatedStore)
      const sharedRuntime = await dev.waitFor(
        waitForSharedStoreMarker(sharedStoreMarker, updatedStore),
        `${platform} shared store update emitted`,
      )
      expect(sharedRuntime.code).toContain(sharedStoreMarker)
      expect(sharedRuntime.code).toContain('setupCounter')
      expect(sharedRuntime.code).toContain('optionsCounter')

      const [storePage, storeSharePage] = await Promise.all([
        fs.readFile(storePageDist, 'utf8'),
        fs.readFile(storeSharePageDist, 'utf8'),
      ])
      expect(storePage).toContain(`require("${toRelativeImport(storePageDist, sharedRuntime.path)}")`)
      expect(storeSharePage).toContain(`require("${toRelativeImport(storeSharePageDist, sharedRuntime.path)}")`)
      expect(dev.getOutput()).not.toContain('module is not defined')
      expect(dev.getOutput()).not.toContain('write EPIPE')
    }
    finally {
      await dev.stop(5_000)
      for (const [filePath, source] of originalSources) {
        await fs.writeFile(filePath, source, 'utf8')
      }
    }
  })
})
