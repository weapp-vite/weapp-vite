import type { DevframeDefinition, DevframeRpcClientFunctions, DevframeRpcServerFunctions } from 'devframe'
import type { Plugin, ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from '../../dashboard'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { DEVFRAME_CONNECTION_META_FILENAME, DEVFRAME_SSE_ROUTE, DEVFRAME_WS_ROUTE } from 'devframe/constants'
import { getTempAuthCode } from 'devframe/node/auth'
import { createRpcClient } from 'devframe/rpc/client'
import { createSseRpcChannel } from 'devframe/rpc/transports/sse-client'
import { createServer } from 'vite'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAnalyzeDashboardDevframe } from '../../dashboard'
import { ANALYZE_DASHBOARD_DEVFRAME_BASE, ANALYZE_DASHBOARD_HUB_BASE, createAnalyzeDashboardViteBridge } from './dashboardViteBridge'

const servers: ViteDevServer[] = []
const cleanup: Array<() => void | Promise<void>> = []
let root: string

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-hub-')))
  await fs.mkdir(path.join(root, 'instances'))
  vi.stubEnv('DEVFRAME_INSTANCES_DIR', path.join(root, 'instances'))
  vi.stubEnv('DEVFRAME_DISABLE_INSTANCE_REGISTRY', '')
  vi.stubEnv('HOME', root)
  vi.stubEnv('USERPROFILE', root)
  await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><main>Vite Dashboard</main>')
  await fs.writeFile(path.join(root, 'probe.txt'), 'Dashboard asset')
  await fs.writeFile(path.join(root, 'probe.ts'), 'globalThis.dashboardProbe = 42 satisfies number\n')
})

afterEach(async () => {
  try {
    await Promise.allSettled(cleanup.splice(0).map(close => close()))
    await Promise.allSettled(servers.splice(0).map(server => server.close()))
  }
  finally {
    vi.unstubAllEnvs()
    await fs.rm(root, { recursive: true, force: true })
  }
})

function analyzeResult(label = 'initial'): AnalyzeSubpackagesResult {
  return {
    packages: [{ id: 'main', label, type: 'main', files: [] }],
    modules: [],
    subPackages: [],
    glassEasel: {
      detected: false,
      minimumBaseLibrary: '3.8.12',
      migrationGuide: '',
      diagnostics: [],
      summary: { errors: 0, warnings: 0 },
    },
  }
}

async function createHost(options: { setup?: DevframeDefinition['setup'], plugins?: Plugin[] } = {}) {
  const controller = createAnalyzeDashboardDevframe({
    clientAssets: root,
    roots: { projectRoot: root },
    snapshot: { current: analyzeResult(), previous: null, artifacts: new Map() },
  })
  const bridge = createAnalyzeDashboardViteBridge({
    ...controller,
    definition: {
      ...controller.definition,
      async setup(ctx, info) {
        await options.setup?.(ctx, info)
        await controller.definition.setup?.(ctx, info)
      },
    },
  }, { uiHost: 'hub', projectRoot: root })
  cleanup.push(() => controller.dispose(), () => bridge.close())
  const server = await createServer({
    root,
    base: ANALYZE_DASHBOARD_DEVFRAME_BASE,
    configFile: false,
    logLevel: 'silent',
    plugins: [bridge, ...options.plugins ?? []],
    server: { host: '127.0.0.1', port: 0, watch: null },
  })
  servers.push(server)
  return { controller, bridge, server }
}

function baseUrl(server: ViteDevServer) {
  const url = server.resolvedUrls?.local[0]
  if (!url) {
    throw new Error('Dashboard Hub did not expose its listening URL')
  }
  return url
}

