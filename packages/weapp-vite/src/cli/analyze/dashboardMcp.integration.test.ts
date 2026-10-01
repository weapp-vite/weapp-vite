import type { DevframeDefinition, DevframeNodeContext } from 'devframe'
import type { DevframeInstanceRecord } from 'devframe/internal'
import type { Plugin, ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from '../../dashboard'
import fs from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { DEVFRAME_CONNECTION_META_FILENAME } from 'devframe/constants'
import { registerDevframeInstance } from 'devframe/internal'
import { createServer } from 'vite'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAnalyzeDashboardDevframe, createDashboardArtifactSnapshot } from '../../dashboard'
import { ANALYZE_DASHBOARD_DEVFRAME_BASE, createAnalyzeDashboardViteBridge } from './dashboardViteBridge'

const token = 'dashboard-integration-bearer'
const stateTool = 'weapp-vite_get-dashboard-state'
const pageTool = 'weapp-vite_get-analyze-page'
const fileTool = 'weapp-vite_read-dashboard-file'
const servers: ViteDevServer[] = []
const clients: Client[] = []
let root: string
let instancesDir: string

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-mcp-')))
  instancesDir = path.join(root, 'instances')
  await fs.mkdir(instancesDir)
  vi.stubEnv('DEVFRAME_INSTANCES_DIR', instancesDir)
  vi.stubEnv('DEVFRAME_DISABLE_INSTANCE_REGISTRY', '')
  vi.stubEnv('DEVFRAME_MCP_AUTH_TOKEN', '')
})

afterEach(async () => {
  try {
    await Promise.all(clients.splice(0).map(client => client.close()))
  }
  finally {
    try {
      await Promise.all(servers.splice(0).map(server => server.close()))
    }
    finally {
      vi.unstubAllEnvs()
      await fs.rm(root, { recursive: true, force: true })
    }
  }
})

function analyzeResult(label = 'initial'): AnalyzeSubpackagesResult {
  return {
    packages: [{ id: 'main', label, type: 'main', files: [{ file: 'app.js', type: 'chunk', from: 'main', source: 'app.ts', sourceType: 'src' }] }],
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

async function createHost(options: { mcpAuthToken?: string, port?: number, failSetup?: boolean, plugins?: Plugin[] } = {}) {
  const uiRoot = path.join(root, `ui-${servers.length}`)
  const projectRoot = path.join(root, 'source-project')
  await fs.mkdir(uiRoot)
  await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true })
  await fs.writeFile(path.join(projectRoot, 'src', 'app.ts'), 'export const app = true\n')
  await fs.writeFile(path.join(uiRoot, 'index.html'), '<!doctype html><main>Dashboard MCP host</main>')
  await fs.writeFile(path.join(uiRoot, 'probe.txt'), 'Vite asset')
  const artifacts = createDashboardArtifactSnapshot()
  artifacts.capture('app.js', 'initial artifact')
  const controller = createAnalyzeDashboardDevframe({
    roots: { projectRoot, srcRoot: path.join(projectRoot, 'src') },
    snapshot: { current: analyzeResult(), previous: null, artifacts: artifacts.files },
  })
  let context: DevframeNodeContext | undefined
  const setup = controller.definition.setup
  const definition: DevframeDefinition = {
    ...controller.definition,
    async setup(ctx, info) {
      await setup?.(ctx, info)
      context = ctx
      await ctx.scope('foreign').rpc.sharedState('private', { initialValue: { secret: 'not-an-agent-resource' } })
      if (options.failSetup) {
        throw new Error('Dashboard setup rejected')
      }
    },
  }
  const server = await createServer({
    root: uiRoot,
    base: ANALYZE_DASHBOARD_DEVFRAME_BASE,
    configFile: false,
    logLevel: 'silent',
    appType: 'spa',
    plugins: [
      { name: 'capture-dashboard-test-host', configureServer: (server) => { servers.push(server) } },
      createAnalyzeDashboardViteBridge({ ...controller, definition }, { mcpAuthToken: options.mcpAuthToken, projectRoot }),
      ...(options.plugins ?? []),
    ],
    server: { host: '127.0.0.1', port: options.port ?? 0, strictPort: true, watch: { ignored: ['**/*'] } },
  })
  return {
    server,
    controller,
    projectRoot,
    get dashboard() {
      if (!context) {
        throw new Error('Dashboard context was not initialized')
      }
      return context.scope('weapp-vite')
    },
  }
}

