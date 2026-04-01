import type { Buffer } from 'node:buffer'
import type { IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/request-clients-real')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

interface SharedServerState {
  axios: number
  fetch: number
  graphql: number
  vueQuery: number
}

const requestCounts: SharedServerState = {
  axios: 0,
  fetch: 0,
  graphql: 0,
  vueQuery: 0,
}

let baseUrl = ''
let server: ReturnType<typeof createServer> | null = null
let miniProgram: any = null
let buildPrepared = false

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let buffer = ''
    req.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
    })
    req.on('end', () => resolve(buffer))
    req.on('error', reject)
  })
}

function writeJson(res: any, payload: unknown, statusCode = 200) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

async function startLocalServer() {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (url.pathname === '/fetch') {
      requestCounts.fetch += 1
      const bodyText = await readBody(req)
      const body = bodyText ? JSON.parse(bodyText) : {}
      writeJson(res, {
        body,
        method: req.method,
        path: url.pathname,
        requestCount: requestCounts.fetch,
        transport: 'fetch',
      })
      return
    }

    if (url.pathname === '/axios') {
      requestCounts.axios += 1
      writeJson(res, {
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        requestCount: requestCounts.axios,
        transport: 'axios',
      })
      return
    }

    if (url.pathname === '/graphql') {
      requestCounts.graphql += 1
      const bodyText = await readBody(req)
      const body = bodyText ? JSON.parse(bodyText) : {}
      writeJson(res, {
        data: {
          transport: {
            client: 'graphql-request',
            operationName: 'TransportProbe',
            path: url.pathname,
            requestCount: requestCounts.graphql,
            run: body.variables?.run ?? null,
          },
        },
      })
      return
    }

    if (url.pathname === '/vue-query') {
      requestCounts.vueQuery += 1
      const tab = url.searchParams.get('tab') === 'detail' ? 'detail' : 'overview'
      const seed = Number(url.searchParams.get('seed') ?? '0')
      writeJson(res, {
        generatedAt: new Date().toISOString(),
        label: tab === 'overview' ? 'Overview Data' : 'Detail Data',
        requestCount: requestCounts.vueQuery,
        seed,
        tab,
      })
      return
    }

    writeJson(res, { error: 'not found', path: url.pathname }, 404)
  })

  await new Promise<void>((resolve) => {
    server!.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
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
  await startLocalServer()
})

afterAll(async () => {
  if (miniProgram) {
    await miniProgram.close()
  }
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }
})

describe.sequential('e2e app: request-clients-real', () => {
  it('covers fetch, axios and graphql-request against a local real server', async (ctx) => {
    const miniProgram = await getMiniProgram(ctx)
    const cases = [
      {
        route: '/pages/fetch/index',
        payloadToken: '"transport":"fetch"',
        path: '/fetch',
      },
      {
        route: '/pages/axios/index',
        payloadToken: '"transport":"axios"',
        path: '/axios',
      },
      {
        route: '/pages/graphql-request/index',
        payloadToken: '"client":"graphql-request"',
        path: '/graphql',
      },
    ] as const

    for (const testCase of cases) {
      const page = await miniProgram.reLaunch(withBaseUrl(testCase.route))
      if (!page) {
        throw new Error(`Failed to launch route ${testCase.route}`)
      }

      const result = await page.callMethod('runE2E')
      expect(result?.ok, JSON.stringify({ result, requestCounts })).toBe(true)
      expect(result?.snapshot?.requestPath).toBe(testCase.path)
      expect(result?.snapshot?.payload).toContain(testCase.payloadToken)
      expect(result?.snapshot?.pageStatus).toBe('全部通过')
    }
  })

  it('covers vue-query with tab switch, refetch and query key rotation against a local real server', async (ctx) => {
    const miniProgram = await getMiniProgram(ctx)
    const page = await miniProgram.reLaunch(withBaseUrl('/pages/vue-query/index'))
    if (!page) {
      throw new Error('Failed to launch /pages/vue-query/index')
    }

    const result = await page.callMethod('runE2E')
    expect(result?.ok, JSON.stringify({ result, requestCounts })).toBe(true)
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
})
