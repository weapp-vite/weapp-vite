import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { benchmarkShutdownEnvironment, startBenchmarkDevProcess } from './devShutdown'
import { historicalBaselineSha } from './historicalBaseline.mjs'

const mocks = vi.hoisted(() => ({ start: vi.fn(), inspector: vi.fn(), sigint: vi.fn() }))
vi.mock('../../e2e/utils/dev-process', () => ({ startDevProcess: mocks.start }))
vi.mock('../../e2e/utils/dev-memory', () => ({ waitForInspectorUrl: mocks.inspector }))
vi.mock('./historicalShutdown', () => ({ requestHistoricalBaselineShutdown: mocks.sigint }))

const output = 'historical inspector output'
const inspectorUrl = 'ws://127.0.0.1:1/registered-inspector'
const controller = { getOutput: () => output }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.start.mockReturnValue(controller)
  mocks.inspector.mockResolvedValue(inspectorUrl)
  mocks.sigint.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllEnvs())

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
  expect(mocks.sigint).toHaveBeenCalledWith(inspectorUrl, expect.stringMatching(/package\.json$/), 10_000)
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
  expect(mocks.sigint).toHaveBeenCalledWith(inspectorUrl, path.join(process.cwd(), 'package.json'), 10_000)
})