function baseUrl(server: ViteDevServer) {
  const url = server.resolvedUrls?.local[0]
  if (!url) {
    throw new Error('Dashboard did not expose its listening URL')
  }
  return url
}

async function records() {
  return Promise.all((await fs.readdir(instancesDir)).filter(file => file.endsWith('.json')).map(async (file) => {
    return JSON.parse(await fs.readFile(path.join(instancesDir, file), 'utf8')) as DevframeInstanceRecord
  }))
}

async function connectClient(server: ViteDevServer, legacy = false) {
  const client = new Client({ name: 'dashboard-mcp-http-test', version: '1' }, legacy
    ? { supportedProtocolVersions: ['2025-11-25'], versionNegotiation: { mode: 'legacy' } }
    : { versionNegotiation: { mode: { pin: '2026-07-28' } } })
  clients.push(client)
  await client.connect(new StreamableHTTPClientTransport(new URL('__mcp', baseUrl(server)), {
    requestInit: { headers: { Origin: new URL(baseUrl(server)).origin, Authorization: `Bearer ${token}` } },
  }))
  return client
}

it.each([undefined, '', '   '])('does not mount or advertise MCP for a blank token (%j)', async (envToken) => {
  vi.stubEnv('DEVFRAME_MCP_AUTH_TOKEN', envToken)
  const { server } = await createHost()
  await server.listen()
  const metadata: unknown = await (await fetch(new URL(DEVFRAME_CONNECTION_META_FILENAME, baseUrl(server)))).json()
  expect(metadata).not.toHaveProperty('mcp')
  const missing = await fetch(new URL('__mcp', baseUrl(server)), { method: 'POST' })
  expect(missing.status).toBe(404)
  expect(await records()).toEqual([])
})

it('lets an explicit empty token disable the environment opt-in', async () => {
  vi.stubEnv('DEVFRAME_MCP_AUTH_TOKEN', token)
  const { server } = await createHost({ mcpAuthToken: '' })
  await server.listen()
  const response = await fetch(new URL('__mcp', baseUrl(server)), { method: 'POST' })
  expect(response.status).toBe(404)
  expect(await records()).toEqual([])
})

it('requires a canonical loopback Origin before checking the independent bearer credential', async () => {
  vi.stubEnv('DEVFRAME_MCP_AUTH_TOKEN', token)
  const { server } = await createHost()
  await server.listen()
  const endpoint = new URL('__mcp', baseUrl(server))
  const cases = [
    { origin: undefined, authorization: `Bearer ${token}`, status: 403 },
    { origin: '', authorization: `Bearer ${token}`, status: 403 },
    { origin: 'null', authorization: `Bearer ${token}`, status: 403 },
    { origin: 'https://attacker.example', authorization: `Bearer ${token}`, status: 403 },
    { origin: 'http://127.0.0.1.attacker.example', authorization: `Bearer ${token}`, status: 403 },
    { origin: 'ftp://localhost', authorization: `Bearer ${token}`, status: 403 },
    { origin: 'http://localhost/path', authorization: `Bearer ${token}`, status: 403 },
    { origin: endpoint.origin, authorization: undefined, status: 401 },
    { origin: endpoint.origin, authorization: 'Bearer incorrect', status: 401 },
    { origin: endpoint.origin, authorization: 'Basic dashboard-integration-bearer', status: 401 },
  ]
  for (const { origin, authorization, status } of cases) {
    const headers = new Headers({ 'Accept': 'application/json, text/event-stream', 'Content-Type': 'application/json' })
    if (origin !== undefined) {
      headers.set('Origin', origin)
    }
    if (authorization !== undefined) {
      headers.set('Authorization', authorization)
    }
    const response = await fetch(endpoint, { method: 'POST', headers, body: '{}' })
    expect(response.status).toBe(status)
    if (status === 401) {
      expect(response.headers.get('www-authenticate')).toBe('Bearer')
    }
    expect(await response.text()).not.toContain(token)
  }
  const client = await connectClient(server)
  expect((await client.listTools()).tools.map(tool => tool.name).sort()).toEqual([stateTool, pageTool, fileTool].sort())
})

