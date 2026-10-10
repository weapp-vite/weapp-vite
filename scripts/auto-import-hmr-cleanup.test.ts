import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  stop: vi.fn(),
  waitForOutput: vi.fn(),
  removeFailure: undefined as Error | undefined,
  errors: [] as unknown[],
  events: [] as string[],
  root: '',
  project: '',
  completed: false,
}))

vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return {
    ...actual,
    rm: vi.fn(async (...args: Parameters<typeof actual.rm>) => {
      if (args[0] === path.dirname(fixture.project)) {
        fixture.events.push('fixture-remove')
        if (fixture.removeFailure) {
          throw fixture.removeFailure
        }
      }
      return actual.rm(...args)
    }),
    writeFile: vi.fn(async (...args: Parameters<typeof actual.writeFile>) => {
      const file = String(args[0])
      if (path.basename(file) === 'report.json') {
        fixture.events.push('report')
      }
      await actual.writeFile(...args)
      if (['error.txt', 'report.md'].includes(path.basename(file))) {
        fixture.completed = true
      }
    }),
  }
})
vi.mock('../e2e/utils/dev-process', () => ({
  startDevProcess: (_command: string, args: string[]) => {
    fixture.project = args[2]!
    return {
      waitForOutput: fixture.waitForOutput,
      waitFor: async (task: Promise<unknown>) => task,
      getOutput: () => '',
      stop: fixture.stop,
    }
  },
}))
vi.mock('../e2e/utils/dev-memory', () => ({
  waitForInspectorUrl: async () => 'unused-inspector',
  sampleHeapAfterGc: async () => undefined,
}))
vi.mock('./workspace-hmr/statefulArtifactMeasurement', () => ({
  measureStatefulTemplateArtifact: async ({ measure, signal }: { measure: (signal: AbortSignal) => Promise<number>, signal: AbortSignal }) => measure(signal),
}))
vi.mock('./workspace-hmr/scenarios', () => ({ parseStatefulHmrControlSource: vi.fn() }))
vi.mock('./workspace-hmr/statefulAuditClient', () => ({ StatefulHmrAuditClient: class {} }))
vi.mock('../packages/weapp-vite/scripts/utils/benchmarkDependencies', () => ({ linkBenchmarkDependencies: vi.fn() }))
vi.mock('../packages/weapp-vite/scripts/utils/config-file', () => ({ patchProjectConfigFile: vi.fn() }))
vi.mock('../packages/weapp-vite/scripts/utils/benchmark-tsconfig', () => ({ writeBenchmarkResolverFile: vi.fn() }))
vi.mock('../packages/weapp-vite/scripts/utils/benchmarkTarget', () => ({
  createBenchmarkPath: () => '',
  resolveBenchmarkTarget: () => ({
    workspaceRootDir: fixture.root,
    workspaceRootNodeModulesDir: path.join(fixture.root, 'node_modules'),
    workspaceWeappViteDir: path.join(fixture.root, 'packages/weapp-vite'),
  }),
}))
vi.mock('../packages/weapp-vite/scripts/utils/hmrOutput', () => ({
  HMR_OUTPUT_POLL_INTERVAL_MS: 10,
  measureFileMarkerUpdate: async () => 1,
}))
vi.mock('../packages/weapp-vite/scripts/utils/hmrDiagnosticEvidence', () => ({
  readDiagnosticProfile: vi.fn(),
  snapshotOutputCheckpoint: vi.fn(),
  snapshotPublishedOutputs: vi.fn(),
}))

const originalExitCode = process.exitCode
const filesystem = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  fixture.root = await filesystem.mkdtemp(path.join(os.tmpdir(), 'auto-import-cleanup-'))
  fixture.project = ''
  fixture.completed = false
  fixture.removeFailure = undefined
  fixture.errors = []
  fixture.events = []
  fixture.waitForOutput.mockImplementation(async () => {
    const output = path.join(fixture.project, 'dist/pages/bench-hmr-auto-import/index.wxml')
    await filesystem.mkdir(path.dirname(output), { recursive: true })
    await filesystem.writeFile(output, '<view />')
  })
  fixture.stop.mockImplementation(async () => {
    fixture.events.push('stop')
  })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(error => fixture.errors.push(error))
  vi.stubEnv('BENCH_ITERATIONS', '1')
  vi.stubEnv('BENCH_SCENARIOS', '1')
  vi.stubEnv('BENCH_CONFIGURATIONS', JSON.stringify(['1:manual']))
  vi.stubEnv('BENCH_REPORT_DIR', path.join(fixture.root, 'reports'))
  vi.stubEnv('AUTO_IMPORT_BENCH_PAIRED', '0')
  vi.stubEnv('AUTO_IMPORT_HMR_DIAGNOSTIC', '0')
  vi.stubEnv('AUTO_IMPORT_HMR_DIAGNOSTIC_PROFILE', '0')
  vi.stubEnv('AUTO_IMPORT_HMR_DIAGNOSTIC_PAIR', '0')
})

