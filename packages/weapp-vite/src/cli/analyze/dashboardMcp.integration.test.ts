import type { DevframeDefinition, DevframeNodeContext } from 'devframe'
import type { DevframeInstanceRecord } from 'devframe/internal'
import type { Plugin, ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult, DashboardInvestigation, DashboardInvestigationClaim } from '../../dashboard'
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

async function createHost(options: { port?: number, failSetup?: boolean, plugins?: Plugin[], peerAddress?: string } = {}) {
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
      {
        name: 'capture-dashboard-test-host',
        configureServer(server) {
          servers.push(server)
          if ('peerAddress' in options) {
            server.middlewares.use((request, _response, next) => {
              // 模拟宿主取得的 socket 元数据，而不是从请求头推导连接对端。
              Object.defineProperty(request.socket, 'remoteAddress', { value: options.peerAddress, configurable: true })
              next()
            })
          }
        },
      },
      createAnalyzeDashboardViteBridge({ ...controller, definition }, { projectRoot }),
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
    requestInit: { headers: { Origin: new URL(baseUrl(server)).origin } },
  }))
  return client
}

it('requires a canonical loopback Origin without a bearer credential', async () => {
  const { server } = await createHost()
  await server.listen()
  const endpoint = new URL('__mcp', baseUrl(server))
  const origins = [
    undefined,
    '',
    'null',
    'https://attacker.example',
    'http://127.0.0.1.attacker.example',
    'ftp://localhost',
    'http://localhost/path',
  ]
  for (const origin of origins) {
    const headers = new Headers({ 'Accept': 'application/json, text/event-stream', 'Content-Type': 'application/json' })
    if (origin !== undefined) {
      headers.set('Origin', origin)
    }
    const response = await fetch(endpoint, { method: 'POST', headers, body: '{}' })
    expect(response.status).toBe(403)
  }
  const client = await connectClient(server)
  expect(await client.callTool({ name: 'weapp-vite_get-analyze-summary', arguments: { arg0: { revision: 0 } } }))
    .toMatchObject({ structuredContent: { totals: { packages: 1, files: 1 }, previousAvailable: false } })
})

it.each(['192.0.2.1', '::ffff:192.0.2.1', '2001:db8::1', undefined])('rejects an untrusted socket peer (%s) despite forged locality headers', async (peerAddress) => {
  const { server } = await createHost({ peerAddress })
  await server.listen()
  const response = await fetch(new URL('__mcp', baseUrl(server)), {
    method: 'POST',
    headers: {
      'Origin': new URL(baseUrl(server)).origin,
      'Content-Type': 'application/json',
      'Forwarded': 'for=127.0.0.1;host=localhost',
      'X-Forwarded-For': '127.0.0.1',
      'X-Real-IP': '127.0.0.1',
    },
    body: '{}',
  })
  expect(response.status).toBe(403)
})

it.each(['::1', '::ffff:127.0.0.1'])('accepts a loopback socket peer (%s) without credentials', async (peerAddress) => {
  const { server } = await createHost({ peerAddress })
  await server.listen()
  const client = await connectClient(server)
  expect(await client.callTool({ name: 'weapp-vite_get-analyze-summary', arguments: { arg0: { revision: 0 } } }))
    .toMatchObject({ structuredContent: { totals: { packages: 1, files: 1 }, previousAvailable: false } })
})