it.each([false, true])('uses the live RPC authority through initialized MCP (legacy=%s)', async (legacy) => {
  const host = await createHost({ mcpAuthToken: token })
  const { server, controller } = host
  await server.listen()
  const { dashboard } = host
  const client = await connectClient(server, legacy)
  const { tools } = await client.listTools()
  expect(tools.map(tool => tool.name).sort()).toEqual([stateTool, pageTool, fileTool].sort())
  for (const tool of tools) {
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(tool.inputSchema).toMatchObject({ type: 'object' })
    expect(tool.outputSchema).toMatchObject({ type: 'object' })
  }
  expect((await client.listResources()).resources).toEqual([])
  const initial = await dashboard.rpc.call('get-dashboard-state')
  expect(await client.callTool({ name: stateTool, arguments: {} })).toMatchObject({ structuredContent: initial })
  const pageInput = { target: 'current', index: 0, revision: 0 } as const
  expect(await client.callTool({ name: pageTool, arguments: { arg0: pageInput } })).toMatchObject({
    structuredContent: await dashboard.rpc.call('get-analyze-page', pageInput),
  })
  for (const input of [{ kind: 'artifact', path: 'app.js', revision: 0 }, { kind: 'source', path: 'app.ts', revision: 0 }] as const) {
    expect(await client.callTool({ name: fileTool, arguments: { arg0: input } })).toMatchObject({
      structuredContent: await dashboard.rpc.call('read-dashboard-file', input),
    })
  }
  const artifacts = createDashboardArtifactSnapshot()
  artifacts.capture('app.js', 'updated artifact')
  await controller.update(analyzeResult('updated'), artifacts.files)
  const updated = await dashboard.rpc.call('get-dashboard-state')
  expect(updated.revision).toBe(initial.revision + 1)
  expect((await client.callTool({ name: stateTool, arguments: {} })).structuredContent)
    .toEqual(JSON.parse(JSON.stringify(updated)))
  expect(await client.callTool({ name: fileTool, arguments: { arg0: { kind: 'artifact', path: 'app.js', revision: 1 } } })).toMatchObject({
    structuredContent: { content: 'updated artifact' },
  })
  expect(await client.callTool({ name: pageTool, arguments: { arg0: pageInput } })).toMatchObject({ isError: true })
  expect(await client.callTool({ name: fileTool, arguments: { arg0: { kind: 'artifact', path: 'app.js', revision: 0 } } })).toMatchObject({ isError: true })
})

it('advertises only the listening native endpoint and preserves Vite pages, assets and history', async () => {
  const { server, projectRoot } = await createHost({ mcpAuthToken: token })
  expect(await records()).toEqual([])
  await server.listen()
  const url = baseUrl(server)
  const discovery = await fetch(new URL(`${DEVFRAME_CONNECTION_META_FILENAME}?cache=1`, url))
  const metadata: unknown = await discovery.json()
  expect(metadata).toMatchObject({ mcp: { path: '__mcp' } })
  const registered = await records()
  expect(registered).toEqual([expect.objectContaining({
    origin: new URL(url).origin,
    port: Number(new URL(url).port),
    basePath: ANALYZE_DASHBOARD_DEVFRAME_BASE,
    rootDir: projectRoot.replace(/\\/g, '/'),
    mcp: { path: `${ANALYZE_DASHBOARD_DEVFRAME_BASE}__mcp` },
  })])
  expect(JSON.stringify({ registered, metadata })).not.toContain(token)
  for (const route of ['', 'analyze?tab=treemap']) {
    const page = await fetch(new URL(route, url))
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('<main>Dashboard MCP host</main>')
  }
  expect(await (await fetch(new URL('probe.txt', url))).text()).toBe('Vite asset')
  await server.close()
  await server.close()
  expect(await records()).toEqual([])
  await expect(fetch(new URL('__mcp', url))).rejects.toThrow()
})

