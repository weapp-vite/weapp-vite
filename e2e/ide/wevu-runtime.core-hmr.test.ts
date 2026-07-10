import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import {
  createHmrMarker,
  replaceFileByRename,
  replaceHmrSfcTitle,
  waitForFileContains,
} from '../utils/hmr-helpers'
import {
  cleanDevtoolsCache,
  cleanupResidualDevtoolsProcesses,
  cleanupResidualIdeProcesses,
} from '../utils/ide-devtools-cleanup'
import { toRelativeImport, waitForWevuRuntimeChunkContaining } from '../utils/wevu-vendor'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'
import { relaunchPage } from './github-issues.runtime.shared'

const BRIDGE_POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH'
const HMR_PAGE_WXML = path.join(APP_ROOT, 'src/pages/hmr/index.wxml')
const HMR_PAGE_SCRIPT = path.join(APP_ROOT, 'src/pages/hmr/index.ts')
const HMR_PAGE_STYLE = path.join(APP_ROOT, 'src/pages/hmr/index.wxss')
const HMR_SFC_PATH = path.join(APP_ROOT, 'src/pages/hmr-sfc/index.vue')
const LAYOUT_PAGE_WXML = path.join(APP_ROOT, 'src/pages/layouts/index.wxml')
const LAYOUT_PAGE_SCRIPT = path.join(APP_ROOT, 'src/pages/layouts/index.ts')
const LAYOUT_PAGE_STYLE = path.join(APP_ROOT, 'src/pages/layouts/index.wxss')
const SHARED_STORE_PATH = path.join(APP_ROOT, 'src/shared/store.ts')

const HMR_PAGE_WXML_DIST = path.join(DIST_ROOT, 'pages/hmr/index.wxml')
const HMR_PAGE_JS_DIST = path.join(DIST_ROOT, 'pages/hmr/index.js')
const HMR_PAGE_WXSS_DIST = path.join(DIST_ROOT, 'pages/hmr/index.wxss')
const HMR_SFC_WXML_DIST = path.join(DIST_ROOT, 'pages/hmr-sfc/index.wxml')
const HMR_SFC_JS_DIST = path.join(DIST_ROOT, 'pages/hmr-sfc/index.js')
const HMR_SFC_WXSS_DIST = path.join(DIST_ROOT, 'pages/hmr-sfc/index.wxss')
const LAYOUT_PAGE_WXML_DIST = path.join(DIST_ROOT, 'pages/layouts/index.wxml')
const LAYOUT_PAGE_JS_DIST = path.join(DIST_ROOT, 'pages/layouts/index.js')
const LAYOUT_PAGE_WXSS_DIST = path.join(DIST_ROOT, 'pages/layouts/index.wxss')
const RUNTIME_PAGE_WXML_DIST = path.join(DIST_ROOT, 'pages/runtime/index.wxml')
const RUNTIME_PAGE_JS_DIST = path.join(DIST_ROOT, 'pages/runtime/index.js')
const STORE_PAGE_JS_DIST = path.join(DIST_ROOT, 'pages/store/index.js')
const STORE_SHARE_PAGE_JS_DIST = path.join(DIST_ROOT, 'pages/store-share/index.js')

const HMR_PAGE_BASE_MARKER = '<view class="title">HMR</view>'
const HMR_SFC_TEMPLATE_BASE_MARKER = 'HMR-SFC'
const HMR_SFC_SCRIPT_BASE_MARKER = 'HMR-SFC-SCRIPT'
const HMR_SFC_STYLE_BASE_MARKER = 'hmr-sfc-page'
const HMR_SFC_KEEP_IMPORT_OUTPUT = '@import \'../hmr/index.wxss\';'
const HMR_SFC_KEEP_IMPORT_DIRECTIVE = '@wv-keep-import'
const LAYOUT_PAGE_TEMPLATE_BASE_MARKER = 'LAYOUTS-PAGE-TEMPLATE-BASE'
const LAYOUT_PAGE_SCRIPT_BASE_MARKER = 'LAYOUTS-PAGE-SCRIPT-BASE'
const HMR_TEMPLATE_PROBE_STORAGE_KEY = '__weapp_vite_core_hmr_template_probe__'
const HMR_SCRIPT_PROBE_STORAGE_KEY = '__weapp_vite_core_hmr_script_probe__'
const HMR_SFC_TEMPLATE_PROBE_STORAGE_KEY = '__weapp_vite_core_hmr_sfc_template_probe__'
const HMR_SFC_SCRIPT_PROBE_STORAGE_KEY = '__weapp_vite_core_hmr_sfc_script_probe__'
const LAYOUT_TEMPLATE_PROBE_STORAGE_KEY = '__weapp_vite_core_hmr_layout_template_probe__'
const LAYOUT_SCRIPT_PROBE_STORAGE_KEY = '__weapp_vite_core_hmr_layout_script_probe__'
const STORE_E2E_RESULT_STORAGE_KEY = '__weapp_vite_core_hmr_store_result__'
const STORE_SHARE_E2E_RESULT_STORAGE_KEY = '__weapp_vite_core_hmr_store_share_result__'

