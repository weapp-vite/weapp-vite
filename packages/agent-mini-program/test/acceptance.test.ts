import type { AcceptanceOptions } from '../src/acceptance.js'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { hash, loadConfig, loadProjectConfig } from '@weapp-agent/core'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { z } from 'zod'
import { AcceptanceService } from '../src/acceptance.js'
import { createAcceptanceMcpServer } from '../src/server.js'
import { acceptanceDiagnostics } from './helpers/acceptanceDiagnostics.js'

let temporary: string
let root: string
let state: string
let previousState: string | undefined
const services: AcceptanceService[] = []
beforeEach(async () => {
  temporary = await mkdtemp(path.join(tmpdir(), 'weapp-acceptance-'))
  root = path.join(temporary, 'project')
  state = path.join(temporary, 'state')
  previousState = process.env.WEAPP_AGENT_STATE_DIR
  process.env.WEAPP_AGENT_STATE_DIR = state
  await mkdir(path.join(root, 'src/pages'), { recursive: true })
})
afterEach(async () => {
  await Promise.all(services.splice(0).map(s => s.close()))
  if (previousState === undefined) {
    delete process.env.WEAPP_AGENT_STATE_DIR
  }
  else { process.env.WEAPP_AGENT_STATE_DIR = previousState }
  await rm(temporary, { recursive: true, force: true })
})
async function fixture(kind = 'native', overrides: Record<string, unknown> = {}) {
  await writeFile(path.join(root, 'package.json'), JSON.stringify({
    dependencies: { 'weapp-vite': '7.4.0', ...(kind === 'wevu' ? { wevu: '1' } : {}) },
    scripts: { build: 'node -e "console.log(42)"' },
  }))
  await writeFile(path.join(root, `src/pages/index.${kind === 'wevu' ? 'vue' : 'wxml'}`), '<view>0</view>')
  await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'wx-test-fixture', miniprogramRoot: 'dist' }))
  await writeFile(path.join(root, 'weapp-agent.config.json'), JSON.stringify({
    verification: [{ kind: 'build', command: process.execPath, args: ['-e', 'console.log("built")'] }],
    ...overrides,
  }))
}
async function service(options: AcceptanceOptions = {}) {
  const result = await AcceptanceService.create(root, options)
  services.push(result)
  return result
}
async function complete(s: AcceptanceService) {
  return s.wait((await s.start()).jobId)
}

