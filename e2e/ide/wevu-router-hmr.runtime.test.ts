import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-router-hmr')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const COMMON_JS_PATH = path.join(DIST_ROOT, 'common.js')
const PAGE_VUE_PATH = path.join(APP_ROOT, 'src/pages/index/index.vue')
const PAGE_JS_PATH = path.join(DIST_ROOT, 'pages/index/index.js')
const INDEX_ROUTE = '/pages/index/index'
const BASE_MARKER = 'ROUTER-HMR-BASE'
const ROUTER_HMR_MARKER_KEY = '__wevuRouterHmrMarker'
const BARE_WEVU_ROUTER_RE = /from\s+['"]wevu\/router['"]|require\(\s*['"]wevu\/router['"]\s*\)/
const DEVTOOLS_ROUTE_INFRA_RE = /Timeout in raw reLaunch|Timeout in read current page|DEVTOOLS_PROTOCOL_TIMEOUT|simulator not found|模拟器启动失败/i

function isDevtoolsRouteInfraError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return isDevtoolsHttpPortError(error) || DEVTOOLS_ROUTE_INFRA_RE.test(message)
}

async function readRouterHmrState(miniProgram: any) {
  return await miniProgram.evaluate((markerKey: string) => {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const page = pages[pages.length - 1] as any
    const app = typeof getApp === 'function' ? getApp() as any : {}
    const data = page?.data ?? {}
    return {
      marker: app?.[markerKey] ?? data.title ?? data.marker,
      route: page?.route ?? page?.path ?? page?.__route__ ?? '',
    }
  }, ROUTER_HMR_MARKER_KEY)
}

async function waitForPageReady(miniProgram: any, marker: string, timeoutMs = 15_000) {
  const start = Date.now()
  let latest: unknown = null
  while (Date.now() - start <= timeoutMs) {
    latest = await readRouterHmrState(miniProgram).catch((error: unknown) => error)
    if (latest && typeof latest === 'object' && 'route' in latest) {
      const result = latest as { marker?: unknown, route?: unknown }
      if (result.marker === marker || result.route === 'pages/index/index') {
        return latest
      }
    }
    await new Promise(resolve => setTimeout(resolve, 220))
  }
  throw new Error(`Timed out waiting for router HMR page marker ${marker}. latest=${JSON.stringify(latest)}`)
}

async function relaunchAndWaitForMarker(miniProgram: any, marker: string) {
  const page = await miniProgram.reLaunch(INDEX_ROUTE)
  if (!page) {
    throw new Error(`Failed to launch ${INDEX_ROUTE}`)
  }
  const result = await waitForPageReady(miniProgram, marker)
  expect(result).toMatchObject({
    route: 'pages/index/index',
  })
  return page
}

function replaceMarker(source: string, nextMarker: string) {
  const updated = source.replace(BASE_MARKER, nextMarker)
  if (updated === source) {
    throw new Error('Failed to inject HMR marker into router page.')
  }
  return updated
}

async function assertNoBareWevuRouterImport() {
  const files = await fs.readdir(DIST_ROOT, { recursive: true })
  const offenders: string[] = []

  for (const file of files) {
    if (typeof file !== 'string' || !file.endsWith('.js')) {
      continue
    }
    const filePath = path.join(DIST_ROOT, file)
    const content = await fs.readFile(filePath, 'utf8')
    if (BARE_WEVU_ROUTER_RE.test(content)) {
      offenders.push(file.replaceAll('\\', '/'))
    }
  }

  expect(offenders).toEqual([])
}

let miniProgram: any = null
let devProcess: ReturnType<typeof startDevProcess> | undefined
let originalPageSource = ''
let sharedInfraUnavailableMessage: string | null = null

describe.sequential('wevu/router HMR fixture runtime', () => {
  beforeAll(async () => {
    await cleanupResidualDevProcesses()
    originalPageSource = await fs.readFile(PAGE_VUE_PATH, 'utf8')
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

    await devProcess.waitFor(waitForFileContains(PAGE_JS_PATH, BASE_MARKER), 'initial router page script emitted')
    await devProcess.waitFor(waitForFileContains(COMMON_JS_PATH, 'weapp-vendors/wevu-router.js'), 'initial common.js imports wevu router vendor')

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
        sharedInfraUnavailableMessage = `WeChat DevTools 自动化环境不可用，跳过 wevu/router HMR IDE runtime：${error instanceof Error ? error.message : String(error)}`
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
    if (originalPageSource) {
      await fs.writeFile(PAGE_VUE_PATH, originalPageSource, 'utf8').catch(() => {})
    }
    await cleanupResidualDevProcesses()
  })

  it('keeps wevu/router resolved after saving a page in real DevTools HMR', async (ctx) => {
    if (sharedInfraUnavailableMessage) {
      ctx.skip(sharedInfraUnavailableMessage)
    }
    if (!miniProgram || !devProcess) {
      throw new Error('wevu/router HMR IDE runtime setup did not create DevTools session.')
    }

    const marker = createHmrMarker('WEVU-ROUTER-IDE-HMR', 'weapp')
    const updatedPageSource = replaceMarker(originalPageSource, marker)

    const collector = attachRuntimeErrorCollector(miniProgram)
    try {
      const beforeHmr = collector.mark()
      try {
        await relaunchAndWaitForMarker(miniProgram, BASE_MARKER)
      }
      catch (error) {
        if (isDevtoolsRouteInfraError(error)) {
          ctx.skip(`WeChat DevTools 页面路由协议不可用，跳过 wevu/router HMR IDE runtime：${error instanceof Error ? error.message : String(error)}`)
        }
        throw error
      }
      expect(collector.getSince(beforeHmr)).not.toEqual(expect.arrayContaining([
        expect.stringContaining('wevu/router'),
      ]))

      const afterHmr = collector.mark()
      await replaceFileByRename(PAGE_VUE_PATH, updatedPageSource)
      await devProcess.waitFor(waitForFileContains(PAGE_JS_PATH, marker), 'updated router page script emitted')
      await devProcess.waitFor(waitForFileContains(COMMON_JS_PATH, 'weapp-vendors/wevu-router.js'), 'common.js keeps router vendor after HMR')

      try {
        await relaunchAndWaitForMarker(miniProgram, marker)
      }
      catch (error) {
        if (isDevtoolsRouteInfraError(error)) {
          ctx.skip(`WeChat DevTools 页面路由协议不可用，跳过 wevu/router HMR IDE runtime：${error instanceof Error ? error.message : String(error)}`)
        }
        throw error
      }
      await assertNoBareWevuRouterImport()
      expect(collector.getSince(afterHmr)).not.toEqual(expect.arrayContaining([
        expect.stringContaining('wevu/router'),
      ]))
      expect(devProcess.getOutput()).not.toContain('module \'wevu/router.js\' is not defined')
    }
    finally {
      collector.dispose()
    }
  })
})