let sharedMiniProgram: any = null
let previousBridgePostConnectRefresh: string | undefined

async function waitForElementTextContains(page: any, marker: string, timeoutMs = 20_000) {
  const start = Date.now()
  const selectors = ['.title', '.marker', '.hero__eyebrow', '.hero__desc', '.details']
  let lastText = ''
  let lastError: unknown
  while (Date.now() - start < timeoutMs) {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector, { timeout: 1_000 })
        if (!element) {
          continue
        }
        const text = String(await element.text() ?? '')
        if (text) {
          lastText = `${selector}: ${text}`
        }
        if (text.includes(marker)) {
          return text
        }
      }
      catch (error) {
        lastError = error
      }
    }
    await page.waitFor(200)
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError ?? 'condition not met')
  throw new Error(`Timed out waiting runtime element text to contain marker: ${marker}; reason=${reason}; lastText=${lastText.slice(0, 800)}`)
}

function resolveTemplateProbeStorageKey(route: string) {
  if (route.includes('/pages/hmr-sfc/')) {
    return HMR_SFC_TEMPLATE_PROBE_STORAGE_KEY
  }
  if (route.includes('/pages/layouts/')) {
    return LAYOUT_TEMPLATE_PROBE_STORAGE_KEY
  }
  if (route.includes('/pages/hmr/')) {
    return HMR_TEMPLATE_PROBE_STORAGE_KEY
  }
  return ''
}

function resolveTemplateProbeDistPath(route: string) {
  if (route.includes('/pages/hmr-sfc/')) {
    return HMR_SFC_WXML_DIST
  }
  if (route.includes('/pages/layouts/')) {
    return LAYOUT_PAGE_WXML_DIST
  }
  if (route.includes('/pages/hmr/')) {
    return HMR_PAGE_WXML_DIST
  }
  return ''
}

function resolveStorageProbeDistContract(storageKey: string, expected: string) {
  if (storageKey === HMR_SCRIPT_PROBE_STORAGE_KEY) {
    return { distPath: HMR_PAGE_JS_DIST, markers: [storageKey, expected] }
  }
  if (storageKey === HMR_SFC_SCRIPT_PROBE_STORAGE_KEY) {
    return { distPath: HMR_SFC_JS_DIST, markers: [storageKey, expected] }
  }
  if (storageKey === LAYOUT_SCRIPT_PROBE_STORAGE_KEY) {
    return { distPath: LAYOUT_PAGE_JS_DIST, markers: [storageKey, expected] }
  }
  if (storageKey === STORE_E2E_RESULT_STORAGE_KEY) {
    return { distPath: STORE_PAGE_JS_DIST, markers: [storageKey, expected] }
  }
  if (storageKey === STORE_SHARE_E2E_RESULT_STORAGE_KEY) {
    return { distPath: STORE_SHARE_PAGE_JS_DIST, markers: [storageKey, expected] }
  }
  return null
}

function isDevtoolsRuntimeProbeUnavailable(error: unknown) {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const protocolError = current as Error & { cause?: unknown, code?: unknown, method?: unknown }
    const message = protocolError instanceof Error ? protocolError.message : String(protocolError)
    if (
      protocolError.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
      || message.includes('DevTools did not respond to protocol method')
      || message.includes('Operation timed out after')
      || message.includes('Connection closed, check if wechat web DevTools is still running')
      || message.includes('Connection closed, check if wechat web devTools is still running')
      || message.includes('Execution context was destroyed')
      || message.includes('WebSocket is not open')
      || message.includes('socket hang up')
      || message.includes('Target closed')
    ) {
      return true
    }
    current = protocolError.cause
  }
  return false
}