const matrix = [
  'model-free',
  'missing-runtime',
  'build-failure',
  'missing-required',
  'untrusted',
  'script-change',
  'stale-source',
  'cancel',
  'timeout',
  'restart',
] as const
// Twenty fixed contract tasks across both supported project shapes. This is not a real-host/product benchmark.
it.each(['native', 'wevu'].flatMap(kind => matrix.map(task => ({ kind, task }))))('$kind / $task', async ({ kind, task }) => {
  const buildOnly = { requiredChecks: ['build'] }
  await fixture(kind, task === 'missing-runtime' ? {} : { acceptance: buildOnly })
  if (task === 'model-free') {
    expect((await loadProjectConfig(root)).model).toBeUndefined()
    await expect(loadConfig(root)).rejects.toThrow('requires model')
    const s = await service({ trust: true })
    expect((await s.inspect()).modelRequired).toBe(false)
    expect((await complete(s)).passed).toBe(true)
  }
  else if (task === 'missing-runtime') {
    const report = await complete(await service({ trust: true }))
    expect(report.status).toBe('unverified')
    expect(report.passed).toBe(false)
    expect(report.checks.find(c => c.kind === 'devtools')?.status).toBe('unverified')
  }
  else if (task === 'build-failure') {
    await fixture(kind, { verification: [{ kind: 'build', command: process.execPath, args: ['-e', 'process.exit(7)'] }] })
    const report = await complete(await service({ trust: true }))
    expect(report.status).toBe('failed')
    expect(report.checks[0]?.exitCode).toBe(7)
  }
  else if (task === 'missing-required') {
    await fixture(kind, { acceptance: { requiredChecks: ['typecheck', 'build'] } })
    expect((await complete(await service({ trust: true }))).passed).toBe(false)
  }
  else if (task === 'untrusted') {
    const report = await complete(await service())
    expect(report.status).toBe('action_required')
    expect(report.checks).toEqual([])
  }
  else if (task === 'script-change') {
    const s = await service({ trust: true })
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'weapp-vite': '7.4.0' }, scripts: { build: 'unreviewed' } }))
    expect((await complete(s)).status).toBe('action_required')
  }
  else if (task === 'stale-source') {
    const s = await service({ trust: true })
    const report = await complete(s)
    expect(report.passed).toBe(true)
    await writeFile(path.join(root, 'src/new.ts'), 'export const changed = true')
    const stale = await s.report(report.jobId)
    expect(stale.passed).toBe(false)
    expect(stale.snapshot.stale).toBe(true)
  }
  else if (task === 'cancel' || task === 'timeout') {
    await fixture(kind, {
      verification: [{ kind: 'build', command: process.execPath, args: ['-e', 'setTimeout(()=>{},30000)'] }],
      acceptance: { ...buildOnly, timeoutMs: task === 'timeout' ? 150 : 10_000 },
    })
    const s = await service({ trust: true })
    const started = await s.start()
    if (task === 'cancel') {
      await s.cancel(started.jobId)
    }
    const report = await s.wait(started.jobId)
    expect(report.status).toBe(task === 'cancel' ? 'cancelled' : 'timed_out')
    expect(report.passed).toBe(false)
  }
  else {
    const s = await service({ trust: true })
    const first = await complete(s)
    await s.close()
    const reloaded = await (await service()).report(first.jobId)
    expect(reloaded.passed).toBe(true)
    expect(reloaded.startedAt).toBe(first.startedAt)
  }
})