it('releases the replaced host while keeping the controller live through Vite restart', async () => {
  const { server, controller } = await createHost({ mcpAuthToken: token })
  await server.listen()
  const oldHttpServer = server.httpServer
  await server.restart()
  expect(server.httpServer).not.toBe(oldHttpServer)
  expect(oldHttpServer?.listening).toBe(false)
  expect(await records()).toEqual([expect.objectContaining({
    origin: new URL(baseUrl(server)).origin,
    mcp: { path: `${ANALYZE_DASHBOARD_DEVFRAME_BASE}__mcp` },
  })])
  await controller.update(analyzeResult('after restart'), new Map())
  const client = await connectClient(server)
  expect(await client.callTool({ name: stateTool, arguments: {} })).toMatchObject({ structuredContent: { revision: 1 } })
  await server.close()
  expect(await records()).toEqual([])
})

it.each(['configure', 'post-configure'] as const)('keeps the live host authoritative after a rejected %s replacement', async (stage) => {
  let generation = 0
  const host = await createHost({
    mcpAuthToken: token,
    plugins: [{
      name: 'reject-dashboard-replacement',
      configureServer() {
        generation += 1
        if (generation === 2) {
          const reject = () => {
            throw new Error('Replacement rejected')
          }
          if (stage === 'configure') {
            reject()
          }
          return reject
        }
      },
    }],
  })
  const { server, controller } = host
  await server.listen()
  const listeningServer = server.httpServer
  const client = await connectClient(server)
  await server.restart()
  expect(server.httpServer).toBe(listeningServer)
  await controller.update(analyzeResult('after rejected replacement'), new Map())
  expect((await client.callTool({ name: stateTool })).structuredContent).toMatchObject({ revision: 1 })
  expect(await records()).toHaveLength(1)
  await client.close()
  await server.close()
  expect(await records()).toEqual([])
  await expect(host.dashboard.rpc.call('get-dashboard-state')).rejects.toThrow()
})

it('rejects a delayed start after shutdown without opening a Dashboard transport', async () => {
  let enter!: () => void
  let release!: () => void
  let closed!: () => void
  const entered = new Promise<void>((resolve) => {
    enter = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const hostClosed = new Promise<void>((resolve) => {
    closed = resolve
  })
  const { server } = await createHost({
    mcpAuthToken: token,
    plugins: [{
      name: 'gate-dashboard-start',
      enforce: 'pre',
      buildStart: {
        sequential: true,
        async handler() {
          enter()
          await gate
        },
      },
      closeBundle: {
        order: 'post',
        sequential: true,
        handler() {
          closed()
        },
      },
    }],
  })
  const listening = server.listen()
  const rejectedStart = expect(listening).rejects.toThrow()
  try {
    await entered
    const closing = server.close()
    await hostClosed
    release()
    await rejectedStart
    await closing
    expect(server.httpServer?.listening).toBe(false)
    expect(await records()).toEqual([])
  }
  finally {
    release()
    await listening.catch(() => {})
    await server.close()
  }
})

it('cleans startup failures without publishing a record or closing a foreign listener', async () => {
  const foreign = createHttpServer((_request, response) => response.end('foreign listener'))
  await new Promise<void>(resolve => foreign.listen(0, '127.0.0.1', resolve))
  const address = foreign.address()
  if (!address || typeof address === 'string') {
    throw new Error('Missing foreign listener address')
  }
  const origin = `http://127.0.0.1:${address.port}`
  const registration = registerDevframeInstance({
    pid: process.pid,
    port: address.port,
    origin,
    basePath: '/',
    id: 'foreign',
    rootDir: root,
    mcp: null,
    startedAt: Date.now(),
  })
  try {
    const failed = await createHost({ mcpAuthToken: token, failSetup: true })
    await expect(failed.server.listen()).rejects.toThrow()
    const { server } = await createHost({ mcpAuthToken: token, port: address.port })
    await expect(server.listen()).rejects.toThrow()
    await server.close()
    expect(await records()).toEqual([expect.objectContaining({ id: 'foreign', origin })])
    expect(await (await fetch(origin)).text()).toBe('foreign listener')
  }
  finally {
    registration.unregister()
    await new Promise<void>((resolve, reject) => foreign.close(error => error ? reject(error) : resolve()))
  }
})