async function assertRuntimeProbeWithDistFallback<T>(options: {
  distPath: string
  label: string
  markers: string[]
  probe: () => Promise<T>
  route: string
}) {
  try {
    return await options.probe()
  }
  catch (error) {
    if (!isDevtoolsRuntimeProbeUnavailable(error)) {
      throw error
    }
    const output = await fs.readFile(options.distPath, 'utf8')
    for (const marker of options.markers) {
      expect(output).toContain(marker)
    }
    const reason = error instanceof Error ? error.message : String(error)
    process.stdout.write(`[wevu-runtime:core-hmr] ${options.label}-capability-limited route=${options.route} markers=${options.markers.join(',')} reason=${reason}\n`)
    return null
  }
}

async function waitForStorageField(
  miniProgram: any,
  storageKey: string,
  field: string,
  expected: string,
  timeoutMs = 12_000,
) {
  const start = Date.now()
  let lastState: unknown
  while (Date.now() - start < timeoutMs) {
    lastState = await miniProgram.callWxMethodWithOptions('getStorageSync', {
      timeout: 2_500,
    }, storageKey)
    if (lastState && typeof lastState === 'object' && (lastState as Record<string, unknown>)[field] === expected) {
      return lastState
    }
    await new Promise(resolve => setTimeout(resolve, 220))
  }
  throw new Error(`Timed out waiting storage field: key=${storageKey} field=${field} expected=${expected}; lastState=${JSON.stringify(lastState)}`)
}

async function waitForStorageMarker(miniProgram: any, storageKey: string, expected: string, timeoutMs = 12_000) {
  return await waitForStorageField(miniProgram, storageKey, 'marker', expected, timeoutMs)
}

async function waitForStorageResultOk(miniProgram: any, storageKey: string, expectedName: string, timeoutMs = 12_000) {
  const start = Date.now()
  let lastState: unknown
  while (Date.now() - start < timeoutMs) {
    lastState = await miniProgram.callWxMethodWithOptions('getStorageSync', {
      timeout: 2_500,
    }, storageKey)
    if (
      lastState
      && typeof lastState === 'object'
      && (lastState as Record<string, unknown>).name === expectedName
      && (lastState as Record<string, unknown>).ok === true
    ) {
      return lastState
    }
    await new Promise(resolve => setTimeout(resolve, 220))
  }
  throw new Error(`Timed out waiting storage result: key=${storageKey} name=${expectedName}; lastState=${JSON.stringify(lastState)}`)
}

async function resetStorageMarker(miniProgram: any, storageKey: string) {
  await miniProgram.callWxMethodWithOptions('removeStorageSync', {
    timeout: 2_500,
  }, storageKey).catch(() => {})
}

async function waitForTemplateProbeMarker(miniProgram: any, route: string, marker: string, timeoutMs = 12_000) {
  const storageKey = resolveTemplateProbeStorageKey(route)
  if (!storageKey) {
    return await waitForElementTextContains(await miniProgram.currentPage({
      appFunctionFallback: false,
      retries: 1,
      timeout: 2_500,
    }), marker, timeoutMs)
  }
  return await waitForStorageMarker(miniProgram, storageKey, marker, timeoutMs)
}

function expectSfcKeepImportResolved(content: string) {
  expect(content).toContain(HMR_SFC_KEEP_IMPORT_OUTPUT)
  expect(content).not.toContain(HMR_SFC_KEEP_IMPORT_DIRECTIVE)
}

function ensureSfcKeepImportSource(source: string) {
  if (source.includes(HMR_SFC_KEEP_IMPORT_DIRECTIVE)) {
    return source
  }
  const styleMarker = '/* HMR-SFC-STYLE */'
  if (!source.includes(styleMarker)) {
    throw new Error('HMR SFC fixture is missing the style baseline marker.')
  }
  return source.replace(
    styleMarker,
    `${styleMarker}\n/* stylelint-disable-next-line at-rule-no-unknown, scss/at-rule-no-unknown */\n@wv-keep-import '../hmr/index.wxss';`,
  )
}

function ensureHmrPageTemplateProbeSource(source: string) {
  if (source.includes(HMR_TEMPLATE_PROBE_STORAGE_KEY)) {
    return source
  }
  const titleMarker = '<view class="title">HMR</view>'
  if (!source.includes(titleMarker)) {
    throw new Error('HMR page fixture is missing the template baseline marker.')
  }
  return source.replace(
    titleMarker,
    `<e2e-template-probe marker="HMR" storage-key="${HMR_TEMPLATE_PROBE_STORAGE_KEY}" />\n  ${titleMarker}`,
  )
}