async function runtimeFixture(
  options: { wrongText?: boolean, disconnect?: boolean, noConsole?: boolean, mutate?: boolean } = {},
  record?: ReturnType<typeof acceptanceDiagnostics>['record'],
) {
  await fixture('wevu', { acceptance: { scenarios: ['acceptance.json'] } })
  await writeFile(path.join(root, 'acceptance.json'), JSON.stringify({
    version: 1,
    name: 'counter',
    steps: [
      { action: 'route', path: '/pages/index/index' },
      { action: 'wait', selector: '#count' },
      { action: 'find', selector: '#count' },
      { action: 'input', selector: '#input', value: 'hello' },
      { action: 'tap', selector: '#increment' },
      { action: 'assert', selector: '#count', text: '1', timeoutMs: 100 },
      { action: 'screenshot' },
    ],
  }))
  await mkdir(path.join(root, 'node_modules/weapp-vite/bin'), { recursive: true })
  await writeFile(path.join(root, 'node_modules/weapp-vite/bin/weapp-vite.js'), '')
  const calls: string[] = []
  let connections = 0
  let closed = 0
  const connect: AcceptanceOptions['connect'] = async () => {
    record?.('runtime:connect', 'completed')
    connections++
    return {
      close: async () => {
        closed++
        record?.('runtime:close', 'completed')
      },
      tools: ['devtools_connect', 'devtools_route', 'runtime_find_node', 'runtime_wait_node', 'runtime_input_node', 'runtime_tap_node', 'devtools_capture', 'devtools_console'].map(name => ({
        name: `weapp__weapp_${name}`,
        description: name,
        mutates: true,
        schema: z.record(z.string(), z.unknown()),
        async execute(input) {
          record?.(`runtime:${name}`, 'started')
          calls.push(name)
          const args = input as Record<string, any>
          if (options.disconnect && name === 'runtime_tap_node') {
            throw new Error('DEVTOOLS_WS_CONNECT_ERROR')
          }
          if (options.noConsole && name === 'devtools_console') {
            throw new Error('console disconnected')
          }
          if (options.mutate && name === 'runtime_tap_node') {
            record?.('runtime:source-write', 'started')
            await writeFile(path.join(root, 'src/changed.ts'), 'changed')
            record?.('runtime:source-write', 'completed')
          }
          if (name === 'devtools_capture') {
            await writeFile(path.join(root, args.outputPath), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64'))
          }
          const result = name === 'devtools_connect'
            ? { projectPath: root, systemInfo: { platform: 'devtools' } }
            : name === 'runtime_find_node'
              ? { text: options.wrongText ? '0' : '1' }
              : name === 'devtools_console' ? { logs: [{ message: 'counter changed' }] } : { found: true }
          record?.(`runtime:${name}`, 'completed')
          return { text: JSON.stringify({ result }), data: { result } }
        },
      })),
    }
  }
  return { connect, calls, counts: () => ({ connections, closed }) }
}

it('executes deterministic scenarios with one connection and exposes screenshots and logs', async () => {
  const runtime = await runtimeFixture()
  const s = await service({ trust: true, connect: runtime.connect })
  const report = await complete(s)
  expect(report.status).toBe('passed')
  expect(report.runtime).toBe('wechat-devtools')
  expect(report.steps).toHaveLength(7)
  expect(runtime.calls.filter(c => c === 'runtime_tap_node')).toHaveLength(1)
  expect(runtime.counts()).toEqual({ connections: 1, closed: 1 })
  expect((await s.artifact(report.jobId, 'screenshot-1.png')).mediaType).toBe('image/png')
  expect((await s.artifact(report.jobId, 'console.json')).data).toContain('counter changed')
  await expect(s.artifact(report.jobId, '../report.json')).rejects.toThrow('Unknown')
})
it.each(['wrongText', 'disconnect', 'noConsole', 'mutate'] as const)('never passes runtime %s failures', async (failure) => {
  const diagnostics = acceptanceDiagnostics(`runtime-${failure}`)
  const runtime = await diagnostics.run('fixture', () => runtimeFixture({ [failure]: true }, diagnostics.record))
  const s = await diagnostics.run('service:create', () => service({ trust: true, connect: runtime.connect }))
  const started = await diagnostics.run('service:start', () => s.start())
  const report = await diagnostics.run('service:wait', () => s.wait(started.jobId))
  expect(report.passed).toBe(false)
  expect(report.status).toBe(failure === 'noConsole' || failure === 'mutate' ? 'unverified' : 'failed')
  expect(runtime.calls.filter(c => c === 'runtime_tap_node')).toHaveLength(1)
  expect(runtime.counts().closed).toBe(1)
})
it('invalidates trust when scenario actions change', async () => {
  const runtime = await runtimeFixture()
  const s = await service({ trust: true, connect: runtime.connect })
  await writeFile(path.join(root, 'acceptance.json'), '{}')
  expect((await complete(s)).status).toBe('action_required')
  expect(runtime.calls).toEqual([])
})
it('invalidates trust when the AppID or build target configuration changes', async () => {
  await fixture()
  const s = await service({ trust: true })
  await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'a-different-app', miniprogramRoot: 'other' }))
  expect((await complete(s)).status).toBe('action_required')
})
it('serializes tasks across service instances and releases on cancellation', async () => {
  await fixture('native', { verification: [{ kind: 'build', command: process.execPath, args: ['-e', 'setTimeout(()=>{},30000)'] }] })
  const first = await service({ trust: true })
  const second = await service()
  const job = await first.start()
  expect((await second.start()).status).toBe('action_required')
  await first.cancel(job.jobId)
  const next = await second.start()
  expect(next.status).toBe('running')
  await second.cancel(next.jobId)
})
it('reports an abandoned job as interrupted without replaying any steps', async () => {
  await fixture('native', { acceptance: { requiredChecks: ['build'] } })
  const s = await service({ trust: true })
  const completed = await complete(s)
  const file = path.join(state, 'acceptance', hash(s.root), completed.jobId, 'report.json')
  await writeFile(file, JSON.stringify({ ...completed, status: 'running', passed: false, ownerPid: 2147483647 }))
  const other = await service()
  expect((await other.report(completed.jobId)).status).toBe('interrupted')
  expect(JSON.parse(await readFile(file, 'utf8')).status).toBe('running')
})
it('serves the five MCP operations without a model and supports asynchronous completion', async () => {
  await fixture('native', { acceptance: { requiredChecks: ['build'] } })
  const s = await service({ trust: true })
  const server = createAcceptanceMcpServer(s)
  const client = new Client({ name: 'acceptance-contract', version: '1' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    expect((await client.listTools()).tools).toHaveLength(5)
    const info = await client.callTool({ name: 'weapp_project_inspect', arguments: {} })
    expect((info.structuredContent as Record<string, unknown>)?.modelRequired).toBe(false)
    const started = await client.callTool({ name: 'weapp_acceptance_start', arguments: {} })
    const jobId = (started.structuredContent as Record<string, unknown>)?.jobId
    const report = await s.wait(String(jobId))
    expect(report.passed).toBe(true)
    const read = await client.callTool({ name: 'weapp_acceptance_report', arguments: { jobId } })
    expect((read.structuredContent as Record<string, unknown>)?.version).toBe(2)
    const invalid = await client.callTool({ name: 'weapp_acceptance_report', arguments: { jobId: 'not-a-uuid' } })
    expect(invalid.isError).toBe(true)
  }
  finally {
    await client.close()
    await server.close()
  }
})
it('does not accept source edits performed by a verification command as fresh evidence', async () => {
  await fixture('native', {
    acceptance: { requiredChecks: ['build'] },
    verification: [{ kind: 'build', command: process.execPath, args: ['-e', 'require("node:fs").writeFileSync("src/generated.ts", "changed")'] }],
  })
  const report = await complete(await service({ trust: true }))
  expect(report.snapshot.stale).toBe(true)
  expect(report.passed).toBe(false)
})
it('keeps evidence stale when a later command reverts an earlier source mutation', async () => {
  await fixture('native', {
    acceptance: { requiredChecks: ['build', 'test'] },
    verification: [
      { kind: 'build', command: process.execPath, args: ['-e', 'require("node:fs").writeFileSync("src/transient.ts", "changed")'] },
      { kind: 'test', command: process.execPath, args: ['-e', 'require("node:fs").unlinkSync("src/transient.ts")'] },
    ],
  })
  const report = await complete(await service({ trust: true }))
  expect(report.snapshot.before).toBe(report.snapshot.after)
  expect(report.snapshot.stale).toBe(true)
  expect(report.passed).toBe(false)
})
it('stops before a second command when the first command changes trusted configuration', async () => {
  await fixture('native', {
    verification: [
      { kind: 'build', command: process.execPath, args: ['-e', 'require("node:fs").writeFileSync("package.json", "{}")'] },
      { kind: 'test', command: process.execPath, args: ['-e', 'require("node:fs").writeFileSync("should-not-run", "unsafe")'] },
    ],
  })
  const report = await complete(await service({ trust: true }))
  expect(report.status).toBe('action_required')
  await expect(readFile(path.join(root, 'should-not-run'))).rejects.toThrow('ENOENT')
})
it('closes tasks that are still in preflight without orphaning a process', async () => {
  await fixture('native', { verification: [{ kind: 'build', command: process.execPath, args: ['-e', 'setTimeout(()=>{},30000)'] }] })
  const s = await service({ trust: true })
  const starting = s.start()
  await s.close()
  const result = await starting
  expect(result.passed).toBe(false)
  expect(result.status).not.toBe('running')
})
it('classifies command deadlines separately from an assertion or build failure', async () => {
  await fixture('native', {
    verification: [{ kind: 'build', command: process.execPath, args: ['-e', 'setTimeout(()=>{},30000)'], timeoutMs: 100 }],
  })
  const report = await complete(await service({ trust: true }))
  expect(report.status).toBe('timed_out')
  expect(report.checks[0]?.timedOut).toBe(true)
})