afterEach(async () => {
  process.exitCode = originalExitCode
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  await filesystem.rm(fixture.root, { recursive: true, force: true })
})

async function runBenchmark() {
  await import('../packages/weapp-vite/scripts/benchmark-auto-import-hmr')
  await vi.waitFor(() => {
    expect(fixture.completed).toBe(true)
  })
}

async function readFailureEvidence(): Promise<unknown> {
  return JSON.parse(await filesystem.readFile(path.join(fixture.root, 'reports/error.txt'), 'utf8'))
}

describe('auto-import HMR benchmark cleanup', () => {
  it('retains the sampling failure and stop failure, and preserves the live fixture', async () => {
    const bodyError = new Error('emitted marker failed')
    const stopError = new Error('process inspection timed out')
    fixture.waitForOutput.mockRejectedValue(bodyError)
    fixture.stop.mockRejectedValue(stopError)
    await runBenchmark()
    expect(fixture.errors).toHaveLength(1)
    expect(fixture.errors[0]).toBeInstanceOf(AggregateError)
    expect(fixture.errors[0]).toMatchObject({ errors: [bodyError, stopError], cause: bodyError })
    expect(await readFailureEvidence()).toMatchObject({
      name: 'AggregateError',
      cause: { message: bodyError.message },
      errors: [{ message: bodyError.message }, { message: stopError.message }],
    })
    expect(fixture.stop).toHaveBeenCalledOnce()
    await expect(filesystem.readFile(path.join(fixture.project, 'src/app.json'), 'utf8')).resolves.toContain('pages/bench-hmr-auto-import/index')
    expect(fixture.events).not.toContain('fixture-remove')
    expect(process.exitCode).toBe(1)
  })

  it('does not publish a measured sample or delete its fixture when stop alone fails', async () => {
    const stopError = new Error('process ownership unconfirmed')
    fixture.stop.mockRejectedValue(stopError)
    await runBenchmark()
    expect(fixture.errors).toEqual([stopError])
    expect(await readFailureEvidence()).toMatchObject({ name: 'Error', message: stopError.message })
    await expect(filesystem.readFile(path.join(fixture.project, 'dist/pages/bench-hmr-auto-import/index.wxml'), 'utf8')).resolves.toBe('<view />')
    await expect(filesystem.access(path.join(fixture.root, 'reports/report.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves the sampling failure if fixture removal fails after the dev process stops', async () => {
    const bodyError = new Error('initial output unavailable')
    const cleanupError = new Error('fixture removal denied')
    fixture.waitForOutput.mockRejectedValue(bodyError)
    fixture.removeFailure = cleanupError
    await runBenchmark()
    expect(fixture.errors[0]).toMatchObject({ errors: [bodyError, cleanupError], cause: bodyError })
    expect(await readFailureEvidence()).toMatchObject({
      cause: { message: bodyError.message },
      errors: [{ message: bodyError.message }, { message: cleanupError.message }],
    })
    expect(fixture.events).toEqual(['stop', 'fixture-remove'])
    await expect(filesystem.access(fixture.project)).resolves.toBeUndefined()
  })

  it.each([undefined, 'non-Error sampling failure', 0])('persists non-Error sampling rejections with their cleanup error: %s', async (bodyError) => {
    const stopError = new Error('process cleanup failed')
    fixture.waitForOutput.mockRejectedValue(bodyError)
    fixture.stop.mockRejectedValue(stopError)
    await runBenchmark()
    expect(await readFailureEvidence()).toMatchObject({
      cause: { message: String(bodyError) },
      errors: [{ message: String(bodyError) }, { message: stopError.message }],
    })
    await expect(filesystem.access(fixture.project)).resolves.toBeUndefined()
  })

  it('publishes a sample only after dev stop and fixture removal complete', async () => {
    await runBenchmark()
    expect(fixture.errors).toEqual([])
    expect(fixture.events).toEqual(['stop', 'fixture-remove', 'report', 'report'])
    expect(fixture.stop).toHaveBeenCalledOnce()
    expect(fixture.waitForOutput).toHaveBeenCalledOnce()
    await expect(filesystem.access(fixture.project)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