function ensureHmrSfcProbeSource(source: string) {
  let updated = source

  if (!updated.includes(HMR_SFC_SCRIPT_PROBE_STORAGE_KEY)) {
    const scriptTarget = `import { defineComponent } from 'wevu'\n\nexport default defineComponent({\n  data: () => ({\n    marker: 'HMR-SFC-SCRIPT',\n  }),\n})`
    const scriptReplacement = `import { defineComponent } from 'wevu'\n\nconst hmrSfcScriptMarker = 'HMR-SFC-SCRIPT'\nconst HMR_SFC_SCRIPT_PROBE_STORAGE_KEY = '${HMR_SFC_SCRIPT_PROBE_STORAGE_KEY}'\n\nfunction writeHmrSfcScriptProbe(marker: string) {\n  if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') {\n    return\n  }\n  wx.setStorageSync(HMR_SFC_SCRIPT_PROBE_STORAGE_KEY, {\n    marker,\n    updatedAt: Date.now(),\n  })\n}\n\nexport default defineComponent({\n  data: () => ({\n    marker: hmrSfcScriptMarker,\n  }),\n  setup() {\n    writeHmrSfcScriptProbe(hmrSfcScriptMarker)\n  },\n})`
    if (!updated.includes(scriptTarget)) {
      throw new Error('HMR SFC fixture is missing the script baseline marker.')
    }
    updated = updated.replace(scriptTarget, scriptReplacement)
  }

  if (!updated.includes(HMR_SFC_TEMPLATE_PROBE_STORAGE_KEY)) {
    const templateTarget = '<view class="hmr-sfc-page">'
    if (!updated.includes(templateTarget)) {
      throw new Error('HMR SFC fixture is missing the template root marker.')
    }
    updated = updated.replace(
      templateTarget,
      `${templateTarget}\n    <e2e-template-probe marker="HMR-SFC" storage-key="${HMR_SFC_TEMPLATE_PROBE_STORAGE_KEY}" />`,
    )
  }

  if (!updated.includes('"e2e-template-probe"')) {
    const jsonTarget = '"component": false'
    if (!updated.includes(jsonTarget)) {
      throw new Error('HMR SFC fixture is missing the json baseline marker.')
    }
    updated = updated.replace(
      jsonTarget,
      `"component": false,\n  "usingComponents": {\n    "e2e-template-probe": "/components/e2e-template-probe/index"\n  }`,
    )
  }

  return updated
}

function replaceHmrPageTemplateMarker(source: string, marker: string) {
  const updatedTitle = source.replace('<view class="title">HMR</view>', `<view class="title">${marker}</view>`)
  const updatedProbe = updatedTitle.replace('marker="HMR"', `marker="${marker}"`)
  if (updatedProbe === source || !updatedProbe.includes(marker)) {
    throw new Error('Failed to inject HMR marker into page template source.')
  }
  return updatedProbe
}

async function waitForIdeRecompileSettled(delayMs = 1_200) {
  await new Promise(resolve => setTimeout(resolve, delayMs))
}

async function closeMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  await sharedMiniProgram.close().catch(() => {})
  sharedMiniProgram = null
}

async function ensureMiniProgram(ctx: { skip: (message?: string) => void }) {
  try {
    if (sharedMiniProgram) {
      return sharedMiniProgram
    }
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipWarmup: true,
    })
    return sharedMiniProgram
  }
  catch (error) {
    if (isDevtoolsHttpPortError(error)) {
      ctx.skip('WeChat DevTools 服务端口未开启，跳过 wevu runtime core HMR IDE 自动化用例。')
    }
    throw error
  }
}

async function waitForInitialHmrDistReady(dev: ReturnType<typeof startDevProcess>) {
  await dev.waitFor(
    Promise.all([
      waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000),
      waitForFileContains(HMR_PAGE_WXML_DIST, HMR_PAGE_BASE_MARKER, 90_000),
      waitForFile(HMR_PAGE_JS_DIST, 90_000),
      waitForFile(HMR_PAGE_WXSS_DIST, 90_000),
      waitForFileContains(HMR_SFC_WXML_DIST, HMR_SFC_TEMPLATE_BASE_MARKER, 90_000),
      waitForFileContains(HMR_SFC_JS_DIST, HMR_SFC_SCRIPT_BASE_MARKER, 90_000),
      waitForFileContains(HMR_SFC_WXSS_DIST, HMR_SFC_STYLE_BASE_MARKER, 90_000),
      waitForFileContains(LAYOUT_PAGE_WXML_DIST, LAYOUT_PAGE_TEMPLATE_BASE_MARKER, 90_000),
      waitForFileContains(LAYOUT_PAGE_JS_DIST, LAYOUT_PAGE_SCRIPT_BASE_MARKER, 90_000),
      waitForFile(LAYOUT_PAGE_WXSS_DIST, 90_000),
      waitForFile(RUNTIME_PAGE_WXML_DIST, 90_000),
      waitForFile(RUNTIME_PAGE_JS_DIST, 90_000),
      waitForFile(STORE_PAGE_JS_DIST, 90_000),
      waitForFile(STORE_SHARE_PAGE_JS_DIST, 90_000),
    ]),
    'weapp core hmr baseline dist generated',
  )
  await waitForIdeRecompileSettled(1_500)
}

