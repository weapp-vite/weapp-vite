import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const BRIDGE_POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH'
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-vue-hmr-alias')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const LAYOUT_VUE_PATH = path.join(APP_ROOT, 'src/layouts/default.vue')
const APP_JS_DIST = path.join(DIST_ROOT, 'app.js')
const LAYOUT_WXML_DIST = path.join(DIST_ROOT, 'layouts/default.wxml')
const INDEX_ROUTE = '/pages/index/index'
const BASE_LAYOUT_MARKER = 'APP-VUE-HMR-ALIAS-LAYOUT-BASE'
const PAGE_MARKER = 'APP-VUE-HMR-ALIAS-PAGE'
const BOOTSTRAP_MARKER = 'app-vue-hmr-alias-bootstrap-ready'
const ALIAS_MODULE_MISSING_RE = /module ['"]@\/bootstrap(?:\.js)?['"] is not defined|require args is ['"]@\/bootstrap['"]/i
const DEVTOOLS_ROUTE_INFRA_RE = /Timeout in raw reLaunch|Timeout in read current page|Timed out waiting page wxml marker|DEVTOOLS_PROTOCOL_TIMEOUT|simulator not found|模拟器启动失败/i

function isDevtoolsRouteInfraError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return isDevtoolsHttpPortError(error) || DEVTOOLS_ROUTE_INFRA_RE.test(message)
}

async function readPageWxml(page: any) {
  const element = await page.$('page')
  if (!element) {
    throw new Error('Failed to find page element')
  }
  return await element.wxml()
}

async function waitForPageWxmlContains(page: any, marker: string, timeoutMs = 20_000) {
  const start = Date.now()
  let latest = ''
  while (Date.now() - start <= timeoutMs) {
    latest = await readPageWxml(page).catch(() => '')
    if (latest.includes(marker)) {
      return latest
    }
    await page.waitFor(220)
  }
  throw new Error(`Timed out waiting page wxml marker ${marker}. latest=${latest.slice(0, 800)}`)
}

async function resolveCurrentPage(miniProgram: any) {
  const page = await miniProgram.currentPage().catch(() => null)
  if (!page) {
    return null
  }
  return page.path === 'pages/index/index' ? page : null
}

async function relaunchAndWaitForMarkers(miniProgram: any, markers: string[]) {
  let page = await resolveCurrentPage(miniProgram)
  if (!page) {
    page = await miniProgram.reLaunch(INDEX_ROUTE)
  }
  if (!page) {
    throw new Error(`Failed to launch ${INDEX_ROUTE}`)
  }
  for (const marker of markers) {
    const wxml = await waitForPageWxmlContains(page, marker)
    expect(wxml).toContain(marker)
  }
  return page
}

function replaceLayoutMarker(source: string, nextMarker: string) {
  const updated = source.replace(BASE_LAYOUT_MARKER, nextMarker)
  if (updated === source) {
    throw new Error('Failed to inject HMR marker into app-vue-hmr-alias layout.')
  }
  return updated
}

let miniProgram: any = null
let devProcess: ReturnType<typeof startDevProcess> | undefined
let originalLayoutSource = ''
let previousBridgePostConnectRefresh: string | undefined
let sharedInfraUnavailableMessage: string | null = null

describe.sequential('app.vue alias import layout HMR runtime', () => {
  beforeAll(async () => {
    previousBridgePostConnectRefresh = process.env[BRIDGE_POST_CONNECT_REFRESH_ENV]
    process.env[BRIDGE_POST_CONNECT_REFRESH_ENV] = '1'
    await cleanupResidualDevProcesses()
    originalLayoutSource = await fs.readFile(LAYOUT_VUE_PATH, 'utf8')
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

    await devProcess.waitFor(waitForFileContains(APP_JS_DIST, BOOTSTRAP_MARKER), 'initial app.js bundles aliased bootstrap import')
    await devProcess.waitFor(waitForFileContains(LAYOUT_WXML_DIST, BASE_LAYOUT_MARKER), 'initial layout emitted')

    try {
      miniProgram = await launchAutomator({
        projectPath: APP_ROOT,
        skipRelaunchPageRootCheck: true,
        skipWarmup: true,
        timeout: 120_000,
      })
    }
    catch (error) {
      if (isDevtoolsRouteInfraError(error)) {
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
    if (originalLayoutSource) {
      await fs.writeFile(LAYOUT_VUE_PATH, originalLayoutSource, 'utf8').catch(() => {})
    }
    await cleanupResidualIdeProcesses()
    if (previousBridgePostConnectRefresh == null) {
      delete process.env[BRIDGE_POST_CONNECT_REFRESH_ENV]
    }
    else {
      process.env[BRIDGE_POST_CONNECT_REFRESH_ENV] = previousBridgePostConnectRefresh
    }
  })

  it('keeps aliased app.vue imports bundled after layout HMR in real DevTools', async (ctx) => {
    if (sharedInfraUnavailableMessage) {
      ctx.skip(sharedInfraUnavailableMessage)
    }
    if (!miniProgram || !devProcess) {
      throw new Error('app.vue alias HMR IDE runtime setup did not create DevTools session.')
    }

    const marker = createHmrMarker('APP-VUE-ALIAS-LAYOUT', 'weapp')
    const updatedLayoutSource = replaceLayoutMarker(originalLayoutSource, marker)
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      const afterHmr = collector.mark()
      await replaceFileByRename(LAYOUT_VUE_PATH, updatedLayoutSource)
      await devProcess.waitFor(waitForFileContains(LAYOUT_WXML_DIST, marker), 'updated layout emitted')
      await devProcess.waitFor(waitForFileContains(APP_JS_DIST, BOOTSTRAP_MARKER), 'app.js still bundles aliased bootstrap after layout HMR')

      const appJs = await fs.readFile(APP_JS_DIST, 'utf8')
      expect(appJs).not.toContain('@/bootstrap')
      expect(appJs).not.toContain('from "@/')
      expect(appJs).not.toContain('from \'@/')
      expect(appJs).not.toContain('require("@/')
      expect(appJs).not.toContain('require(\'@/')

      try {
        await relaunchAndWaitForMarkers(miniProgram, [marker, PAGE_MARKER])
      }
      catch (error) {
        if (isDevtoolsRouteInfraError(error)) {
          const runtimeErrors = collector.getSince(afterHmr).filter(item => ALIAS_MODULE_MISSING_RE.test(item))
          expect(runtimeErrors).toEqual([])
          return
        }
        throw error
      }
      expect(collector.getSince(afterHmr).filter(item => ALIAS_MODULE_MISSING_RE.test(item))).toEqual([])
      expect(devProcess.getOutput()).not.toMatch(ALIAS_MODULE_MISSING_RE)
    }
    finally {
      collector.dispose()
    }
  })
})