it.each([false, true])('uses the live RPC authority through initialized MCP (legacy=%s)', async (legacy) => {
  const host = await createHost()
  const { server, controller } = host
  await server.listen()
  const { dashboard } = host
  const client = await connectClient(server, legacy)
  const { tools } = await client.listTools()
  expect(tools.map(tool => tool.name).sort()).toEqual([
    stateTool,
    pageTool,
    fileTool,
    'weapp-vite_get-analyze-summary',
    'weapp-vite_query-analyze-packages',
    'weapp-vite_query-analyze-artifacts',
    'weapp-vite_query-analyze-modules',
    'weapp-vite_compare-analyze-builds',
    'weapp-vite_query-runtime-events',
    'weapp-vite_list-investigations',
    'weapp-vite_get-investigation',
    'weapp-vite_claim-investigation',
    'weapp-vite_propose-investigation',
    'weapp-vite_start-investigation',
    'weapp-vite_complete-investigation',
  ].sort())
  for (const tool of tools) {
    const action = ['claim-investigation', 'propose-investigation', 'start-investigation', 'complete-investigation'].some(name => tool.name === `weapp-vite_${name}`)
    expect(tool.annotations).toMatchObject({ readOnlyHint: !action, destructiveHint: false })
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

it('keeps browser owner tools absent and denied even through direct guessed MCP and agent invocation', async () => {
  const host = await createHost()
  await host.server.listen()
  const { dashboard } = host
  const client = await connectClient(host.server)
  const state = await dashboard.rpc.call('get-dashboard-state')
  const report = { sessionId: state.sessionId, revision: state.revision, reportHash: state.analyze.current.hash }
  const input = { report, target: { kind: 'artifact' as const, packageId: 'main', file: 'app.js' }, question: 'Reduce this artifact without changing behavior' }
  const { tools } = await client.listTools()

  async function rejectOwner(name: string, arg0: object) {
    expect(tools.some(tool => tool.name === `weapp-vite_${name}`)).toBe(false)
    expect(dashboard.agent.getTool(`weapp-vite:${name}`)).toBeUndefined()
    const before = await dashboard.rpc.call('list-investigations')
    for (const guessed of [`weapp-vite_${name}`, `weapp-vite:${name}`]) {
      expect(await client.callTool({ name: guessed, arguments: { arg0 } })).toMatchObject({ isError: true })
    }
    await expect(dashboard.agent.invoke(`weapp-vite:${name}`, { arg0 })).rejects.toThrow('not found')
    expect(await dashboard.rpc.call('list-investigations')).toEqual(before)
  }

  await rejectOwner('create-investigation', input)
  let task = await dashboard.rpc.call('create-investigation', input)
  await rejectOwner('cancel-investigation', { id: task.id, version: task.version })
  for (const [name, arg0] of [
    ['get-investigation', { id: '' }],
    ['claim-investigation', { id: task.id, version: task.version }],
    ['claim-investigation', { id: task.id, version: task.version, agentName: 'Agent', extraPermission: true }],
    ['claim-investigation', { id: task.id, version: 0, agentName: 'Agent' }],
  ]) {
    expect(await client.callTool({ name: `weapp-vite_${name}`, arguments: { arg0 } })).toMatchObject({ isError: true })
  }
  expect(await dashboard.rpc.call('get-investigation', { id: task.id })).toEqual(task)
  const claimInput = { id: task.id, version: task.version, agentName: 'External MCP Agent' }
  const claims = await Promise.all([1, 2].map(() => client.callTool({ name: 'weapp-vite_claim-investigation', arguments: { arg0: claimInput } })))
  expect(claims.filter(result => result.isError === true)).toHaveLength(1)
  const winningClaim = claims.find(result => result.isError !== true)!
  const { investigation, claimToken } = winningClaim.structuredContent as unknown as DashboardInvestigationClaim
  task = investigation
  expect(JSON.stringify((await client.callTool({ name: stateTool })).structuredContent)).not.toContain(claimToken)
  expect(JSON.stringify((await client.callTool({ name: 'weapp-vite_list-investigations' })).structuredContent)).not.toContain(claimToken)
  const proposal = { summary: 'Remove unused code', changes: [{ path: 'src/app.ts', description: 'Remove the unused branch' }], checks: ['pnpm test'], risks: [] }
  const agent = { id: task.id, version: task.version, claimToken }
  for (const invalid of [
    { ...agent, proposal: { ...proposal, changes: [] } },
    { ...agent, proposal: { ...proposal, summary: ' ' } },
    { ...agent, proposal: { ...proposal, risks: Array.from({ length: 33 }).fill('Risk') } },
    { ...agent, proposal: { ...proposal, id: 'agent-chosen-proposal' } },
  ]) {
    expect(await client.callTool({ name: 'weapp-vite_propose-investigation', arguments: { arg0: invalid } })).toMatchObject({ isError: true })
  }
  expect(await dashboard.rpc.call('get-investigation', { id: task.id })).toEqual(task)
  expect(await client.callTool({ name: 'weapp-vite_propose-investigation', arguments: { arg0: { ...agent, claimToken: '0'.repeat(64), proposal } } })).toMatchObject({ isError: true })
  expect(await client.callTool({ name: 'weapp-vite_start-investigation', arguments: { arg0: agent } })).toMatchObject({ isError: true })
  const proposed = await client.callTool({ name: 'weapp-vite_propose-investigation', arguments: { arg0: { ...agent, proposal } } })
  expect(proposed.isError).not.toBe(true)
  task = proposed.structuredContent as unknown as DashboardInvestigation
  const grant = { id: task.id, version: task.version, proposalId: task.proposal!.id }
  await rejectOwner('authorize-investigation', grant)
  task = await dashboard.rpc.call('authorize-investigation', grant)
  const start = { ...agent, version: task.version }
  const started = await client.callTool({ name: 'weapp-vite_start-investigation', arguments: { arg0: start } })
  expect(started.isError).not.toBe(true)
  task = started.structuredContent as unknown as DashboardInvestigation
  expect(await client.callTool({ name: 'weapp-vite_start-investigation', arguments: { arg0: start } })).toMatchObject({ isError: true })
  await host.controller.update(analyzeResult('after external work'), new Map())
  const completed = await client.callTool({
    name: 'weapp-vite_complete-investigation',
    arguments: { arg0: { ...agent, version: task.version, receipt: { outcome: 'completed', summary: 'External report only', changedFiles: ['src/app.ts'], checks: [] } } },
  })
  expect(completed.isError).not.toBe(true)
  task = completed.structuredContent as unknown as DashboardInvestigation
  expect(task.status).toBe('completed')
  expect(task.verification).toBeNull()
  const latest = await dashboard.rpc.call('get-dashboard-state')
  const verification = {
    id: task.id,
    version: task.version,
    report: { sessionId: latest.sessionId, revision: latest.revision, reportHash: latest.analyze.current.hash },
    summary: 'Human reviewed the new report and behavior',
  }
  await rejectOwner('verify-investigation', verification)
  expect(await dashboard.rpc.call('verify-investigation', verification)).toMatchObject({ status: 'verified' })
  host.controller.dispose()
  expect(await client.callTool({ name: 'weapp-vite_list-investigations' })).toMatchObject({ isError: true })
  expect(await client.callTool({ name: 'weapp-vite_get-investigation', arguments: { arg0: { id: task.id } } })).toMatchObject({ isError: true })
})

it('diagnoses growth and duplicates through bounded domain queries without report-page downloads', async () => {
  const { server, controller } = await createHost()
  const previous = analyzeResult('main')
  previous.packages[0]!.files = [
    { file: 'app.js', type: 'chunk', from: 'main', size: 80, modules: [{ id: 'shared', source: 'app.ts', sourceType: 'src', bytes: 20 }] },
    { file: 'removed.js', type: 'asset', from: 'main', size: 5 },
  ]
  const current = analyzeResult('main')
  current.packages[0]!.files = [
    { file: 'app.js', type: 'chunk', from: 'main', size: 100, modules: [{ id: 'shared', source: 'app.ts', sourceType: 'src', bytes: 40 }] },
    { file: 'empty.js', type: 'asset', from: 'main', size: 0 },
  ]
  current.packages.push({
    id: 'independent',
    label: 'independent',
    type: 'independent',
    files: [{ file: 'independent/view.js', type: 'chunk', from: 'independent', size: 60, modules: [{ id: 'shared', source: 'app.ts', sourceType: 'src', bytes: 30 }] }],
  })
  current.modules = [{
    id: 'shared',
    source: 'app.ts',
    sourceType: 'src',
    packages: [{ packageId: 'main', files: ['app.js'] }, { packageId: 'independent', files: ['independent/view.js'] }],
  }]
  const artifacts = createDashboardArtifactSnapshot()
  artifacts.capture('app.js', '0123456789'.repeat(10))
  artifacts.capture('independent/view.js', 'x'.repeat(60))
  artifacts.capture('empty.js', '')
  await controller.update(current, artifacts.files, previous)
  await server.listen()
  const client = await connectClient(server)
  const call = (name: string, arg0: Record<string, unknown>) => client.callTool({ name: `weapp-vite_${name}`, arguments: { arg0 } })
  expect(await call('get-analyze-summary', { revision: 1 })).toMatchObject({
    structuredContent: { totals: { packages: 2, files: 3, modules: 1, bytes: 160, unmeasuredFiles: 0 }, previousAvailable: true },
  })
  expect(await call('query-analyze-packages', { revision: 1, type: 'independent' })).toMatchObject({
    structuredContent: { total: 1, items: [{ id: 'independent', bytes: 60 }] },
  })
  expect(await call('query-analyze-modules', { revision: 1, duplicateOnly: true })).toMatchObject({
    structuredContent: { total: 1, items: [{ id: 'shared', bytes: 40, estimatedSavingBytes: 40, hasIndependentPackage: true }] },
  })
  expect(await call('query-analyze-artifacts', { revision: 1, moduleId: 'shared', limit: 1 })).toMatchObject({
    structuredContent: { total: 2, nextOffset: 1, items: [{ packageId: 'main', file: 'app.js', size: 100 }] },
  })
  expect(await call('query-analyze-artifacts', { revision: 1, moduleId: 'shared', limit: 1, offset: 1 })).toMatchObject({
    structuredContent: { total: 2, nextOffset: null, items: [{ packageId: 'independent', file: 'independent/view.js' }] },
  })
  expect(await call('read-dashboard-file', { revision: 1, kind: 'artifact', path: 'app.js', range: { offset: 2, limit: 4 } })).toMatchObject({
    structuredContent: { content: '2345', size: 100, range: { offset: 2, totalCharacters: 100, nextOffset: 6 } },
  })
  expect(await call('compare-analyze-builds', { revision: 1, scope: 'file' })).toMatchObject({
    structuredContent: {
      available: true,
      totals: { currentBytes: 160, previousBytes: 85, deltaBytes: 75 },
      total: 4,
      items: [
        { file: 'independent/view.js', change: 'added', deltaBytes: 60 },
        { file: 'app.js', change: 'increased', deltaBytes: 20 },
        { file: 'removed.js', change: 'removed', deltaBytes: -5 },
        { file: 'empty.js', change: 'added', deltaBytes: 0 },
      ],
    },
  })
  expect(await call('get-analyze-summary', { revision: 1, target: 'previous' })).toMatchObject({
    structuredContent: { target: 'previous', totals: { bytes: 85 } },
  })
  controller.emitRuntimeEvents(Array.from({ length: 30 }, (_, index) => ({
    kind: index === 0 ? 'hmr' : 'system',
    level: index === 0 ? 'warning' : 'info',
    title: `event-${index}`,
    detail: 'bounded feed',
    profile: index === 0 ? { totalMs: 42, transformMs: 31 } : undefined,
  })))
  expect(await call('query-runtime-events', { kind: 'hmr', level: 'warning', since: '1970-01-01T00:00:00Z' })).toMatchObject({
    structuredContent: {
      total: 1,
      items: [{ title: 'event-0', profile: { totalMs: 42, transformMs: 31 } }],
      retention: { capacity: 24, retained: 24, dropped: 7 },
    },
  })
  for (const [name, arg0] of [
    ['get-analyze-summary', { revision: 0 }],
    ['query-analyze-packages', { revision: 1, limit: 101 }],
    ['query-analyze-modules', { revision: 1, sourceType: 'invalid' }],
    ['read-dashboard-file', { revision: 1, kind: 'source', path: '../secret', range: { offset: 0, limit: 10 } }],
  ] as const) {
    expect(await call(name, arg0)).toMatchObject({ isError: true })
  }
})

it('advertises only the listening native endpoint and preserves Vite pages, assets and history', async () => {
  const { server, projectRoot } = await createHost()
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
  const { server, controller } = await createHost()
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
    const failed = await createHost({ failSetup: true })
    await expect(failed.server.listen()).rejects.toThrow()
    const { server } = await createHost({ port: address.port })
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
