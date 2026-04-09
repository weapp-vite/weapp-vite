import { rm } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { startRequestClientsRealServer } from '../utils/requestClientsRealServer'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/request-clients-real')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

const LOCAL_SERVER_INFRA_ERROR_PATTERNS = [
  /listen EPERM/i,
  /operation not permitted/i,
  /EACCES/i,
]

let baseUrl = ''
let serverHandle: Awaited<ReturnType<typeof startRequestClientsRealServer>> | null = null
let miniProgram: any = null
let buildPrepared = false
let sharedInfraUnavailableMessage = ''

function isLocalServerInfraError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return LOCAL_SERVER_INFRA_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

async function ensureBuilt() {
  if (buildPrepared) {
    return
  }

  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:request-clients-real',
  })
  buildPrepared = true
}

async function getMiniProgram(ctx: { skip: (message?: string) => void }) {
  if (miniProgram) {
    return miniProgram
  }

  await ensureBuilt()

  try {
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      timeout: 120_000,
    })
    return miniProgram
  }
  catch (error) {
    if (isDevtoolsHttpPortError(error)) {
      ctx.skip('WeChat DevTools 服务端口未开启，跳过 request-clients-real IDE 自动化用例。')
    }
    throw error
  }
}

function withBaseUrl(route: string) {
  return `${route}?baseUrl=${encodeURIComponent(baseUrl)}`
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
  if (miniProgram) {
    await miniProgram.close()
  }
  if (serverHandle) {
    await serverHandle.stop()
  }
})

describe.sequential('e2e app: request-clients-real', () => {
  it('covers fetch against a local real server', async (ctx) => {
    if (sharedInfraUnavailableMessage) {
      ctx.skip(sharedInfraUnavailableMessage)
    }
    const miniProgram = await getMiniProgram(ctx)
    const cases = [
      {
        route: '/pages/fetch/index',
        payloadToken: '"transport":"fetch"',
        path: '/fetch',
      },
    ] as const

    for (const testCase of cases) {
      const page = await miniProgram.reLaunch(withBaseUrl(testCase.route))
      if (!page) {
        throw new Error(`Failed to launch route ${testCase.route}`)
      }

      const result = await page.callMethod('runE2E')
      expect(result?.ok, JSON.stringify({ result, requestCounts: serverHandle?.requestCounts })).toBe(true)
      expect(result?.snapshot?.requestPath).toBe(testCase.path)
      expect(result?.snapshot?.payload).toContain(testCase.payloadToken)
      expect(result?.snapshot?.pageStatus).toBe('全部通过')
    }
  })

  it('covers axios against a local real server', async (ctx) => {
    if (sharedInfraUnavailableMessage) {
      ctx.skip(sharedInfraUnavailableMessage)
    }
    const miniProgram = await getMiniProgram(ctx)
    const page = await miniProgram.reLaunch(withBaseUrl('/pages/axios/index'))
    if (!page) {
      throw new Error('Failed to launch /pages/axios/index')
    }

    const result = await page.callMethod('runE2E')
    expect(result?.ok, JSON.stringify({ result, requestCounts: serverHandle?.requestCounts })).toBe(true)
    expect(result?.snapshot?.requestPath).toBe('/axios')
    expect(result?.snapshot?.payload).toContain('"transport":"axios"')
    expect(result?.snapshot?.pageStatus).toBe('全部通过')
  })

  it('covers graphql-request against a local real server', async (ctx) => {
    if (sharedInfraUnavailableMessage) {
      ctx.skip(sharedInfraUnavailableMessage)
    }
    const miniProgram = await getMiniProgram(ctx)
    const page = await miniProgram.reLaunch(withBaseUrl('/pages/graphql-request/index'))
    if (!page) {
      throw new Error('Failed to launch /pages/graphql-request/index')
    }

    const result = await page.callMethod('runE2E')
    expect(result?.ok, JSON.stringify({ result, requestCounts: serverHandle?.requestCounts })).toBe(true)
    expect(result?.snapshot?.requestPath).toBe('/graphql')
    expect(result?.snapshot?.payload).toContain('"client":"graphql-request"')
    expect(result?.snapshot?.pageStatus).toBe('全部通过')
  })

  it('covers vue-query with tab switch, refetch and query key rotation against a local real server', async (ctx) => {
    if (sharedInfraUnavailableMessage) {
      ctx.skip(sharedInfraUnavailableMessage)
    }
    const miniProgram = await getMiniProgram(ctx)
    const page = await miniProgram.reLaunch(withBaseUrl('/pages/vue-query/index'))
    if (!page) {
      throw new Error('Failed to launch /pages/vue-query/index')
    }

    const result = await page.callMethod('runE2E')
    expect(result?.ok, JSON.stringify({ result, requestCounts: serverHandle?.requestCounts })).toBe(true)
    expect(result?.checks).toEqual({
      initialOverview: true,
      switchedDetail: true,
      refetchAdvanced: true,
      keyRotated: true,
    })
    expect(result?.snapshots?.initial?.label).toBe('Overview Data')
    expect(result?.snapshots?.detail?.label).toBe('Detail Data')
    expect(result?.snapshots?.afterRotate?.seed).toBe(1)
  })

  it('covers socket.io-client against a local real realtime server', async (ctx) => {
    if (sharedInfraUnavailableMessage) {
      ctx.skip(sharedInfraUnavailableMessage)
    }
    const miniProgram = await getMiniProgram(ctx)
    const page = await miniProgram.reLaunch(withBaseUrl('/pages/socket-io/index'))
    if (!page) {
      throw new Error('Failed to launch /pages/socket-io/index')
    }

    const result = await page.callMethod('runE2E')
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
  })

  it('covers native WebSocket against a local real realtime server', async (ctx) => {
    if (sharedInfraUnavailableMessage) {
      ctx.skip(sharedInfraUnavailableMessage)
    }
    const miniProgram = await getMiniProgram(ctx)
    const page = await miniProgram.reLaunch(withBaseUrl('/pages/websocket/index'))
    if (!page) {
      throw new Error('Failed to launch /pages/websocket/index')
    }

    const result = await page.callMethod('runE2E')
    expect(result?.ok, JSON.stringify({ result, requestCounts: serverHandle?.requestCounts })).toBe(true)
    expect(result?.snapshot?.requestPath).toBe('/ws')
    expect(result?.snapshot?.payload).toContain('"client":"native-websocket"')
    expect(result?.snapshot?.payload).toContain('"serverRandomEvent":"server-random"')
    expect(result?.snapshot?.payload).toContain('"transport":"websocket"')
    expect(result?.connectedReadyState).toBe(1)
    expect(result?.latestRandomMessage).toBeTruthy()
    expect(result?.randomPushCount).toBeGreaterThan(0)
    expect(result?.snapshot?.pageStatus).toBe('全部通过')
  })
})
