import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { Client, InMemoryTransport, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { AcceptanceService } from '@weapp-vite/acceptance'
import { afterEach, expect, it, vi } from 'vitest'
import { acceptanceRuntime, createRuntimeAcceptanceService } from '../src/acceptance'
import { createWeappViteMcpServerFactory } from '../src/server'
import { RuntimeSessionManager } from '../src/server/runtime'

const roots: string[] = []
const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) {
    await close()
  }
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})
async function fixture(runtime = false) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'mcp-acceptance-')))
  roots.push(root)
  await mkdir(path.join(root, 'src'))
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'weapp-vite': '7.4.0' } }))
  await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'wx-test-fixture' }))
  await writeFile(path.join(root, 'src/app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
  await writeFile(path.join(root, 'weapp-acceptance.config.json'), JSON.stringify({
    verification: [{ kind: 'build', command: process.execPath, args: ['-e', 'setTimeout(() => console.log("built"), 100)'] }],
    acceptance: { requiredChecks: runtime ? ['build', 'devtools'] : ['build'], scenarios: runtime ? ['scenario.json'] : [] },
  }))
  if (runtime) {
    await writeFile(path.join(root, 'scenario.json'), JSON.stringify({ version: 1, name: 'counter', steps: [
      { action: 'route', path: '/pages/index/index' },
      { action: 'tap', selector: '#increment' },
      { action: 'assert', selector: '#count', text: '1' },
    ] }))
  }
  const trust = await AcceptanceService.create(root, { trust: true })
  await trust.close()
  return root
}
async function finish(client: Client, jobId: string) {
  for (let i = 0; i < 100; i++) {
    const response = await client.callTool({ name: 'weapp_acceptance_status', arguments: { jobId } })
    const report = response.structuredContent as Record<string, unknown>
    if (report.status !== 'running') {
      return report
    }
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error('Acceptance did not finish')
}
it('shares jobs across protocol sessions and preserves them after one client disconnects', async () => {
  const root = await fixture()
  const factory = await createWeappViteMcpServerFactory({ workspaceRoot: root })
  cleanups.push(factory.close)
  async function connect() {
    const client = new Client({ name: 'session', version: '1' })
    const server = factory.createServer()
    const [a, b] = InMemoryTransport.createLinkedPair()
    await server.connect(b)
    await client.connect(a)
    cleanups.push(() => server.close(), () => client.close())
    return client
  }
  const first = await connect()
  const started = await first.callTool({ name: 'weapp_acceptance_start', arguments: {} })
  const id = String((started.structuredContent as Record<string, unknown>)?.jobId)
  await first.close()
  const second = await connect()
  expect((await finish(second, id)).passed).toBe(true)
  const saved = await second.callTool({ name: 'weapp_acceptance_report', arguments: { jobId: id } })
  expect((saved.structuredContent as Record<string, unknown>)?.version).toBe(2)
})
it('supports actual HTTP start, polling and report requests with the same service', async () => {
  const root = await fixture()
  const factory = await createWeappViteMcpServerFactory({ workspaceRoot: root })
  const handler = createMcpHandler(factory.createServer, { legacy: 'stateless' })
  const nodeHandler = toNodeHandler(handler)
  const server = http.createServer((req, res) => {
    void nodeHandler(req, res)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(async () => {
    await factory.close()
    await handler.close()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  })
  const address = server.address() as { port: number }
  const client = new Client({ name: 'http-acceptance', version: '1' })
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`)))
  cleanups.push(() => client.close())
  const completed = new Set<string>()
  for (let iteration = 0; iteration < 8; iteration++) {
    const started = await client.callTool({ name: 'weapp_acceptance_start', arguments: {} })
    const id = String((started.structuredContent as Record<string, unknown>)?.jobId)
    expect(completed.has(id)).toBe(false)
    const status = await finish(client, id)
    const saved = await client.callTool({ name: 'weapp_acceptance_report', arguments: { jobId: id } })
    expect(status.passed, JSON.stringify(saved.structuredContent ?? saved.content)).toBe(true)
    expect(saved.structuredContent).toMatchObject({ jobId: id, status: 'passed', passed: true })
    completed.add(id)
  }
}, 30_000)
it('uses runtime callbacks in process with project-scoped artifacts and subscriptions', async () => {
  const root = await fixture(true)
  let count = 0
  let connections = 0
  const program = new EventEmitter() as any
  const page = { path: 'pages/index/index', $: async () => ({ tagName: 'text', text: async () => String(count), tap: async () => {
    count++
    program.emit('console', { level: 'log', args: ['task-log'] })
  } }) }
  Object.assign(program, { currentPage: async () => page, systemInfo: async () => ({ platform: 'devtools' }), reLaunch: async () => {
    count = 0
    return page
  }, screenshot: async () => Buffer.from('89504e470d0a1a0a', 'hex'), disconnect: () => {} })
  const hooks = { connectMiniProgram: async () => {
    connections++
    return program
  } }
  const observer = new RuntimeSessionManager(root, hooks)
  await observer.withMiniProgram({ projectPath: root }, async () => {})
  program.emit('console', { level: 'log', args: ['before-task'] })
  const hostManager = new RuntimeSessionManager(path.dirname(root), hooks)
  const service = await AcceptanceService.create(root, { connect: acceptanceRuntime(hostManager) })
  cleanups.push(async () => {
    await service.close()
    await hostManager.dispose()
    await observer.dispose()
  })
  const report = await service.wait((await service.start()).jobId)
  expect(report.passed, report.reason).toBe(true)
  const logs = await service.artifact(report.jobId, 'console.json')
  expect(logs.data).toContain('task-log')
  expect(logs.data).not.toContain('before-task')
  expect(connections).toBe(1)
  expect(program.listenerCount('console')).toBe(2)
  await service.close()
  await hostManager.dispose()
  expect(program.listenerCount('console')).toBe(1)
  expect(observer.getLogs().some(entry => entry.message.includes('task-log'))).toBe(true)
})

it('holds the runtime lease through preparation and cancellation without starting interactions', async () => {
  const root = await fixture(true)
  let begin!: () => void
  let release!: () => void
  const preparing = new Promise<void>((resolve) => {
    begin = resolve
  })
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const connectMiniProgram = vi.fn()
  const hooks = { connectMiniProgram, prepareProject: async () => {
    begin()
    await pending
  } }
  const service = await createRuntimeAcceptanceService(root, {}, hooks)
  const other = new RuntimeSessionManager(root, hooks)
  cleanups.push(async () => {
    await service.close()
    await other.dispose()
  })
  const job = await service.start()
  await preparing
  await expect(other.close({ projectPath: root })).rejects.toThrow('Runtime busy')
  const cancelled = service.cancel(job.jobId)
  release()
  expect((await cancelled).status).toBe('cancelled')
  expect(connectMiniProgram).not.toHaveBeenCalled()
  await expect(other.close({ projectPath: root })).resolves.toBeUndefined()
})

it('retains a borrowed connection until the last manager detaches', async () => {
  const root = await fixture()
  const program = Object.assign(new EventEmitter(), { disconnect: vi.fn() }) as any
  const hooks = { connectMiniProgram: async () => program }
  const owner = new RuntimeSessionManager(root, hooks)
  const borrower = owner.fork()
  await owner.withMiniProgram({ projectPath: root }, async () => {})
  await borrower.withMiniProgram({ projectPath: root }, async () => {})
  await owner.dispose()
  expect(program.disconnect).not.toHaveBeenCalled()
  await borrower.dispose()
  expect(program.disconnect).toHaveBeenCalledOnce()
})

it('inspects the explicitly selected project inside a parent workspace', async () => {
  const root = await fixture()
  await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages: [projects/*]\n')
  const nested = path.join(root, 'projects/mini')
  await mkdir(nested, { recursive: true })
  await writeFile(path.join(nested, 'package.json'), JSON.stringify({ dependencies: { 'weapp-vite': '7.4.0' } }))
  const factory = await createWeappViteMcpServerFactory({ workspaceRoot: nested })
  const server = factory.createServer()
  const client = new Client({ name: 'nested-project', version: '1' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(b)
  await client.connect(a)
  cleanups.push(factory.close, () => server.close(), () => client.close())
  const result = await client.callTool({ name: 'weapp_project_inspect', arguments: {} })
  expect((result.structuredContent as any).project.root).toBe(nested)
})
