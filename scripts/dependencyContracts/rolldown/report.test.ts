import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { contractProgress } from './helpers.mjs'

const mocks = vi.hoisted(() => ({
  lease: vi.fn(),
  writeFile: vi.fn(),
  createProductContracts: vi.fn(),
  hooks: vi.fn(),
  escaped: vi.fn(),
}))
vi.mock('../../../packages/devtools-runtime/src/lease/machine.ts', () => ({ withMachineE2ELease: mocks.lease }))
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => {}),
  mkdtemp: vi.fn(async (prefix: string) => `${prefix}mock`),
  readdir: vi.fn(async () => ['bindingify-input-options-mock.mjs']),
  readFile: vi.fn(async (file: string) => file.endsWith('package.json') ? '{"name":"rolldown","version":"1.2.16"}' : 'official-entry'),
  rm: vi.fn(async () => {}),
  writeFile: mocks.writeFile,
}))
vi.mock('rolldown', () => ({ rolldown: vi.fn(), watch: vi.fn() }))
vi.mock('rolldown/experimental', () => ({ scan: vi.fn() }))
vi.mock('./product/index.mjs', async (importOriginal) => {
  const original = await importOriginal<typeof import('./product/index.mjs')>()
  return { ...original, createProductContracts: mocks.createProductContracts }
})
vi.mock('./hooks.mjs', () => ({ hooks: mocks.hooks, escaped: mocks.escaped }))

const initialArguments = process.argv
const initialExitCode = process.exitCode
const inventories = {
  product: ['generate-write', 'close', 'errors', 'inflight-error', 'repeat-build', 'watch', 'scan'],
  diagnostic: ['hooks', 'escaped', 'closing', 'failures', 'failFast', 'retention', 'watching', 'scanning'],
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  Object.values(mocks).forEach(mock => mock.mockReset())
  vi.useFakeTimers()
  vi.stubGlobal('gc', vi.fn())
  process.argv = [process.execPath, 'mock-runner.mjs', '--report', path.resolve('mock-report.json')]
  process.exitCode = undefined
  mocks.writeFile.mockResolvedValue(undefined)
  mocks.lease.mockImplementation(async action => action({ createChildScope: async () => ({ seal: async () => {}, complete: async () => {} }) }))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.argv = initialArguments
  process.exitCode = initialExitCode
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function execute(kind: keyof typeof inventories) {
  if (kind === 'product') {
    await import('./product/run.mjs')
  }
  else {
    await import('./run.mjs')
  }
  const report = JSON.parse(mocks.writeFile.mock.calls.at(-1)![1] as string) as {
    suite: string
    status: string
    rolldown?: string
    planned: string[]
    completed: string[]
    failed?: string
    notExecuted: string[]
    error: { message: string }
    results: Array<{ name: string, status: string, result?: unknown, observations?: unknown }>
  }
  return report
}

it.each(['product', 'diagnostic'] as const)('reports every unstarted %s contract after an acquisition failure', async (kind) => {
  const original = new Error('Machine ownership acquisition failed')
  mocks.lease.mockRejectedValueOnce(original)
  const report = await execute(kind)
  expect(report.status).toBe('failed')
  expect(report.error.message).toBe(String(original))
  expect(report.completed).toEqual([])
  expect(report.failed).toBeUndefined()
  expect(report.notExecuted).toEqual(inventories[kind])
  expect(process.exitCode).toBe(1)
})

it.each(['product', 'diagnostic'] as const)('retains %s observations and separates the failed case from cases not executed', async (kind) => {
  const original = new Error('Second contract failed')
  const names = inventories[kind]
  mocks.createProductContracts.mockReturnValue(Object.fromEntries(names.map((name, index) => [name, async () => {
    if (index === 1) {
      throw original
    }
    return { observed: name }
  }])))
  mocks.hooks.mockResolvedValueOnce({ observed: names[0] })
  mocks.escaped.mockRejectedValueOnce(original)
  const report = await execute(kind)
  expect(report.suite).toBe(kind === 'product' ? 'product-lifecycle' : 'dependency-internals')
  expect(report.status).toBe('failed')
  expect(report.rolldown).toBe('1.2.16')
  expect(report.completed).toEqual(names.slice(0, 1))
  expect(report.failed).toBe(names[1])
  expect(report.notExecuted).toEqual(names.slice(2))
  expect(report.results[0]).toMatchObject({ name: names[0], status: 'passed', [kind === 'product' ? 'observations' : 'result']: { observed: names[0] } })
  expect(report.results[1]).toMatchObject({ name: names[1], status: 'failed' })
  expect(report.error.message).toBe(String(original))
  expect(process.exitCode).toBe(1)
})

it.each([
  { planned: ['first', 'second'], completed: ['first'], currentContract: 'first', expected: { failed: undefined, notExecuted: ['second'] } },
  { planned: ['first', 'second'], completed: ['first', 'second'], expected: { failed: undefined, notExecuted: [] } },
])('does not relabel a completed contract after reporting or cleanup fails', ({ expected, ...report }) => {
  expect(contractProgress({ ...report, status: 'failed' })).toEqual(expected)
})
