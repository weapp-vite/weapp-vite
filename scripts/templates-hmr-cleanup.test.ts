import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  stop: vi.fn(),
  inspector: vi.fn(),
  measure: vi.fn(),
  root: '',
  projects: [] as string[],
  events: [] as string[],
  removeFailure: undefined as Error | undefined,
  logFailure: undefined as Error | undefined,
  evidenceFailure: undefined as Error | undefined,
}))

vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return {
    ...actual,
    rm: vi.fn(async (...args: Parameters<typeof actual.rm>) => {
      if (fixture.projects.includes(String(args[0]))) {
        fixture.events.push('fixture-remove')
        if (fixture.removeFailure) {
          throw fixture.removeFailure
        }
      }
      return actual.rm(...args)
    }),
    writeFile: vi.fn(async (...args: Parameters<typeof actual.writeFile>) => {
      const filename = path.basename(String(args[0]))
      if (path.basename(path.dirname(String(args[0]))) === 'cleanup' && fixture.evidenceFailure) {
        throw fixture.evidenceFailure
      }
      if (filename.endsWith('.dev.log')) {
        fixture.events.push('dev-log')
        if (fixture.logFailure) {
          throw fixture.logFailure
        }
      }
      if (String(args[0]) === path.join(fixture.root, 'reports/report.json')) {
        fixture.events.push('report')
      }
      return actual.writeFile(...args)
    }),
  }
})
vi.mock('execa', () => ({ execa: vi.fn(async () => ({})) }))
vi.mock('../e2e/utils/dev-process', () => ({
  startDevProcess: (_command: string, args: string[], options: { cwd: string }) => {
    const project = path.resolve(options.cwd, args[2]!)
    fixture.projects.push(project)
    fixture.events.push('start')
    return {
      waitForInitialBuild: async () => {
        const filesystem = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
        await filesystem.mkdir(path.join(project, 'dist/pages/index'), { recursive: true })
        await filesystem.writeFile(path.join(project, 'dist/app.json'), '{"pages":["pages/index/index"]}')
        await filesystem.writeFile(path.join(project, 'dist/pages/index/index.wxss'), 'page { color: red; }')
      },
      waitFor: async (task: Promise<unknown>) => task,
      getOutput: () => 'dev cleanup evidence',
      stop: fixture.stop,
    }
  },
}))
vi.mock('../e2e/utils/dev-memory', () => ({
  waitForInspectorUrl: fixture.inspector,
  sampleHeapAfterGc: async () => undefined,
}))
vi.mock('../e2e/utils/hmr-helpers', () => ({
  replaceFileByRename: async (filename: string, source: string) => {
    const filesystem = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    await filesystem.writeFile(filename, source)
    await filesystem.writeFile(path.join(path.dirname(path.dirname(path.dirname(path.dirname(filename)))), 'dist/pages/index/index.wxss'), source)
  },
}))
vi.mock('./benchmarkTemplatesHmr/initialOutput', () => ({ waitForBenchmarkInitialOutputs: async () => {} }))
vi.mock('./benchmarkTemplatesHmr/emittedOutput', () => ({
  createEmittedScriptReader: vi.fn(),
  waitForBenchmarkOutput: async () => {},
}))
vi.mock('./workspace-hmr/statefulArtifactMeasurement', () => ({
  measureStatefulTemplateArtifact: fixture.measure,
}))
vi.mock('./workspace-hmr/statefulAuditClient', () => ({ StatefulHmrAuditClient: class {} }))

