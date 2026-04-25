import type { TestJsFormat } from '../utils/jsFormat'
import { rm } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import {
  REQUEST_CLIENTS_REAL_REQUEST_DEFAULTS,
  REQUEST_CLIENTS_REAL_SOCKET_DEFAULTS,
} from '../utils/requestClientsRealHostTraceRuntime'
import { startRequestClientsRealServer } from '../utils/requestClientsRealServer'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/request-clients-real-native')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

const LOCAL_SERVER_INFRA_ERROR_PATTERNS = [
  /listen EPERM/i,
  /operation not permitted/i,
  /EACCES/i,
]
const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'
const JS_FORMATS: TestJsFormat[] = ['esm', 'cjs']

let baseUrl = ''
let serverHandle: Awaited<ReturnType<typeof startRequestClientsRealServer>> | null = null
let sharedInfraUnavailableMessage = ''
const preparedBuildFormats = new Set<TestJsFormat>()

function isLocalServerInfraError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return LOCAL_SERVER_INFRA_ERROR_PATTERNS.some(pattern => pattern.test(message))
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
    label: `ide:request-clients-real-native:${jsFormat}`,
  })
  preparedBuildFormats.add(jsFormat)
}

function withBaseUrl(route: string) {
  return `${route}?baseUrl=${encodeURIComponent(baseUrl)}`
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
      sharedInfraUnavailableMessage = '本地测试服务基础设施不可用，跳过 request-clients-real-native IDE 自动化用例。'
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
  const describeForJsFormat = jsFormat === 'esm' ? describe.skip : describe.sequential

  // 微信开发者工具 3.15.x 在原生 App 根入口的 ESM appservice 装载阶段，
  // 会把根目录 request runtime 辅助 chunk 转成未注册的 require 模块。
  // CI 构建测试继续覆盖 ESM 产物形态，IDE runtime 保留 CJS 真运行链路。
  describeForJsFormat(`e2e app: request-clients-real-native [${jsFormat}]`, () => {
    let miniProgram: any = null

    async function getMiniProgram(ctx: { skip: (message?: string) => void }) {
      if (miniProgram) {
        return miniProgram
      }

      await ensureBuilt(jsFormat)

      try {
        await cleanupResidualIdeProcesses()
        const previousLaunchMode = process.env[AUTOMATOR_LAUNCH_MODE_ENV]
        const previousSkipWarmup = process.env[AUTOMATOR_SKIP_WARMUP_ENV]
        try {
          delete process.env[AUTOMATOR_LAUNCH_MODE_ENV]
          delete process.env[AUTOMATOR_SKIP_WARMUP_ENV]
          miniProgram = await launchAutomator({
            projectPath: APP_ROOT,
          })
        }
        finally {
          if (previousLaunchMode == null) {
            delete process.env[AUTOMATOR_LAUNCH_MODE_ENV]
          }
          else {
            process.env[AUTOMATOR_LAUNCH_MODE_ENV] = previousLaunchMode
          }
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
          ctx.skip('WeChat DevTools 服务端口未开启，跳过 request-clients-real-native IDE 自动化用例。')
        }
        throw error
      }
    }

    afterAll(async () => {
      if (miniProgram) {
        await miniProgram.close()
      }
      await cleanupResidualIdeProcesses()
    })

    it('covers app-level request globals probe from a native app entry', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const miniProgram = await getMiniProgram(ctx)
      const page = await miniProgram.reLaunch('/pages/index/index')
      if (!page) {
        throw new Error('Failed to launch /pages/index/index')
      }

      const appProbe = await miniProgram.evaluate(() => {
        return getApp<{ globalData?: { requestGlobalsProbe?: Record<string, unknown> } }>()?.globalData?.requestGlobalsProbe ?? null
      })

      expect(appProbe, JSON.stringify(appProbe)).toEqual({
        fetchType: 'function',
        urlAvailable: true,
        xmlHttpRequestAvailable: true,
        webSocketAvailable: true,
      })
    })

    it('covers fetch against a local real server', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const miniProgram = await getMiniProgram(ctx)
      const baselineTrace = await readHostTrace(miniProgram)
      const page = await miniProgram.reLaunch(withBaseUrl('/pages/fetch/index'))
      if (!page) {
        throw new Error('Failed to launch /pages/fetch/index')
      }

      const result = await page.callMethod('runE2E')
      const currentTrace = await readHostTrace(miniProgram)
      const newRequestCalls = currentTrace.requestCalls.slice(baselineTrace.requestCalls.length)
      expect(result?.ok, JSON.stringify({ result, requestCounts: serverHandle?.requestCounts })).toBe(true)
      expect(result?.snapshot?.requestPath).toBe('/fetch')
      expect(result?.snapshot?.payload).toContain('"transport":"fetch"')
      expect(result?.snapshot?.pageStatus).toBe('全部通过')
      expectRequestTrace(newRequestCalls, '/fetch')
    })

    it('covers axios against a local real server', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const miniProgram = await getMiniProgram(ctx)
      const baselineTrace = await readHostTrace(miniProgram)
      const page = await miniProgram.reLaunch(withBaseUrl('/pages/axios/index'))
      if (!page) {
        throw new Error('Failed to launch /pages/axios/index')
      }

      const result = await page.callMethod('runE2E')
      const currentTrace = await readHostTrace(miniProgram)
      const newRequestCalls = currentTrace.requestCalls.slice(baselineTrace.requestCalls.length)
      expect(result?.ok, JSON.stringify({ result, requestCounts: serverHandle?.requestCounts })).toBe(true)
      expect(result?.snapshot?.requestPath).toBe('/axios')
      expect(result?.snapshot?.payload).toContain('"transport":"axios"')
      expect(result?.snapshot?.pageStatus).toBe('全部通过')
      expectRequestTrace(newRequestCalls, '/axios')
    })

    it('covers graphql-request against a local real server', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const miniProgram = await getMiniProgram(ctx)
      const baselineTrace = await readHostTrace(miniProgram)
      const page = await miniProgram.reLaunch(withBaseUrl('/pages/graphql-request/index'))
      if (!page) {
        throw new Error('Failed to launch /pages/graphql-request/index')
      }

      const result = await page.callMethod('runE2E')
      const currentTrace = await readHostTrace(miniProgram)
      const newRequestCalls = currentTrace.requestCalls.slice(baselineTrace.requestCalls.length)
      expect(result?.ok, JSON.stringify({ result, requestCounts: serverHandle?.requestCounts })).toBe(true)
      expect(result?.snapshot?.requestPath).toBe('/graphql')
      expect(result?.snapshot?.payload).toContain('"client":"graphql-request"')
      expect(result?.snapshot?.pageStatus).toBe('全部通过')
      expectRequestTrace(newRequestCalls, '/graphql')
    })

    it('covers socket.io-client against a local real realtime server', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const miniProgram = await getMiniProgram(ctx)
      const baselineTrace = await readHostTrace(miniProgram)
      const page = await miniProgram.reLaunch(withBaseUrl('/pages/socket-io/index'))
      if (!page) {
        throw new Error('Failed to launch /pages/socket-io/index')
      }

      const result = await page.callMethod('runE2E')
      const currentTrace = await readHostTrace(miniProgram)
      const newSocketCalls = currentTrace.socketCalls.slice(baselineTrace.socketCalls.length)
      expect(result?.ok, JSON.stringify({ result, requestCounts: serverHandle?.requestCounts })).toBe(true)
      expect(result?.snapshot?.requestPath).toBe('/socket.io')
      expect(result?.snapshot?.payload).toContain('"client":"socket.io-client"')
      expect(result?.snapshot?.payload).toContain('"serverRandomReceived":true')
      expect(result?.snapshot?.payload).toContain('"websocketOnlyConnected":true')
      expect(result?.latestRandomMessage).toBeTruthy()
      expect(result?.randomPushCount).toBeGreaterThan(0)
      expect(['polling', 'websocket']).toContain(result?.defaultTransportName)
      expect(result?.websocketOnlyTransportName).toBe('websocket')
      expect(serverHandle?.requestCounts.socketIo).toBeGreaterThan(0)
      expect(result?.snapshot?.pageStatus).toBe('全部通过')
      expectSocketTrace(newSocketCalls, '/socket.io', {
        perMessageDeflate: REQUEST_CLIENTS_REAL_SOCKET_DEFAULTS.perMessageDeflate,
      })
    })

    it('covers native WebSocket against a local real realtime server', async (ctx) => {
      if (sharedInfraUnavailableMessage) {
        ctx.skip(sharedInfraUnavailableMessage)
      }
      const miniProgram = await getMiniProgram(ctx)
      const baselineTrace = await readHostTrace(miniProgram)
      const page = await miniProgram.reLaunch(withBaseUrl('/pages/websocket/index'))
      if (!page) {
        throw new Error('Failed to launch /pages/websocket/index')
      }

      const result = await page.callMethod('runE2E')
      const currentTrace = await readHostTrace(miniProgram)
      const newSocketCalls = currentTrace.socketCalls.slice(baselineTrace.socketCalls.length)
      expect(result?.ok, JSON.stringify({ result, requestCounts: serverHandle?.requestCounts })).toBe(true)
      expect(result?.snapshot?.requestPath).toBe('/ws')
      expect(result?.snapshot?.payload).toContain('"client":"native-websocket"')
      expect(result?.snapshot?.payload).toContain('"serverRandomEvent":"server-random"')
      expect(result?.snapshot?.payload).toContain('"transport":"websocket"')
      expect(result?.connectedReadyState).toBe(1)
      expect(result?.latestRandomMessage).toBeTruthy()
      expect(result?.randomPushCount).toBeGreaterThan(0)
      expect(result?.snapshot?.pageStatus).toBe('全部通过')
      expectSocketTrace(newSocketCalls, '/ws', {
        perMessageDeflate: REQUEST_CLIENTS_REAL_SOCKET_DEFAULTS.perMessageDeflate,
        timeout: REQUEST_CLIENTS_REAL_SOCKET_DEFAULTS.timeout,
      })
    })
  })
}