async function relaunchIdeRoute(
  route: string,
  readyText: string | undefined,
  ctx: { skip: (message?: string) => void },
  options: {
    allowCurrentSession?: boolean
    storageReady?: { expected: string, field: string, key: string, requireOk?: boolean }
    validate?: (page: any) => Promise<void>
  } = {},
) {
  // 同一套件优先复用 automator，会话确实失效时才清缓存并重连。
  let lastError: unknown = null
  const createReadiness = (miniProgram: any) => async (page: any) => {
    if (readyText) {
      const distPath = resolveTemplateProbeDistPath(route)
      if (!distPath) {
        throw new Error(`Missing template dist contract for route: ${route}`)
      }
      await assertRuntimeProbeWithDistFallback({
        distPath,
        label: 'template-probe',
        markers: [readyText],
        probe: () => waitForTemplateProbeMarker(miniProgram, route, readyText, 2_600),
        route,
      })
    }
    if (options.storageReady) {
      const contract = resolveStorageProbeDistContract(options.storageReady.key, options.storageReady.expected)
      if (!contract) {
        throw new Error(`Missing storage dist contract for key: ${options.storageReady.key}`)
      }
      await assertRuntimeProbeWithDistFallback({
        ...contract,
        label: 'storage-probe',
        probe: () => options.storageReady?.requireOk
          ? waitForStorageResultOk(miniProgram, options.storageReady.key, options.storageReady.expected, 2_600)
          : waitForStorageField(
              miniProgram,
              options.storageReady!.key,
              options.storageReady!.field,
              options.storageReady!.expected,
              2_600,
            ),
        route,
      })
    }
    await options.validate?.(page)
    return true
  }
  if (options.allowCurrentSession !== false && sharedMiniProgram) {
    try {
      const storageKey = readyText ? resolveTemplateProbeStorageKey(route) : ''
      if (storageKey) {
        await resetStorageMarker(sharedMiniProgram, storageKey)
      }
      if (options.storageReady) {
        await resetStorageMarker(sharedMiniProgram, options.storageReady.key)
      }
      const page = await relaunchPage(sharedMiniProgram, route, undefined, 24_000, {
        readiness: () => true,
      })
      if (page) {
        await createReadiness(sharedMiniProgram)(page)
        return page
      }
    }
    catch (error) {
      lastError = error
    }
  }

  const recoveryPasses = [
    { cleanType: 'compile', settleDelay: 1_200 },
    { cleanType: 'all', settleDelay: 1_800 },
    { cleanType: 'all', settleDelay: 2_400 },
  ] as const

  for (const { cleanType, settleDelay } of recoveryPasses) {
    await closeMiniProgram()
    await cleanupResidualDevtoolsProcesses()
    await cleanDevtoolsCache(cleanType, { cwd: APP_ROOT }).catch(() => {})
    await waitForIdeRecompileSettled(settleDelay)

    const miniProgram = await ensureMiniProgram(ctx)
    const storageKey = readyText ? resolveTemplateProbeStorageKey(route) : ''
    if (storageKey) {
      await resetStorageMarker(miniProgram, storageKey)
    }
    if (options.storageReady) {
      await resetStorageMarker(miniProgram, options.storageReady.key)
    }
    const page = await relaunchPage(miniProgram, route, undefined, 24_000, {
      readiness: () => true,
    })
    if (page) {
      await createReadiness(miniProgram)(page)
      return page
    }
  }

  throw new Error(`Failed to relaunch IDE route: ${route}`, {
    cause: lastError as Error,
  })
}

async function waitForFileContainsWithRetry(
  filePath: string,
  marker: string,
  touchFilePath: string,
  touchContent: string,
  timeoutMs = 20_000,
) {
  try {
    return await waitForFileContains(filePath, marker, timeoutMs)
  }
  catch {
    await replaceFileByRename(touchFilePath, `${touchContent}\n`)
    return await waitForFileContains(filePath, marker, timeoutMs)
  }
}