function connectClient(server: ViteDevServer) {
  const disconnected = Promise.withResolvers<void>()
  const channel = createSseRpcChannel({
    url: new URL(`${ANALYZE_DASHBOARD_HUB_BASE}${DEVFRAME_SSE_ROUTE}`, baseUrl(server)).href,
    onDisconnected: () => disconnected.resolve(),
  })
  const rpc = createRpcClient<DevframeRpcServerFunctions, Pick<DevframeRpcClientFunctions, 'weapp-vite:dashboard-state-updated'>>({
    'weapp-vite:dashboard-state-updated': () => {},
  }, { channel, rpcOptions: { timeout: 2000 } })
  cleanup.push(() => {
    rpc.$close()
    channel.close()
  })
  return {
    rpc,
    disconnected: disconnected.promise,
    async authenticate() {
      await rpc.$call('anonymous:devframe:auth:exchange', {
        code: getTempAuthCode(),
        ua: 'dashboard-hub-test',
        origin: new URL(baseUrl(server)).origin,
      })
      // 用受保护读取证明 OTP 已授权，不把 token 本身作为测试输出。
      expect(await rpc.$call('weapp-vite:get-dashboard-state')).toMatchObject({ revision: 0 })
      // 官方 storage 使用延迟写入；等待本测试的认证落盘后才允许移除临时 HOME。
      await vi.waitFor(() => fs.access(path.join(root, '.devframes', 'devframe', 'auth.json')))
    },
  }
}

