import type { TestJsFormat } from '../utils/jsFormat'
import { rm } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import {
  waitForRequestClientsRealRouteDom,
  waitForRequestClientsRealSuccessDom,
} from '../utils/requestClientsRealDom'
import {
  REQUEST_CLIENTS_REAL_REQUEST_DEFAULTS,
  REQUEST_CLIENTS_REAL_SOCKET_DEFAULTS,
} from '../utils/requestClientsRealHostTraceRuntime'
import { startRequestClientsRealServer } from '../utils/requestClientsRealServer'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/request-clients-real')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

const LOCAL_SERVER_INFRA_ERROR_PATTERNS = [
  /listen EPERM/i,
  /operation not permitted/i,
  /EACCES/i,
]
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'
const JS_FORMATS: TestJsFormat[] = ['cjs']

let baseUrl = ''
let serverHandle: Awaited<ReturnType<typeof startRequestClientsRealServer>> | null = null
let sharedInfraUnavailableMessage = ''
const preparedBuildFormats = new Set<TestJsFormat>()

function isLocalServerInfraError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return LOCAL_SERVER_INFRA_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

function isRecoverableAutomatorSessionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Connection closed')
    || message.includes('Target closed')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
    || message.includes('Execution context was destroyed')
    || message.includes('DEVTOOLS_PROTOCOL_TIMEOUT')
    || message.includes('DevTools did not respond to protocol method')
    || message.includes('Timeout in raw reLaunch')
    || (typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'DEVTOOLS_PROTOCOL_TIMEOUT')
}

async function ensureBuilt(jsFormat: TestJsFormat) {
  if (preparedBuildFormats.has(jsFormat)) {
    return
  }

  await cleanDevtoolsCache('all', { cwd: APP_ROOT })
  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    jsFormat,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: `ide:request-clients-real:${jsFormat}`,
  })
  preparedBuildFormats.add(jsFormat)
}

function withBaseUrl(route: string) {
  return `${route}?baseUrl=${encodeURIComponent(baseUrl)}`
}

async function waitForVueQueryFinalData(page: any) {
  const startedAt = Date.now()
  let latestData: any
  while (Date.now() - startedAt <= 20_000) {
    latestData = await page.data()
    if (
      latestData?.statusText === '数据就绪'
      && latestData?.selectedTab === 'detail'
      && latestData?.refreshSeed === 1
      && JSON.stringify(latestData?.queryKey) === JSON.stringify(['request-clients-real', 'detail', 1])
    ) {
      return latestData
    }
    await page.waitFor(120)
  }
  throw new Error(`timed out waiting for vue-query final page data: ${JSON.stringify(latestData)}`)
}

async function readHostTrace(miniProgram: any) {
  return await miniProgram.evaluate(() => {
    const trace = getApp<{
      globalData?: {
        requestHostTrace?: {
          requestCalls?: Record<string, unknown>[]
          socketCalls?: Record<string, unknown>[]
        }
      }
    }>()?.globalData?.requestHostTrace

    return {
      requestCalls: Array.isArray(trace?.requestCalls) ? trace.requestCalls : [],
      socketCalls: Array.isArray(trace?.socketCalls) ? trace.socketCalls : [],
    }
  }) as {
    requestCalls: Array<Record<string, unknown>>
    socketCalls: Array<Record<string, unknown>>
  }
}

function findLatestTrace(calls: Array<Record<string, unknown>>, urlFragment: string) {
  return [...calls].reverse().find(call => typeof call.url === 'string' && call.url.includes(urlFragment))
}

function expectRequestTrace(calls: Array<Record<string, unknown>>, urlFragment: string) {
  const trace = findLatestTrace(calls, urlFragment)
  expect(trace, `missing request trace for ${urlFragment}: ${JSON.stringify(calls)}`).toBeTruthy()
  expect(trace).toMatchObject({
    timeout: REQUEST_CLIENTS_REAL_REQUEST_DEFAULTS.timeout,
  })
}

