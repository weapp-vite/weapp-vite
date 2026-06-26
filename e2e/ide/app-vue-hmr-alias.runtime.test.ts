import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'

const BRIDGE_POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH'
const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const AUTOMATOR_POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH'
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-vue-hmr-alias')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const APP_VUE_PATH = path.join(APP_ROOT, 'src/app.vue')
const LAYOUT_VUE_PATH = path.join(APP_ROOT, 'src/layouts/default.vue')
const PAGE_VUE_PATH = path.join(APP_ROOT, 'src/pages/index/index.vue')
const BOOTSTRAP_TS_PATH = path.join(APP_ROOT, 'src/bootstrap/index.ts')
const COMMON_JS_DIST = path.join(DIST_ROOT, 'common.js')
const APP_SHELL_WXML_DIST = path.join(DIST_ROOT, '__weapp_vite_app_shell.wxml')
const LAYOUT_WXML_DIST = path.join(DIST_ROOT, 'layouts/default.wxml')
const PAGE_JS_DIST = path.join(DIST_ROOT, 'pages/index/index.js')
const INDEX_ROUTE = '/pages/index/index'
const BASE_APP_MARKER = 'APP-VUE-HMR-ALIAS-APP-BASE'
const BASE_LAYOUT_MARKER = 'APP-VUE-HMR-ALIAS-LAYOUT-BASE'
const PAGE_MARKER = 'APP-VUE-HMR-ALIAS-PAGE'
const BOOTSTRAP_MARKER = 'app-vue-hmr-alias-bootstrap-ready'
const ALIAS_MODULE_MISSING_RE = /module ['"]@\/bootstrap(?:\.js)?['"] is not defined|require args is ['"]@\/bootstrap['"]/i
const MARKER_SELECTORS = [
  '.app-vue-hmr-alias-page',
  '.app-vue-hmr-alias-page__label',
  '.app-vue-hmr-alias-page__bootstrap',
] as const

interface RuntimeElementSnapshot {
  selector: string
  visible: boolean
  width: number
  height: number
}

interface RuntimeSnapshot {
  route: string
  pageData: Record<string, unknown>
  elements: RuntimeElementSnapshot[]
  visibleCount: number
}

let miniProgram: any = null
let devProcess: ReturnType<typeof startDevProcess> | undefined
let originalAppSource = ''
let originalLayoutSource = ''
let originalPageSource = ''
let originalBootstrapSource = ''
let previousAutomatorLaunchMode: string | undefined
let previousAutomatorPostConnectRefresh: string | undefined
let previousBridgePostConnectRefresh: string | undefined
let sharedInfraUnavailableMessage: string | null = null

async function readVisibleRuntimeSnapshot(miniProgram: any): Promise<RuntimeSnapshot> {
  const result = await miniProgram.evaluate(() => {
    return new Promise((resolve) => {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1]
      if (!page) {
        resolve({
          route: '',
          pageData: {},
          results: [],
        })
        return
      }
      const query = wx.createSelectorQuery().in(page)
      query.select('.app-vue-hmr-alias-page').fields({ size: true })
      query.select('.app-vue-hmr-alias-page__label').fields({ size: true })
      query.select('.app-vue-hmr-alias-page__bootstrap').fields({ size: true })
      query.exec(results => resolve({ route: page.route, pageData: page.data, results }))
    })
  }) as { route?: string, pageData?: Record<string, unknown>, results?: Array<{ width?: number, height?: number } | null> }
  const results = Array.isArray(result.results) ? result.results : []
  const elements = MARKER_SELECTORS.map((selector, index) => {
    const item = results[index]
    const width = Number(item?.width ?? 0)
    const height = Number(item?.height ?? 0)
    return {
      selector,
      visible: width > 0 && height > 0,
      width,
      height,
    }
  })
  return {
    route: String(result.route ?? ''),
    pageData: result.pageData ?? {},
    elements,
    visibleCount: elements.filter(item => item.visible).length,
  }
}

async function waitForVisibleRuntime(miniProgram: any, markers: string[], timeoutMs = 20_000) {
  const start = Date.now()
  let latest: RuntimeSnapshot | undefined
  while (Date.now() - start <= timeoutMs) {
    latest = await readVisibleRuntimeSnapshot(miniProgram).catch(error => ({
      route: '',
      pageData: {
        error: error instanceof Error ? error.message : String(error),
      },
      elements: [],
      visibleCount: 0,
    }))
    const dataText = JSON.stringify(latest.pageData)
    const routeReady = latest.route === 'pages/index/index'
    const visibleReady = latest.visibleCount === MARKER_SELECTORS.length
    const markersReady = markers.every(marker => dataText.includes(marker))
    if (routeReady && visibleReady && markersReady) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 260))
  }
  throw new Error(`Timed out waiting visible runtime markers ${markers.join(', ')}. latest=${JSON.stringify(latest)}`)
}

