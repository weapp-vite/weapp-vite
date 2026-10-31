import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { benchmarkShutdownEnvironment, startBenchmarkDevProcess } from './devShutdown'
import { historicalBaselineSha } from './historicalBaseline.mjs'
import { HISTORICAL_SHUTDOWN_WORK_BUDGET_MS } from './historicalShutdown'

const mocks = vi.hoisted(() => ({ start: vi.fn(), inspector: vi.fn(), sigint: vi.fn() }))
vi.mock('../../e2e/utils/dev-process', () => ({ startDevProcess: mocks.start }))
vi.mock('../../e2e/utils/dev-memory', () => ({ waitForInspectorUrl: mocks.inspector }))
vi.mock('./historicalShutdown', async importOriginal => ({ ...await importOriginal<typeof import('./historicalShutdown')>(), requestHistoricalBaselineShutdown: mocks.sigint }))

const output = 'historical inspector output'
const inspectorUrl = 'ws://127.0.0.1:1/registered-inspector'
const controller = { getOutput: () => output }

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(1000)
  mocks.start.mockReturnValue(controller)
  mocks.inspector.mockResolvedValue(inspectorUrl)
  mocks.sigint.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('requests the historical baseline Ctrl+C path through its own inspector', async () => {
  const args = ['measured-cli.mjs', 'dev']
  const env = benchmarkShutdownEnvironment('baseline', historicalBaselineSha)
  const result = startBenchmarkDevProcess(args, { env, all: true })
  expect(result).toBe(controller)
  expect(mocks.start).toHaveBeenCalledWith(process.execPath, args, {
    env,
    all: true,
    ipc: true,
    gracefulShutdown: expect.any(Function),
  })
  expect(mocks.inspector).not.toHaveBeenCalled()
  expect(mocks.sigint).not.toHaveBeenCalled()

  const requestShutdown = mocks.start.mock.calls[0]![2].gracefulShutdown as () => Promise<void>
  await requestShutdown()
  expect(mocks.inspector).toHaveBeenCalledWith(expect.any(Function), 'historical baseline shutdown', 10_000)
  expect(mocks.inspector.mock.calls[0]![0]()).toBe(output)
  expect(mocks.sigint).toHaveBeenCalledWith(inspectorUrl, expect.stringMatching(/package\.json$/), HISTORICAL_SHUTDOWN_WORK_BUDGET_MS)
})

it.each([
  ['optimized', historicalBaselineSha],
  ['baseline', 'a'.repeat(40)],
  ['optimized', 'a'.repeat(40)],
] as const)('preserves the normal IPC contract for %s %s', (side, commit) => {
  const env = benchmarkShutdownEnvironment(side, commit)
  startBenchmarkDevProcess(['measured-cli.mjs', 'dev'], { env, ipc: true })
  expect(mocks.start.mock.calls[0]![2]).toEqual({ env, ipc: true })
  expect(mocks.inspector).not.toHaveBeenCalled()
  expect(mocks.sigint).not.toHaveBeenCalled()
})

it('keeps standalone benchmarks on the normal shutdown contract', () => {
  const env = {}
  startBenchmarkDevProcess(['measured-cli.mjs', 'dev'], { env })
  expect(mocks.start.mock.calls[0]![2]).toEqual({ env })
})

it('uses the explicit measured identity instead of an inherited baseline identity', () => {
  vi.stubEnv('WEAPP_VITE_PERF_SHUTDOWN_SIDE', 'baseline')
  vi.stubEnv('WEAPP_VITE_PERF_SHUTDOWN_COMMIT', historicalBaselineSha)
  const env = { ...process.env, ...benchmarkShutdownEnvironment('optimized', historicalBaselineSha) }
  startBenchmarkDevProcess(['measured-cli.mjs', 'dev'], { env })
  expect(mocks.start.mock.calls[0]![2]).toEqual({ env })
})

it.each(['inspector', 'sigint'] as const)('preserves a failed historical %s shutdown request', async (stage) => {
  const failure = new Error('Historical shutdown request failed')
  mocks[stage].mockRejectedValueOnce(failure)
  startBenchmarkDevProcess(['measured-cli.mjs', 'dev'], { env: benchmarkShutdownEnvironment('baseline', historicalBaselineSha) })
  const requestShutdown = mocks.start.mock.calls[0]![2].gracefulShutdown as () => Promise<void>
  await expect(requestShutdown()).rejects.toBe(failure)
  if (stage === 'inspector') {
    expect(mocks.sigint).not.toHaveBeenCalled()
  }
})

it.each([pathToFileURL(process.cwd()), '.'])('normalizes shutdown inspection anchor for cwd %s', async (cwd) => {
  startBenchmarkDevProcess(['measured-cli.mjs', 'dev'], { cwd, env: benchmarkShutdownEnvironment('baseline', historicalBaselineSha) })
  const requestShutdown = mocks.start.mock.calls[0]![2].gracefulShutdown as () => Promise<void>
  await requestShutdown()
  expect(mocks.sigint).toHaveBeenCalledWith(inspectorUrl, path.join(process.cwd(), 'package.json'), HISTORICAL_SHUTDOWN_WORK_BUDGET_MS)
})

it('deducts inspector discovery from the same bounded shutdown budget', async () => {
  let now = 1000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  mocks.inspector.mockImplementation(async () => {
    now += 15_000
    return inspectorUrl
  })
  startBenchmarkDevProcess(['measured-cli.mjs', 'dev'], { env: benchmarkShutdownEnvironment('baseline', historicalBaselineSha) })
  const requestShutdown = mocks.start.mock.calls[0]![2].gracefulShutdown as () => Promise<void>
  await requestShutdown()
  expect(mocks.sigint).toHaveBeenCalledWith(inspectorUrl, expect.any(String), HISTORICAL_SHUTDOWN_WORK_BUDGET_MS - 15_000)
})

it('rejects exhausted discovery without starting a new shutdown budget', async () => {
  let now = 1000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  mocks.inspector.mockImplementation(async () => {
    now += HISTORICAL_SHUTDOWN_WORK_BUDGET_MS
    return inspectorUrl
  })
  startBenchmarkDevProcess(['measured-cli.mjs', 'dev'], { env: benchmarkShutdownEnvironment('baseline', historicalBaselineSha) })
  const requestShutdown = mocks.start.mock.calls[0]![2].gracefulShutdown as () => Promise<void>
  await expect(requestShutdown()).rejects.toThrow('budget exhausted during inspector discovery')
  expect(mocks.sigint).not.toHaveBeenCalled()
})

it('freezes a relative require anchor before the driver cwd changes', async () => {
  const initial = path.join(os.tmpdir(), 'performance-driver-origin')
  const currentDirectory = vi.spyOn(process, 'cwd').mockReturnValue(initial)
  startBenchmarkDevProcess(['measured-cli.mjs', 'dev'], { cwd: 'inner', env: benchmarkShutdownEnvironment('baseline', historicalBaselineSha) })
  currentDirectory.mockReturnValue(path.join(os.tmpdir(), 'performance-driver-moved'))
  const requestShutdown = mocks.start.mock.calls[0]![2].gracefulShutdown as () => Promise<void>
  await requestShutdown()
  expect(mocks.sigint).toHaveBeenCalledWith(inspectorUrl, path.join(initial, 'inner', 'package.json'), HISTORICAL_SHUTDOWN_WORK_BUDGET_MS)
})