function expectSocketTrace(
  calls: Array<Record<string, unknown>>,
  urlFragment: string,
  expected: {
    perMessageDeflate: boolean
    timeout?: number
  },
) {
  const trace = findLatestTrace(calls, urlFragment)
  expect(trace, `missing socket trace for ${urlFragment}: ${JSON.stringify(calls)}`).toBeTruthy()
  expect(trace).toMatchObject(expected)
}

beforeAll(async () => {
  try {
    serverHandle = await startRequestClientsRealServer()
    baseUrl = serverHandle.baseUrl
  }
  catch (error) {
    if (isLocalServerInfraError(error)) {
      sharedInfraUnavailableMessage = '本地测试服务基础设施不可用，跳过 request-clients-real IDE 自动化用例。'
      return
    }
    throw error
  }
})

afterAll(async () => {
  if (serverHandle) {
    await serverHandle.stop()
  }
})

for (const jsFormat of JS_FORMATS) {
  describe(`e2e app: request-clients-real [${jsFormat}]`, { concurrent: false }, () => {
    let miniProgram: any = null

    async function getMiniProgram(ctx: { skip: (message?: string) => void }) {
      if (miniProgram) {
        return miniProgram
      }

      await ensureBuilt(jsFormat)

      try {
        await cleanupResidualIdeProcesses()
        const previousSkipWarmup = process.env[AUTOMATOR_SKIP_WARMUP_ENV]
        try {
          delete process.env[AUTOMATOR_SKIP_WARMUP_ENV]
          miniProgram = await launchAutomator({
            projectPath: APP_ROOT,
            retryWarmupTimeout: true,
            skipRelaunchPageRootCheck: true,
            warmupRootSelectors: ['#request-clients-real-root'],
            warmupRoute: '/pages/index/index',
          })
        }
        finally {
          if (previousSkipWarmup == null) {
            delete process.env[AUTOMATOR_SKIP_WARMUP_ENV]
          }
          else {
            process.env[AUTOMATOR_SKIP_WARMUP_ENV] = previousSkipWarmup
          }
        }
        return miniProgram
      }
      catch (error) {
        if (isDevtoolsHttpPortError(error)) {
          ctx.skip('WeChat DevTools 服务端口未开启，跳过 request-clients-real IDE 自动化用例。')
        }
        throw error
      }
    }

    async function resetMiniProgram() {
      if (miniProgram) {
        await miniProgram.close().catch(() => {})
        miniProgram = null
      }
      await cleanupResidualIdeProcesses()
    }

    async function reLaunchPage(ctx: { skip: (message?: string) => void }, route: string) {
      let lastError: unknown
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const currentMiniProgram = await getMiniProgram(ctx)
        try {
          const page = await currentMiniProgram.reLaunch(route)
          if (!page) {
            throw new Error(`Failed to launch ${route}`)
          }
          await waitForRequestClientsRealRouteDom(page, route)
          return {
            miniProgram: currentMiniProgram,
            page,
          }
        }
        catch (error) {
          lastError = error
          if (attempt === 2 || !isRecoverableAutomatorSessionError(error)) {
            throw error
          }
          await resetMiniProgram()
        }
      }
      throw lastError
    }

    async function openTracedPage(ctx: { skip: (message?: string) => void }, route: string) {
      let lastError: unknown
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const currentMiniProgram = await getMiniProgram(ctx)
        try {
          const baselineTrace = await readHostTrace(currentMiniProgram)
          const page = await currentMiniProgram.reLaunch(route)
          if (!page) {
            throw new Error(`Failed to launch ${route}`)
          }
          await waitForRequestClientsRealRouteDom(page, route)
          return {
            baselineTrace,
            miniProgram: currentMiniProgram,
            page,
          }
        }
        catch (error) {
          lastError = error
          if (attempt === 2 || !isRecoverableAutomatorSessionError(error)) {
            throw error
          }
          await resetMiniProgram()
        }
      }
      throw lastError
    }

    afterAll(async () => {
      await resetMiniProgram()
    })

    it('exposes request globals from the Vue app runtime entry', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const { miniProgram } = await reLaunchPage(ctx, '/pages/index/index')

      const appProbe = await miniProgram.evaluate(() => {
        return {
          fetchType: typeof fetch,
          urlAvailable: (() => {
            try {
              return new URL('https://request-globals.invalid').protocol === 'https:'
            }
            catch {
              return false
            }
          })(),
          webSocketAvailable: typeof WebSocket === 'function',
          xmlHttpRequestAvailable: typeof XMLHttpRequest === 'function',
        }
      })

      expect(appProbe, JSON.stringify(appProbe)).toEqual({
        fetchType: 'function',
        urlAvailable: true,
        webSocketAvailable: true,
        xmlHttpRequestAvailable: true,
      })
    })

    it('covers fetch against a local real server', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const { baselineTrace, miniProgram, page } = await openTracedPage(ctx, withBaseUrl('/pages/fetch/index'))

      await page.callMethod('runE2E')
      await waitForRequestClientsRealSuccessDom(page, '/pages/fetch/index')
      const snapshot = await page.data('state')
      const currentTrace = await readHostTrace(miniProgram)
      const newRequestCalls = currentTrace.requestCalls.slice(baselineTrace.requestCalls.length)
      expect(snapshot?.requestPath, JSON.stringify({ snapshot, requestCounts: serverHandle?.requestCounts })).toBe('/fetch')
      expect(snapshot?.payload).toContain('"transport":"fetch"')
      expect(snapshot?.pageStatus).toBe('全部通过')
      expectRequestTrace(newRequestCalls, '/fetch')
    })

    it('covers axios against a local real server', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const { baselineTrace, miniProgram, page } = await openTracedPage(ctx, withBaseUrl('/pages/axios/index'))

      await page.callMethod('runE2E')
      await waitForRequestClientsRealSuccessDom(page, '/pages/axios/index')
      const snapshot = await page.data('state')
      const currentTrace = await readHostTrace(miniProgram)
      const newRequestCalls = currentTrace.requestCalls.slice(baselineTrace.requestCalls.length)
      expect(snapshot?.requestPath, JSON.stringify({ snapshot, requestCounts: serverHandle?.requestCounts })).toBe('/axios')
      expect(snapshot?.payload).toContain('"transport":"axios"')
      expect(snapshot?.pageStatus).toBe('全部通过')
      expectRequestTrace(newRequestCalls, '/axios')
    })

    it('covers graphql-request against a local real server', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const { baselineTrace, miniProgram, page } = await openTracedPage(ctx, withBaseUrl('/pages/graphql-request/index'))

      await page.callMethod('runE2E')
      await waitForRequestClientsRealSuccessDom(page, '/pages/graphql-request/index')
      const snapshot = await page.data('state')
      const currentTrace = await readHostTrace(miniProgram)
      const newRequestCalls = currentTrace.requestCalls.slice(baselineTrace.requestCalls.length)
      expect(snapshot?.requestPath, JSON.stringify({ snapshot, requestCounts: serverHandle?.requestCounts })).toBe('/graphql')
      expect(snapshot?.payload).toContain('"client":"graphql-request"')
      expect(snapshot?.pageStatus).toBe('全部通过')
      expectRequestTrace(newRequestCalls, '/graphql')
    })

    it('covers vue-query with tab switch, refetch and query key rotation against a local real server', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const { baselineTrace, miniProgram, page } = await openTracedPage(ctx, withBaseUrl('/pages/vue-query/index'))

      await page.callMethod('runE2E')
      const pageData = await waitForVueQueryFinalData(page)
      await waitForRequestClientsRealSuccessDom(page, '/pages/vue-query/index')
      const currentTrace = await readHostTrace(miniProgram)
      const newRequestCalls = currentTrace.requestCalls.slice(baselineTrace.requestCalls.length)
      const vueQueryUrls = newRequestCalls
        .map(call => String(call.url ?? ''))
        .filter(url => url.includes('/vue-query'))
      expect(pageData?.statusText, JSON.stringify({ pageData, requestCounts: serverHandle?.requestCounts })).toBe('数据就绪')
      expect(pageData?.selectedTab).toBe('detail')
      expect(pageData?.refreshSeed).toBe(1)
      expect(pageData?.queryKey).toEqual(['request-clients-real', 'detail', 1])
      expect(pageData?.requestCountText).toBeGreaterThan(0)
      expect(vueQueryUrls.some(url => url.includes('tab=overview&seed=0'))).toBe(true)
      expect(vueQueryUrls.filter(url => url.includes('tab=detail&seed=0'))).toHaveLength(2)
      expect(vueQueryUrls.some(url => url.includes('tab=detail&seed=1'))).toBe(true)
      expectRequestTrace(newRequestCalls, '/vue-query')
    })

    it('covers socket.io-client against a local real realtime server', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const { baselineTrace, miniProgram, page } = await openTracedPage(ctx, withBaseUrl('/pages/socket-io/index'))

      await page.callMethod('runE2E')
      await waitForRequestClientsRealSuccessDom(page, '/pages/socket-io/index')
      const pageData = await page.data()
      const snapshot = pageData?.state
      const currentTrace = await readHostTrace(miniProgram)
      const newSocketCalls = currentTrace.socketCalls.slice(baselineTrace.socketCalls.length)
      expect(snapshot?.requestPath, JSON.stringify({ snapshot, requestCounts: serverHandle?.requestCounts })).toBe('/socket.io')
      expect(snapshot?.payload).toContain('"client":"socket.io-client"')
      expect(snapshot?.payload).toContain('"serverRandomReceived":true')
      expect(snapshot?.payload).toContain('"websocketOnlyConnected":true')
      expect(pageData?.latestRandomMessage).toBeTruthy()
      expect(pageData?.randomPushCount).toBeGreaterThan(0)
      expect(['polling', 'websocket']).toContain(pageData?.defaultTransportName)
      expect(pageData?.websocketOnlyTransportName).toBe('websocket')
      expect(serverHandle?.requestCounts.socketIo).toBeGreaterThan(0)
      expect(snapshot?.pageStatus).toBe('全部通过')
      expectSocketTrace(newSocketCalls, '/socket.io', {
        perMessageDeflate: REQUEST_CLIENTS_REAL_SOCKET_DEFAULTS.perMessageDeflate,
      })
    })

    it('covers native WebSocket against a local real realtime server', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const { baselineTrace, miniProgram, page } = await openTracedPage(ctx, withBaseUrl('/pages/websocket/index'))

      await page.callMethod('runE2E')
      await waitForRequestClientsRealSuccessDom(page, '/pages/websocket/index')
      const pageData = await page.data()
      const snapshot = pageData?.state
      const currentTrace = await readHostTrace(miniProgram)
      const newSocketCalls = currentTrace.socketCalls.slice(baselineTrace.socketCalls.length)
      expect(snapshot?.requestPath, JSON.stringify({ snapshot, requestCounts: serverHandle?.requestCounts })).toBe('/ws')
      expect(snapshot?.payload).toContain('"client":"native-websocket"')
      expect(snapshot?.payload).toContain('"serverRandomEvent":"server-random"')
      expect(snapshot?.payload).toContain('"transport":"websocket"')
      expect(pageData?.connectedReadyState).toBe(1)
      expect(pageData?.latestRandomMessage).toBeTruthy()
      expect(pageData?.randomPushCount).toBeGreaterThan(0)
      expect(snapshot?.pageStatus).toBe('全部通过')
      expectSocketTrace(newSocketCalls, '/ws', {
        perMessageDeflate: REQUEST_CLIENTS_REAL_SOCKET_DEFAULTS.perMessageDeflate,
        timeout: REQUEST_CLIENTS_REAL_SOCKET_DEFAULTS.timeout,
      })
    })
  })
}