const filesystem = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
const originalExitCode = process.exitCode

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  fixture.root = await filesystem.mkdtemp(path.join(os.tmpdir(), 'templates-hmr-cleanup-'))
  fixture.projects = []
  fixture.events = []
  fixture.removeFailure = undefined
  fixture.logFailure = undefined
  fixture.evidenceFailure = undefined
  fixture.stop.mockImplementation(async () => {
    fixture.events.push('stop')
  })
  fixture.inspector.mockResolvedValue('unused-inspector')
  fixture.measure.mockImplementation(async ({ measure }: { measure: (signal: AbortSignal) => Promise<number> }) => {
    await measure(new AbortController().signal)
    return 1
  })
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  for (const name of ['template-a', 'template-b']) {
    const project = path.join(fixture.root, 'templates', name)
    await filesystem.mkdir(path.join(project, 'src/pages/index'), { recursive: true })
    await filesystem.writeFile(path.join(project, 'package.json'), '{"name":"cleanup-fixture"}')
    await filesystem.writeFile(path.join(project, 'weapp-vite.config.ts'), 'export default {}')
    await filesystem.writeFile(path.join(project, 'src/pages/index/index.wxss'), 'page { color: red; }')
    await filesystem.writeFile(path.join(project, 'hmr-benchmark.json'), JSON.stringify([
      { id: 'style', source: 'pages/index/index.wxss', output: 'pages/index/index.wxss', mutation: 'style' },
    ]))
  }
  vi.stubEnv('TEMPLATES_HMR_REPO_ROOT', fixture.root)
  vi.stubEnv('TEMPLATES_HMR_WORKSPACE_ROOT', path.join(fixture.root, 'workspaces'))
  vi.stubEnv('TEMPLATES_HMR_REPORT_DIR', path.join(fixture.root, 'reports'))
  vi.stubEnv('TEMPLATES_HMR_PROJECT_ROOT', '')
  vi.stubEnv('TEMPLATES_HMR_FILTER', 'template-a')
  vi.stubEnv('TEMPLATES_HMR_SCENARIO_FILTER', '')
  vi.stubEnv('TEMPLATES_HMR_PLAN_ONLY', '0')
  vi.stubEnv('TEMPLATES_HMR_KEEP_WORKSPACE', '0')
  vi.stubEnv('TEMPLATES_HMR_FAIL_ON_ERROR', '1')
  vi.stubEnv('TEMPLATES_HMR_STOP_ON_ERROR', '0')
  vi.stubEnv('TEMPLATES_HMR_PROFILE', '0')
  vi.stubEnv('TEMPLATES_HMR_OUTPUT_SCOPE', '0')
  vi.stubEnv('TEMPLATES_HMR_RUNTIME', 'classic')
  vi.stubEnv('TEMPLATES_HMR_CPU_PROFILE_DIR', '')
  vi.stubEnv('TEMPLATES_HMR_ITERATIONS', '1')
  vi.stubEnv('TEMPLATES_HMR_MARKER_SEED', 'cleanup-test')
  vi.stubEnv('TEMPLATES_HMR_SETTLE_MS', '1')
})

afterEach(async () => {
  process.exitCode = originalExitCode
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  await filesystem.rm(fixture.root, { recursive: true, force: true })
})

async function runBenchmark() {
  const { main } = await import('./benchmark-templates-hmr')
  await main()
}

async function readReport() {
  return JSON.parse(await filesystem.readFile(path.join(fixture.root, 'reports/report.json'), 'utf8')) as {
    summary: { failedTemplateCount: number, failedScenarioCount: number, measuredScenarioCount: number }
    templates: Array<{ error?: string }>
  }
}