async function waitForCurrentRoute(miniProgram: any, timeoutMs = 15_000) {
  const start = Date.now()
  let latest: unknown
  while (Date.now() - start <= timeoutMs) {
    latest = await miniProgram.currentPage({ retries: 1, timeout: 5_000 }).catch((error: unknown) => ({
      error: error instanceof Error ? error.message : String(error),
    }))
    if ((latest as { path?: string })?.path === 'pages/index/index') {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting current route ${INDEX_ROUTE}. latest=${JSON.stringify(latest)}`)
}

async function waitForIdeHmrSettled(delayMs = 5_000) {
  await new Promise(resolve => setTimeout(resolve, delayMs))
}

async function relaunchIndexPage(miniProgram: any) {
  const page = await miniProgram.reLaunch(INDEX_ROUTE)
  await page.waitFor(5_000)
  return page
}

function replaceLayoutMarker(source: string, nextMarker: string) {
  const updated = source.replace(BASE_LAYOUT_MARKER, nextMarker)
  if (updated === source) {
    throw new Error('Failed to inject HMR marker into app-vue-hmr-alias layout.')
  }
  return updated
}

function replaceMarker(source: string, baseMarker: string, nextMarker: string, label: string) {
  const updated = source.replace(baseMarker, nextMarker)
  if (updated === source) {
    throw new Error(`Failed to inject HMR marker into ${label}.`)
  }
  return updated
}

async function readDistJsFiles() {
  const files = await fs.readdir(DIST_ROOT, { recursive: true })
  const entries: Array<{ file: string, content: string }> = []
  for (const file of files) {
    if (typeof file !== 'string' || !file.endsWith('.js')) {
      continue
    }
    const normalized = file.replaceAll('\\', '/')
    entries.push({
      file: normalized,
      content: await fs.readFile(path.join(DIST_ROOT, file), 'utf8'),
    })
  }
  return entries
}

async function assertDistJsKeepsBundledAliasMarker(marker: string) {
  await devProcess?.waitFor(waitForFileContains(COMMON_JS_DIST, marker), `dist keeps bundled bootstrap marker ${marker}`)
  const entries = await readDistJsFiles()
  expect(entries.some(entry => entry.content.includes(marker))).toBe(true)

  const aliasOffenders = entries
    .filter(entry =>
      entry.content.includes('@/bootstrap')
      || entry.content.includes('from "@/')
      || entry.content.includes('from \'@/')
      || entry.content.includes('require("@/')
      || entry.content.includes('require(\'@/'))
    .map(entry => entry.file)
  expect(aliasOffenders).toEqual([])
}

describe.sequential('app.vue alias import layout HMR runtime', () => {
  beforeAll(async () => {
    previousAutomatorLaunchMode = process.env[AUTOMATOR_LAUNCH_MODE_ENV]
    previousAutomatorPostConnectRefresh = process.env[AUTOMATOR_POST_CONNECT_REFRESH_ENV]
    previousBridgePostConnectRefresh = process.env[BRIDGE_POST_CONNECT_REFRESH_ENV]
    process.env[AUTOMATOR_LAUNCH_MODE_ENV] = 'direct'
    delete process.env[AUTOMATOR_POST_CONNECT_REFRESH_ENV]
    delete process.env[BRIDGE_POST_CONNECT_REFRESH_ENV]
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
    originalAppSource = await fs.readFile(APP_VUE_PATH, 'utf8')
    originalLayoutSource = await fs.readFile(LAYOUT_VUE_PATH, 'utf8')
    originalPageSource = await fs.readFile(PAGE_VUE_PATH, 'utf8')
    originalBootstrapSource = await fs.readFile(BOOTSTRAP_TS_PATH, 'utf8')
    await fs.remove(DIST_ROOT)

    devProcess = startDevProcess(process.execPath, [
      '--import',
      'tsx',
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

    await devProcess.waitFor(waitForFileContains(COMMON_JS_DIST, BOOTSTRAP_MARKER), 'initial common.js bundles aliased bootstrap import')

    try {
      miniProgram = await launchAutomator({
        projectPath: APP_ROOT,
        skipRelaunchPageRootCheck: true,
        skipWarmup: true,
        timeout: 120_000,
      })
    }
    catch (error) {
      if (isDevtoolsHttpPortError(error)) {
        sharedInfraUnavailableMessage = `WeChat DevTools 自动化环境不可用，跳过 app.vue alias HMR IDE runtime：${error instanceof Error ? error.message : String(error)}`
        return
      }
      throw error
    }
  }, 240_000)

  afterAll(async () => {
    await miniProgram?.disconnect?.()
    miniProgram = null
    await devProcess?.stop(5_000).catch(() => {})
    devProcess = undefined
    if (originalAppSource) {
      await fs.writeFile(APP_VUE_PATH, originalAppSource, 'utf8').catch(() => {})
    }
    if (originalLayoutSource) {
      await fs.writeFile(LAYOUT_VUE_PATH, originalLayoutSource, 'utf8').catch(() => {})
    }
    if (originalPageSource) {
      await fs.writeFile(PAGE_VUE_PATH, originalPageSource, 'utf8').catch(() => {})
    }
    if (originalBootstrapSource) {
      await fs.writeFile(BOOTSTRAP_TS_PATH, originalBootstrapSource, 'utf8').catch(() => {})
    }
    await cleanupResidualIdeProcesses()
    if (previousAutomatorLaunchMode == null) {
      delete process.env[AUTOMATOR_LAUNCH_MODE_ENV]
    }
    else {
      process.env[AUTOMATOR_LAUNCH_MODE_ENV] = previousAutomatorLaunchMode
    }
    if (previousAutomatorPostConnectRefresh == null) {
      delete process.env[AUTOMATOR_POST_CONNECT_REFRESH_ENV]
    }
    else {
      process.env[AUTOMATOR_POST_CONNECT_REFRESH_ENV] = previousAutomatorPostConnectRefresh
    }
    if (previousBridgePostConnectRefresh == null) {
      delete process.env[BRIDGE_POST_CONNECT_REFRESH_ENV]
    }
    else {
      process.env[BRIDGE_POST_CONNECT_REFRESH_ENV] = previousBridgePostConnectRefresh
    }
  })

  it('keeps visible page elements and bundled alias imports across app, layout, page, and dependency HMR', async (ctx) => {
    if (sharedInfraUnavailableMessage) {
      ctx.skip(sharedInfraUnavailableMessage)
    }
    if (!miniProgram || !devProcess) {
      throw new Error('app.vue alias HMR IDE runtime setup did not create DevTools session.')
    }

    const page = await waitForCurrentRoute(miniProgram)
    await page.waitFor(5_000)
    await waitForVisibleRuntime(miniProgram, [PAGE_MARKER, BOOTSTRAP_MARKER])
    await assertDistJsKeepsBundledAliasMarker(BOOTSTRAP_MARKER)

    const appMarker = createHmrMarker('APP-VUE-ALIAS-APP', 'weapp')
    await replaceFileByRename(APP_VUE_PATH, replaceMarker(originalAppSource, BASE_APP_MARKER, appMarker, 'app.vue'))
    await devProcess.waitFor(waitForFileContains(APP_SHELL_WXML_DIST, appMarker), 'updated app shell emitted')
    await assertDistJsKeepsBundledAliasMarker(BOOTSTRAP_MARKER)
    await waitForIdeHmrSettled()
    await waitForVisibleRuntime(miniProgram, [PAGE_MARKER, BOOTSTRAP_MARKER])

    const layoutMarker = createHmrMarker('APP-VUE-ALIAS-LAYOUT', 'weapp')
    await replaceFileByRename(LAYOUT_VUE_PATH, replaceLayoutMarker(originalLayoutSource, layoutMarker))
    await devProcess.waitFor(waitForFileContains(LAYOUT_WXML_DIST, layoutMarker), 'updated layout emitted')
    await assertDistJsKeepsBundledAliasMarker(BOOTSTRAP_MARKER)
    await waitForIdeHmrSettled()
    await waitForVisibleRuntime(miniProgram, [PAGE_MARKER, BOOTSTRAP_MARKER])

    const pageMarker = createHmrMarker('APP-VUE-ALIAS-PAGE', 'weapp')
    await replaceFileByRename(PAGE_VUE_PATH, replaceMarker(originalPageSource, PAGE_MARKER, pageMarker, 'index page'))
    await devProcess.waitFor(waitForFileContains(PAGE_JS_DIST, pageMarker), 'updated page script emitted')
    await assertDistJsKeepsBundledAliasMarker(BOOTSTRAP_MARKER)
    await waitForIdeHmrSettled()
    await relaunchIndexPage(miniProgram)
    await waitForVisibleRuntime(miniProgram, [pageMarker, BOOTSTRAP_MARKER])

    const bootstrapMarker = createHmrMarker('APP-VUE-ALIAS-BOOTSTRAP', 'weapp')
    await replaceFileByRename(BOOTSTRAP_TS_PATH, replaceMarker(originalBootstrapSource, BOOTSTRAP_MARKER, bootstrapMarker, 'bootstrap alias module'))
    await assertDistJsKeepsBundledAliasMarker(bootstrapMarker)
    await waitForIdeHmrSettled()
    await relaunchIndexPage(miniProgram)
    await waitForVisibleRuntime(miniProgram, [pageMarker, bootstrapMarker])

    expect(devProcess.getOutput()).not.toMatch(ALIAS_MODULE_MISSING_RE)
  })
})