async function updateSourceAndWait(options: {
  sourcePath: string
  distPath: string
  nextSource: string
  marker: string
  timeoutMs?: number
}) {
  const { sourcePath, distPath, nextSource, marker, timeoutMs = 20_000 } = options
  await replaceFileByRename(sourcePath, nextSource)
  return await waitForFileContainsWithRetry(distPath, marker, sourcePath, nextSource, timeoutMs)
}

function replaceSharedStoreName(source: string, marker: string) {
  const updated = source.replace(`export const setupStoreInitialName = 'init'`, `export const setupStoreInitialName = '${marker}'`)
  if (updated === source) {
    throw new Error('Failed to inject HMR marker into shared store source.')
  }
  return updated
}

function replaceHmrSfcScriptMarker(source: string, marker: string) {
  const updated = source.replace(`const hmrSfcScriptMarker = 'HMR-SFC-SCRIPT'`, `const hmrSfcScriptMarker = '${marker}'`)
  if (updated === source) {
    throw new Error('Failed to inject HMR marker into SFC script source.')
  }
  return updated
}

async function waitForSharedStoreMarker(marker: string, retrySource: string) {
  try {
    return await waitForWevuRuntimeChunkContaining(DIST_ROOT, marker, 20_000)
  }
  catch {
    await replaceFileByRename(SHARED_STORE_PATH, `${retrySource}\n`)
    return await waitForWevuRuntimeChunkContaining(DIST_ROOT, marker, 20_000)
  }
}