async function expectPreservedFixture() {
  await expect(filesystem.readFile(path.join(fixture.projects[0]!, 'src/pages/index/index.wxss'), 'utf8')).resolves.toBe('page { color: red; }')
  await expect(filesystem.access(path.join(fixture.root, 'reports/report.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(fixture.events).not.toContain('fixture-remove')
}

describe('template HMR benchmark cleanup', () => {
  it('rejects stop failure before reporting success or starting another template', async () => {
    vi.stubEnv('TEMPLATES_HMR_FILTER', '')
    const stopError = new Error('process ownership unconfirmed')
    fixture.stop.mockRejectedValue(stopError)
    const error = await runBenchmark().then(() => undefined, error => error)
    expect(fixture.projects).toHaveLength(1)
    expect(error).toBe(stopError)
    expect(fixture.stop).toHaveBeenCalledOnce()
    await expectPreservedFixture()
    await expect(filesystem.readFile(path.join(fixture.root, 'reports/logs/template-a.dev.log'), 'utf8')).resolves.toBe('dev cleanup evidence')
  })

  it('preserves the initial body error together with the stop error', async () => {
    const bodyError = new Error('initial inspector unavailable')
    const stopError = new Error('process inspection timed out')
    fixture.inspector.mockRejectedValue(bodyError)
    fixture.stop.mockRejectedValue(stopError)
    await expect(runBenchmark()).rejects.toMatchObject({ errors: [bodyError, stopError], cause: bodyError })
    await expectPreservedFixture()
  })

  it.each([undefined, 'non-Error body failure', 0])('preserves non-Error body rejection with the stop error: %s', async (bodyError) => {
    const stopError = new Error('process cleanup failed')
    fixture.inspector.mockRejectedValue(bodyError)
    fixture.stop.mockRejectedValue(stopError)
    await expect(runBenchmark()).rejects.toMatchObject({ errors: [bodyError, stopError], cause: bodyError })
    await expectPreservedFixture()
  })

  it('preserves the body error if removal fails after dev stop succeeds', async () => {
    const bodyError = new Error('initial inspector unavailable')
    const removeError = new Error('fixture removal denied')
    fixture.inspector.mockRejectedValue(bodyError)
    fixture.removeFailure = removeError
    await expect(runBenchmark()).rejects.toMatchObject({ errors: [bodyError, removeError], cause: bodyError })
    expect(fixture.events).toEqual(['start', 'stop', 'dev-log', 'fixture-remove'])
    await expect(filesystem.access(fixture.projects[0]!)).resolves.toBeUndefined()
    await expect(filesystem.access(path.join(fixture.root, 'reports/report.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects removal failure without publishing a successful sample', async () => {
    const removeError = new Error('fixture removal denied')
    fixture.removeFailure = removeError
    await expect(runBenchmark()).rejects.toBe(removeError)
    expect(fixture.events).toEqual(['start', 'stop', 'dev-log', 'fixture-remove'])
    await expect(filesystem.access(fixture.projects[0]!)).resolves.toBeUndefined()
    await expect(filesystem.access(path.join(fixture.root, 'reports/report.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('retains stop and log errors without deleting the live fixture', async () => {
    const stopError = new Error('process cleanup failed')
    const logError = new Error('dev log write denied')
    fixture.stop.mockRejectedValue(stopError)
    fixture.logFailure = logError
    await expect(runBenchmark()).rejects.toMatchObject({ errors: [stopError, logError], cause: stopError })
    await expectPreservedFixture()
  })

  it('cleans the stopped fixture even when writing its dev log fails', async () => {
    const logError = new Error('dev log write denied')
    fixture.logFailure = logError
    await expect(runBenchmark()).rejects.toBe(logError)
    expect(fixture.events).toEqual(['start', 'stop', 'dev-log', 'fixture-remove'])
    await expect(filesystem.access(fixture.projects[0]!)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(filesystem.access(path.join(fixture.root, 'reports/report.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps the existing failed-result policy when only the body fails', async () => {
    const bodyError = new Error('initial inspector unavailable')
    fixture.inspector.mockRejectedValue(bodyError)
    await runBenchmark()
    const report = await readReport()
    expect(report.summary.failedTemplateCount).toBe(1)
    expect(report.templates[0]?.error).toBe(bodyError.message)
    expect(process.exitCode).toBe(1)
    expect(fixture.events).toEqual(['start', 'stop', 'dev-log', 'fixture-remove', 'report', 'report'])
    await expect(filesystem.access(fixture.projects[0]!)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps per-scenario sampling failures in the existing failed report', async () => {
    fixture.measure.mockRejectedValue(new Error('output observation failed'))
    await runBenchmark()
    expect(await readReport()).toMatchObject({ summary: { failedTemplateCount: 0, failedScenarioCount: 1, measuredScenarioCount: 0 } })
    expect(process.exitCode).toBe(1)
    expect(fixture.events).toEqual(['start', 'stop', 'dev-log', 'fixture-remove', 'report', 'report'])
    await expect(filesystem.access(fixture.projects[0]!)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('saves failed scenario diagnostics and stop error as independent cleanup evidence', async () => {
    await filesystem.writeFile(path.join(fixture.root, 'templates/template-a/hmr-benchmark.json'), JSON.stringify([
      { id: 'cleanup', source: 'pages/index/index.wxss', output: 'pages/index/index.wxss', mutation: 'style' },
    ]))
    const stopError = new Error(`stop failed at ${fixture.root}/workspaces token=private-value`)
    fixture.measure.mockRejectedValue(new Error(`output failed at ${fixture.root}/src/style.wxss`))
    fixture.stop.mockRejectedValue(stopError)
    await expect(runBenchmark()).rejects.toBe(stopError)
    const text = await filesystem.readFile(path.join(fixture.root, 'reports/failures/template-a/cleanup/report.json'), 'utf8')
    expect(text).not.toContain(fixture.root)
    expect(text).not.toContain('private-value')
    expect(JSON.parse(text) as unknown).toMatchObject({
      error: { message: expect.stringContaining('stop failed at') },
      template: { id: 'template-a', scenarios: [{
        id: 'cleanup',
        error: expect.stringContaining('output failed at'),
        diagnostics: { phase: 'edit', artifact: 'failures/template-a/cleanup.json', source: { bytes: expect.any(Number) } },
      }] },
    })
    const scenarioArtifact = await filesystem.readFile(path.join(fixture.root, 'reports/failures/template-a/cleanup.json'), 'utf8')
    expect(JSON.parse(scenarioArtifact) as unknown).toMatchObject({ contents: { source: 'page { color: red; }' } })
    await expectPreservedFixture()
  })

  it('aggregates cleanup evidence write failure without replacing the original stop error', async () => {
    const stopError = new Error('dev cleanup failed')
    const evidenceError = new Error('cleanup evidence write denied')
    fixture.measure.mockRejectedValue(new Error('output observation failed'))
    fixture.stop.mockRejectedValue(stopError)
    fixture.evidenceFailure = evidenceError
    await expect(runBenchmark()).rejects.toMatchObject({ errors: [stopError, evidenceError], cause: stopError })
    await expectPreservedFixture()
  })

  it('reports measured samples only after dev stop and fixture removal', async () => {
    await runBenchmark()
    expect(await readReport()).toMatchObject({ summary: { failedTemplateCount: 0, failedScenarioCount: 0, measuredScenarioCount: 1 } })
    expect(fixture.events).toEqual(['start', 'stop', 'dev-log', 'fixture-remove', 'report', 'report'])
    expect(fixture.stop).toHaveBeenCalledOnce()
    await expect(filesystem.access(fixture.projects[0]!)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