it('keeps Vite transforms outside the Hub while sharing authenticated RPC and writable Hub settings', async () => {
  const { server, controller } = await createHost()
  await server.listen()
  const url = baseUrl(server)
  const hubUrl = new URL(ANALYZE_DASHBOARD_HUB_BASE, url)
  for (const route of ['', 'analyze?tab=treemap', 'hub-neighbor']) {
    const page = await fetch(new URL(route, url))
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('<main>Vite Dashboard</main>')
  }
  expect(await (await fetch(new URL('probe.txt', url))).text()).toBe('Dashboard asset')
  const transformed = await fetch(new URL('probe.ts', url))
  expect(transformed.status).toBe(200)
  const browserGlobal: { dashboardProbe?: number } = {}
  runInNewContext(await transformed.text(), browserGlobal)
  expect(browserGlobal.dashboardProbe).toBe(42)

  const hubPage = await fetch(hubUrl)
  expect(hubPage.status).toBe(200)
  await hubPage.body?.cancel()
  const hubAsset = await fetch(new URL('embedded.js', hubUrl))
  expect(hubAsset.status).toBe(200)
  expect(hubAsset.headers.get('content-type')).toContain('javascript')
  await hubAsset.body?.cancel()

  const dashboardMeta: unknown = await (await fetch(new URL(`${DEVFRAME_CONNECTION_META_FILENAME}?cache=1`, url))).json()
  const hubMeta: unknown = await (await fetch(new URL(DEVFRAME_CONNECTION_META_FILENAME, hubUrl))).json()
  expect(dashboardMeta).toEqual(hubMeta)
  expect(dashboardMeta).toMatchObject({
    backend: 'websocket',
    websocket: { path: `${ANALYZE_DASHBOARD_HUB_BASE}${DEVFRAME_WS_ROUTE}` },
    sse: { path: `${ANALYZE_DASHBOARD_HUB_BASE}${DEVFRAME_SSE_ROUTE}` },
  })
  expect(dashboardMeta).not.toHaveProperty('mcp')
  expect(dashboardMeta).not.toHaveProperty('authToken')
  const index: unknown = await (await fetch(new URL('__index.json', hubUrl))).json()
  expect(index).toMatchObject({ frames: [{ id: 'weapp-vite', base: ANALYZE_DASHBOARD_DEVFRAME_BASE }] })
  for (const base of [url, hubUrl]) {
    const mcp = await fetch(new URL('__mcp', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    expect([404, 405]).toContain(mcp.status)
    await mcp.body?.cancel()
  }
  const forbidden = await fetch(new URL(DEVFRAME_SSE_ROUTE, hubUrl), { headers: { Origin: 'https://attacker.example' } })
  expect(forbidden.status).toBe(403)
  await forbidden.body?.cancel()

  const client = connectClient(server)
  await expect(client.rpc.$call('weapp-vite:get-dashboard-state')).rejects.toThrow()
  await client.authenticate()
  await client.rpc.$call('devframe:rpc:server-state:patch', 'devframe:user-settings', [{ op: 'replace', path: ['docksPinned'], value: ['weapp-vite'] }], 'hub-settings-test')
  expect(await client.rpc.$call('devframe:rpc:server-state:get', 'devframe:user-settings')).toMatchObject({ docksPinned: ['weapp-vite'] })
  await client.rpc.$call('devframe:rpc:server-state:set', 'weapp-vite:dashboard', { revision: 999 }, 'dashboard-write-test')
  expect(await client.rpc.$call('weapp-vite:get-dashboard-state')).toMatchObject({ revision: 0 })
  await controller.update(analyzeResult('updated'), new Map())
  expect(await client.rpc.$call('weapp-vite:get-dashboard-state')).toMatchObject({ revision: 1 })
  await vi.waitFor(async () => {
    const settings: unknown = JSON.parse(await fs.readFile(path.join(root, 'node_modules', '.devframes', 'devframe', 'settings.json'), 'utf8'))
    expect(settings).toMatchObject({ docksPinned: ['weapp-vite'] })
  })
  expect(await fs.readdir(path.join(root, 'instances'))).toEqual([])
})

it('waits for real Hub setup during cancellation without letting Vite start listening', async () => {
  let entered = false
  const resume = Promise.withResolvers<void>()
  const { server, bridge } = await createHost({ setup: async () => {
    entered = true
    await resume.promise
  } })
  const originalUpgradeListeners = server.httpServer?.rawListeners('upgrade') ?? []
  const listening = server.listen().then(() => undefined, error => error)
  try {
    await vi.waitFor(() => expect(entered).toBe(true))
    let settled = false
    const closing = bridge.close().then(() => {
      settled = true
    })
    const nativeClosing = server.close()
    await Promise.resolve()
    expect(settled).toBe(false)
    resume.resolve()
    await Promise.all([closing, nativeClosing])
    expect(await listening).toMatchObject({ message: 'Dashboard host initialization was cancelled by shutdown.' })
    expect(server.httpServer?.listening).toBe(false)
    for (const listener of server.httpServer?.rawListeners('upgrade') ?? []) {
      expect(originalUpgradeListeners).toContain(listener)
    }
  }
  finally {
    resume.resolve()
    await listening
  }
})

it('retains the real Hub setup failure and releases its host', async () => {
  const failure = new Error('Dashboard setup rejected')
  const { server, bridge } = await createHost({ setup: () => {
    throw failure
  } })
  await expect(server.listen()).rejects.toBe(failure)
  await bridge.close()
  expect(server.httpServer?.listening).toBe(false)
  expect(await fs.readdir(path.join(root, 'instances'))).toEqual([])
})

it.each(['restart', 'configure', 'post-configure'] as const)('preserves the current Hub across native %s and closes its live transport', async (stage) => {
  const candidates: ViteDevServer[] = []
  const { server, bridge, controller } = await createHost({ plugins: [{
    name: 'hub-restart-boundary',
    configureServer(candidate) {
      candidates.push(candidate)
      if (candidates.length !== 2 || stage === 'restart') {
        return
      }
      const reject = () => {
        throw new Error('Hub replacement rejected')
      }
      if (stage === 'configure') {
        reject()
      }
      return reject
    },
  }] })
  await server.listen()
  const originalHttp = server.httpServer
  await server.restart()
  if (stage === 'restart') {
    expect(server.httpServer).not.toBe(originalHttp)
    expect(originalHttp?.listening).toBe(false)
  }
  else {
    expect(server.httpServer).toBe(originalHttp)
    expect(candidates[1]?.httpServer?.listening).toBe(false)
  }
  const client = connectClient(server)
  await client.authenticate()
  await controller.update(analyzeResult('after replacement'), new Map())
  expect(await client.rpc.$call('weapp-vite:get-dashboard-state')).toMatchObject({ revision: 1 })
  const closing = bridge.close()
  expect(bridge.close()).toBe(closing)
  await closing
  await client.disconnected
  expect(server.httpServer?.listening).toBe(true)
  expect(await (await fetch(new URL('probe.txt', baseUrl(server)))).text()).toBe('Dashboard asset')
  await server.close()
  expect(server.httpServer?.listening).toBe(false)
  expect(await fs.readdir(path.join(root, 'instances'))).toEqual([])
})