describe.sequential('wevu runtime core hmr matrix (ide)', () => {
  beforeAll(() => {
    previousBridgePostConnectRefresh = process.env[BRIDGE_POST_CONNECT_REFRESH_ENV]
    process.env[BRIDGE_POST_CONNECT_REFRESH_ENV] = '1'
  })

  afterAll(async () => {
    try {
      await closeMiniProgram()
      await cleanupResidualIdeProcesses()
    }
    finally {
      if (previousBridgePostConnectRefresh == null) {
        delete process.env[BRIDGE_POST_CONNECT_REFRESH_ENV]
      }
      else {
        process.env[BRIDGE_POST_CONNECT_REFRESH_ENV] = previousBridgePostConnectRefresh
      }
    }
  })

  it('keeps DevTools runtime aligned with core page, sfc and layout hmr updates', async (ctx) => {
    await cleanupResidualIdeProcesses()
    await fs.remove(DIST_ROOT)

    const originalSources = new Map<string, string>()
    for (const filePath of [
      HMR_PAGE_WXML,
      HMR_PAGE_SCRIPT,
      HMR_PAGE_STYLE,
      HMR_SFC_PATH,
      LAYOUT_PAGE_WXML,
      LAYOUT_PAGE_SCRIPT,
      LAYOUT_PAGE_STYLE,
      SHARED_STORE_PATH,
    ]) {
      originalSources.set(filePath, await fs.readFile(filePath, 'utf8'))
    }
    const testSources = new Map(originalSources)
    const testSfcSource = ensureHmrSfcProbeSource(ensureSfcKeepImportSource(testSources.get(HMR_SFC_PATH)!))
    if (testSfcSource !== testSources.get(HMR_SFC_PATH)) {
      await fs.writeFile(HMR_SFC_PATH, testSfcSource, 'utf8')
      testSources.set(HMR_SFC_PATH, testSfcSource)
    }
    const testHmrPageTemplate = ensureHmrPageTemplateProbeSource(testSources.get(HMR_PAGE_WXML)!)
    if (testHmrPageTemplate !== testSources.get(HMR_PAGE_WXML)) {
      await fs.writeFile(HMR_PAGE_WXML, testHmrPageTemplate, 'utf8')
      testSources.set(HMR_PAGE_WXML, testHmrPageTemplate)
    }

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await waitForInitialHmrDistReady(dev)
      expectSfcKeepImportResolved(await fs.readFile(HMR_SFC_WXSS_DIST, 'utf8'))
      await relaunchIdeRoute('/pages/hmr/index', 'HMR', ctx)

      const pageTemplateMarker = createHmrMarker('IDE-CORE-PAGE-TEMPLATE', 'weapp')
      const updatedPageWxml = replaceHmrPageTemplateMarker(testSources.get(HMR_PAGE_WXML)!, pageTemplateMarker)
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_PAGE_WXML,
          distPath: HMR_PAGE_WXML_DIST,
          nextSource: updatedPageWxml,
          marker: pageTemplateMarker,
        }),
        'page template hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      await relaunchIdeRoute('/pages/hmr/index', pageTemplateMarker, ctx)

      const pageScriptMarker = createHmrMarker('IDE-CORE-PAGE-SCRIPT', 'weapp')
      const updatedPageScript = testSources
        .get(HMR_PAGE_SCRIPT)!
        .replace(`const hmrScriptName = 'hmr'`, `const hmrScriptName = '${pageScriptMarker}'`)
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_PAGE_SCRIPT,
          distPath: HMR_PAGE_JS_DIST,
          nextSource: updatedPageScript,
          marker: pageScriptMarker,
        }),
        'page script hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      await relaunchIdeRoute('/pages/hmr/index', undefined, ctx, {
        storageReady: {
          expected: pageScriptMarker,
          field: 'name',
          key: HMR_SCRIPT_PROBE_STORAGE_KEY,
        },
      })

      const pageStyleMarker = createHmrMarker('IDE-CORE-PAGE-STYLE', 'weapp')
      const updatedPageStyle = testSources
        .get(HMR_PAGE_STYLE)!
        .replace('.page {', `.page {\n  --hmr-marker: '${pageStyleMarker}';`)
      const pageStyleOutput = await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_PAGE_STYLE,
          distPath: HMR_PAGE_WXSS_DIST,
          nextSource: updatedPageStyle,
          marker: pageStyleMarker,
        }),
        'page style hmr marker emitted',
      )
      expect(pageStyleOutput).toContain(pageStyleMarker)
      await waitForIdeRecompileSettled()
      await relaunchIdeRoute('/pages/hmr/index', undefined, ctx, {
        storageReady: {
          expected: pageScriptMarker,
          field: 'name',
          key: HMR_SCRIPT_PROBE_STORAGE_KEY,
        },
      })

      const sfcTemplateMarker = createHmrMarker('IDE-CORE-SFC-TEMPLATE', 'weapp')
      const updatedSfcTemplate = replaceHmrSfcTitle(
        testSources.get(HMR_SFC_PATH)!,
        sfcTemplateMarker,
      ).replace('marker="HMR-SFC"', `marker="${sfcTemplateMarker}"`)
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_SFC_PATH,
          distPath: HMR_SFC_WXML_DIST,
          nextSource: updatedSfcTemplate,
          marker: sfcTemplateMarker,
        }),
        'sfc template hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      await relaunchIdeRoute('/pages/hmr-sfc/index', sfcTemplateMarker, ctx)
      expectSfcKeepImportResolved(await fs.readFile(HMR_SFC_WXSS_DIST, 'utf8'))

      const sfcScriptMarker = createHmrMarker('IDE-CORE-SFC-SCRIPT', 'weapp')
      const updatedSfcScript = replaceHmrSfcScriptMarker(updatedSfcTemplate, sfcScriptMarker)
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_SFC_PATH,
          distPath: HMR_SFC_JS_DIST,
          nextSource: updatedSfcScript,
          marker: sfcScriptMarker,
        }),
        'sfc script hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      await relaunchIdeRoute('/pages/hmr-sfc/index', undefined, ctx, {
        storageReady: {
          expected: sfcScriptMarker,
          field: 'marker',
          key: HMR_SFC_SCRIPT_PROBE_STORAGE_KEY,
        },
      })
      expectSfcKeepImportResolved(await fs.readFile(HMR_SFC_WXSS_DIST, 'utf8'))

      const sfcStyleMarker = createHmrMarker('IDE-CORE-SFC-STYLE', 'weapp')
      const updatedSfcStyle = updatedSfcScript
        .replace('.marker {', `.marker {\n  --hmr-marker: '${sfcStyleMarker}';`)
      const sfcStyleOutput = await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_SFC_PATH,
          distPath: HMR_SFC_WXSS_DIST,
          nextSource: updatedSfcStyle,
          marker: sfcStyleMarker,
        }),
        'sfc style hmr marker emitted',
      )
      expect(sfcStyleOutput).toContain(sfcStyleMarker)
      expectSfcKeepImportResolved(sfcStyleOutput)
      await waitForIdeRecompileSettled()
      await relaunchIdeRoute('/pages/hmr-sfc/index', undefined, ctx, {
        storageReady: {
          expected: sfcScriptMarker,
          field: 'marker',
          key: HMR_SFC_SCRIPT_PROBE_STORAGE_KEY,
        },
      })

      const layoutPageTemplateMarker = createHmrMarker('IDE-CORE-LAYOUT-PAGE-TEMPLATE', 'weapp')
      const updatedLayoutPageWxml = testSources
        .get(LAYOUT_PAGE_WXML)!
        .replaceAll('LAYOUTS-PAGE-TEMPLATE-BASE', layoutPageTemplateMarker)
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: LAYOUT_PAGE_WXML,
          distPath: LAYOUT_PAGE_WXML_DIST,
          nextSource: updatedLayoutPageWxml,
          marker: layoutPageTemplateMarker,
        }),
        'layout page template hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      await relaunchIdeRoute('/pages/layouts/index', layoutPageTemplateMarker, ctx)

      const layoutPageScriptMarker = createHmrMarker('IDE-CORE-LAYOUT-PAGE-SCRIPT', 'weapp')
      const updatedLayoutPageScript = testSources
        .get(LAYOUT_PAGE_SCRIPT)!
        .replace(`const layoutPageScriptMarker = 'LAYOUTS-PAGE-SCRIPT-BASE'`, `const layoutPageScriptMarker = '${layoutPageScriptMarker}'`)
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: LAYOUT_PAGE_SCRIPT,
          distPath: LAYOUT_PAGE_JS_DIST,
          nextSource: updatedLayoutPageScript,
          marker: layoutPageScriptMarker,
        }),
        'layout page script hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      await relaunchIdeRoute('/pages/layouts/index', undefined, ctx, {
        storageReady: {
          expected: layoutPageScriptMarker,
          field: 'marker',
          key: LAYOUT_SCRIPT_PROBE_STORAGE_KEY,
        },
      })

      const layoutPageStyleMarker = createHmrMarker('IDE-CORE-LAYOUT-PAGE-STYLE', 'weapp')
      const updatedLayoutPageStyle = testSources
        .get(LAYOUT_PAGE_STYLE)!
        .replace(`'LAYOUTS-PAGE-STYLE-BASE'`, `'${layoutPageStyleMarker}'`)
      const layoutPageStyleOutput = await dev.waitFor(
        updateSourceAndWait({
          sourcePath: LAYOUT_PAGE_STYLE,
          distPath: LAYOUT_PAGE_WXSS_DIST,
          nextSource: updatedLayoutPageStyle,
          marker: layoutPageStyleMarker,
        }),
        'layout page style hmr marker emitted',
      )
      expect(layoutPageStyleOutput).toContain(layoutPageStyleMarker)
      await waitForIdeRecompileSettled()
      await relaunchIdeRoute('/pages/layouts/index', undefined, ctx, {
        storageReady: {
          expected: layoutPageScriptMarker,
          field: 'marker',
          key: LAYOUT_SCRIPT_PROBE_STORAGE_KEY,
        },
      })

      const sharedStoreMarker = createHmrMarker('IDE-CORE-SHARED-STORE', 'weapp')
      const updatedSharedStore = replaceSharedStoreName(
        testSources.get(SHARED_STORE_PATH)!,
        sharedStoreMarker,
      )
      await replaceFileByRename(SHARED_STORE_PATH, updatedSharedStore)
      const sharedRuntime = await dev.waitFor(
        waitForSharedStoreMarker(sharedStoreMarker, updatedSharedStore),
        'shared store hmr marker emitted',
      )
      expect(sharedRuntime.code).toContain(sharedStoreMarker)
      expect(sharedRuntime.code).toContain('setupCounter')
      expect(sharedRuntime.code).toContain('optionsCounter')
      const [storePageOutput, storeSharePageOutput] = await Promise.all([
        fs.readFile(STORE_PAGE_JS_DIST, 'utf8'),
        fs.readFile(STORE_SHARE_PAGE_JS_DIST, 'utf8'),
      ])
      expect(storePageOutput).toContain(`require("${toRelativeImport(STORE_PAGE_JS_DIST, sharedRuntime.path)}")`)
      expect(storeSharePageOutput).toContain(`require("${toRelativeImport(STORE_SHARE_PAGE_JS_DIST, sharedRuntime.path)}")`)
      await waitForIdeRecompileSettled()
      await relaunchIdeRoute('/pages/store/index', undefined, ctx, {
        storageReady: {
          expected: 'store',
          field: 'name',
          key: STORE_E2E_RESULT_STORAGE_KEY,
          requireOk: true,
        },
      })
      await relaunchIdeRoute('/pages/store-share/index', undefined, ctx, {
        allowCurrentSession: true,
        storageReady: {
          expected: 'store-share',
          field: 'name',
          key: STORE_SHARE_E2E_RESULT_STORAGE_KEY,
          requireOk: true,
        },
      })
    }
    finally {
      await closeMiniProgram()
      await dev.stop(5_000)
      for (const [filePath, source] of originalSources) {
        await fs.writeFile(filePath, source, 'utf8')
      }
      await cleanupResidualIdeProcesses()
    }
  })
})
