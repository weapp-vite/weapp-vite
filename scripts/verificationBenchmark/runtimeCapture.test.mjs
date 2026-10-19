import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../../e2e/scripts/domAcceptanceReport/helpers.ts'
import { getSuiteTasks } from '../../e2e/scripts/e2e-suite-manifest.ts'
import { createBuildArtifactManifest } from '../buildArtifact/index.mjs'
import { main } from './cli.mjs'
import { captureRuntimeSample } from './runtimeCapture.mjs'

const mocks = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.run }))
const roots = []
afterEach(async () => {
  mocks.run.mockReset()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(change = async () => {}, suiteName = 'ide-full', outOfScopeTasks = []) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'runtime-capture-')))
  roots.push(root)
  await mkdir(path.join(root, '.tmp'))
  await mkdir(path.join(root, 'packages/library/dist'), { recursive: true })
  await mkdir(path.join(root, 'packages/library/src'), { recursive: true })
  await mkdir(path.join(root, 'e2e/scripts/domAcceptanceReport'), { recursive: true })
  await writeFile(path.join(root, 'e2e/scripts/e2e-suite-manifest.ts'), `export async function getSuiteTasks() { return ${JSON.stringify([{ label: 'task' }, ...outOfScopeTasks])} }\n`)
  await writeFile(path.join(root, 'e2e/scripts/domAcceptanceReport/taskCases.ts'), 'export async function readPlannedTaskCases(task) { return [{ file: "e2e/" + task.label, name: "renders" }] }\n')
  await writeFile(path.join(root, '.gitignore'), '.tmp/\ndist/\n')
  await writeFile(path.join(root, 'input.js'), 'export const input = 1\n')
  await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages: [packages/*]\n')
  await writeFile(path.join(root, 'turbo.json'), '{"tasks":{"build":{"dependsOn":["^build"]}}}\n')
  await writeFile(path.join(root, 'vitest.coverage.ts'), 'export const thresholds = { lines: 100 }\n')
  await writeFile(path.join(root, 'packages/library/src/index.js'), 'export const input = 1\n')
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', packageManager: 'pnpm@12.11.2', scripts: { 'e2e:ide:full': 'node --import tsx ./e2e/scripts/run-sleep-inhibited-e2e-suite.ts ide-full', 'e2e:ide:full:exhaustive': 'node --import tsx ./e2e/scripts/run-sleep-inhibited-e2e-suite.ts "ide-full:exhaustive"' } }))
  await writeFile(path.join(root, 'packages/library/dist/index.mjs'), 'prepared')
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' }).trim()
  git(['init', '--initial-branch=main'])
  git(['add', '.'])
  git(['-c', 'user.name=Verification Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'test fixture'])
  const commit = git(['rev-parse', 'HEAD'])
  const toolchain = createBuildArtifactManifest(root, { BUILD_ARTIFACT_EXPECTED_COMMIT: commit, BUILD_ARTIFACT_PACKAGE_MANAGER: 'pnpm@12.11.2' })
  await writeFile(path.join(root, '.tmp/toolchain.json'), JSON.stringify(toolchain))
  const config = { schemaVersion: 1, id: 'baseline-1', variant: 'baseline', suite: suiteName, cachePolicy: 'warm', toolchain: '.tmp/toolchain.json', inputPolicy: 'framework-tree-v2' }
  mocks.run.mockImplementation(async (command, args, options) => {
    expect(command).toBe('pnpm')
    if (args[0] === '--version') {
      return { stdout: '12.11.2' }
    }
    expect(args).toEqual(['run', suiteName === 'ide-full' ? 'e2e:ide:full' : 'e2e:ide:full:exhaustive'])
    expect(options).toMatchObject({ cwd: root, reject: false, stdout: ['pipe', 'inherit'], env: { WEAPP_VITE_E2E_REPORT_MARKERS: '1' } })
    expect(options.env.WEAPP_VITE_E2E_ACCEPTANCE_DIRTY).toBeUndefined()
    const runId = options.env.WEAPP_VITE_E2E_ACCEPTANCE_RUN_ID
    const time = Date.now()
    const cases = [evaluateAcceptanceCase({
      id: 'case',
      file: 'e2e/task',
      name: 'renders',
      state: 'passed',
      startedAt: time,
      finishedAt: time,
      acceptance: {
        fixture: 'e2e-apps/base',
        provider: 'devtools',
        runtime: { ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.4' },
        checkpoints: [{ id: 'mount', route: '/pages/index/index', action: 'launch', nodes: [{ selector: '.title', text: 'Ready' }] }],
        evidence: [{ id: 'mount', route: 'pages/index/index', source: 'devtools-page-frame', capturedAt: new Date(time).toISOString(), nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
      },
    })]
    const acceptancePath = `docs/reports/dom-acceptance/${runId}/invocation.json`
    const acceptance = {
      schemaVersion: 1,
      runId,
      invocationId: runId,
      commitSha: commit,
      taskLabel: 'task',
      template: null,
      provider: 'devtools',
      strict: true,
      environment: { nodeVersion: process.version, ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.4' },
      startedAt: new Date(time).toISOString(),
      finishedAt: new Date(time).toISOString(),
      status: 'passed',
      errors: [],
      cases,
      summary: summarizeAcceptanceCases(cases),
    }
    const reportPath = `docs/reports/2026-10-19-000000-${runId}-suite-report/index.json`
    const suite = {
      schemaVersion: 2,
      toolVersion: 1,
      runId,
      commitSha: commit,
      workingTreeDirty: false,
      strict: true,
      coverage: 'complete',
      acceptance: 'passed',
      excludedProjects: [],
      suiteName: `e2e:${suiteName}`,
      generatedAt: new Date(time).toISOString(),
      execution: { scope: 'full', status: 'passed', profile: { os: process.platform, arch: process.arch, nodeMajor: Number(process.versions.node.split('.')[0]), provider: 'devtools', platform: 'weapp', runnerClass: 'local' }, assignedTasks: ['task'], startedAt: new Date(time).toISOString(), finishedAt: new Date(time).toISOString() },
      tasks: [{ label: 'task', durationMs: 10, exitCode: 0, status: 'passed', artifacts: [{ kind: 'dom-acceptance-report', indexPath: acceptancePath }] }, ...outOfScopeTasks.map(task => ({ label: task.label, status: 'out-of-scope', reason: task.outOfScopeReason, durationMs: 0, exitCode: 0, artifacts: [] }))],
      summary: { taskCount: 1 + outOfScopeTasks.length, plannedCount: 1, executedCount: 1, passedCount: 1, failedCount: 0, blockedCount: 0, skippedCount: 0, notExecutedCount: 0, outOfScopeCount: outOfScopeTasks.length, artifactCount: 1 },
    }
    const execution = { suite, acceptance, acceptancePath, reportPath, exitCode: 0, emit: true }
    await change(execution, root)
    if (execution.emit) {
      for (const [file, value] of [[execution.reportPath, suite], [acceptancePath, acceptance]]) {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true })
        await writeFile(path.join(root, file), JSON.stringify(value))
      }
    }
    return { exitCode: execution.exitCode, stdout: execution.emit ? `[e2e-suite-report] index=${execution.reportPath.replace(/\.json$/u, '.md')}\n` : '' }
  })
  return { root, config, toolchain, output: path.join(root, '.tmp/sample.json') }
}

it('captures the formal suite with fresh complete DOM evidence and actual toolchain, IDE and SDK identity', async () => {
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_DIRTY', '0')
  const { root, config, output } = await fixture()
  const sample = await captureRuntimeSample(config, output, root)
  expect(sample).toMatchObject({ outcome: 'passed', complete: true, profile: { os: process.platform, arch: process.arch, node: process.version, packageManager: 'pnpm@12.11.2', ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.4', provider: 'devtools' } })
  expect(sample.evidence.acceptance).toHaveLength(1)
  const inputs = JSON.parse(await readFile(path.join(root, sample.evidence.inputs.report), 'utf8'))
  expect(inputs).toMatchObject({ inputDigest: sample.inputDigest, receipt: { policy: { version: 'framework-tree-v2' } } })
  expect(inputs.receipt.inventory.map(entry => entry[0])).toEqual(expect.arrayContaining(['packages/library/src/index.js', 'turbo.json', 'pnpm-workspace.yaml', 'vitest.coverage.ts']))
  expect(sample.metrics.executionMs).toBeGreaterThan(0)
  expect(JSON.parse(await readFile(output, 'utf8'))).toMatchObject({ id: 'baseline-1', outcome: 'passed' })
})

it.runIf(process.platform === 'win32')('accepts Windows evidence filename casing resolved by the filesystem', async () => {
  const { root, config, output } = await fixture()
  config.toolchain = '.tmp/TOOLCHAIN.json'
  expect(await captureRuntimeSample(config, output, root)).toMatchObject({ outcome: 'passed', complete: true })
})

it('captures exhaustive evidence with the three non-applicable Baidu tasks defined by the actual formal manifest', async () => {
  const nonApplicable = (await getSuiteTasks('ide-full:exhaustive')).filter(task => task.outOfScopeReason)
  expect(nonApplicable.map(task => task.label).sort()).toEqual(['ide/swan-runtime.optional.test.ts', 'ide/template-multi-platform-sfc.swan.optional.test.ts', 'ide/template-multi-platform.swan.optional.test.ts'])
  const { root, config, output } = await fixture(undefined, 'ide-full:exhaustive', nonApplicable)
  expect(await captureRuntimeSample(config, output, root)).toMatchObject({ outcome: 'passed', complete: true })
})

it('rejects a passing DOM report that substitutes another case for the frozen formal case', async () => {
  const { root, config, output } = await fixture(({ acceptance }) => {
    acceptance.cases[0].name = 'substitute'
  })
  expect(await captureRuntimeSample(config, output, root)).toMatchObject({ outcome: 'partial', complete: false, evidence: { error: expect.stringContaining('DOM case inventory mismatch') } })
})

it.each(['partial', 'ad-hoc', 'dirty', 'wrong-sha', 'stale', 'wrong-ide', 'wrong-node'])(
  'retains %s runtime evidence as incomplete without claiming a successful full sample',
  async (fault) => {
    const { root, config, output } = await fixture(({ suite, acceptance }) => {
      if (fault === 'partial') {
        suite.coverage = 'partial'
      }
      if (fault === 'ad-hoc') {
        suite.execution.scope = 'ad-hoc'
      }
      if (fault === 'dirty') {
        suite.workingTreeDirty = true
      }
      if (fault === 'wrong-sha') {
        acceptance.commitSha = 'f'.repeat(40)
      }
      if (fault === 'stale') {
        acceptance.startedAt = '2000-01-01T00:00:00.000Z'
      }
      if (fault === 'wrong-ide') {
        acceptance.environment.ideVersion = 'other-version'
      }
      if (fault === 'wrong-node') {
        acceptance.environment.nodeVersion = 'v0.0.0'
      }
    })
    expect(await captureRuntimeSample(config, output, root)).toMatchObject({ outcome: 'partial', complete: false, evidence: { suite: { report: expect.any(String) }, error: expect.any(String) } })
  },
)

it('does not reuse prior successful suite evidence when the next invocation emits none', async () => {
  let calls = 0
  const { root, config, output } = await fixture((execution) => {
    calls++
    execution.emit = calls === 1
  })
  expect((await captureRuntimeSample(config, output, root)).complete).toBe(true)
  expect(await captureRuntimeSample({ ...config, id: 'baseline-2' }, output, root)).toMatchObject({ complete: false, outcome: 'partial' })
})

it.each([[7, 'failed'], [130, 'cancelled'], [143, 'cancelled']])('does not accept passing reports when the actual suite process exits %s', async (exitCode, outcome) => {
  const { root, config, output } = await fixture((execution) => {
    execution.exitCode = exitCode
  })
  expect(await captureRuntimeSample(config, output, root)).toMatchObject({ outcome, complete: false, evidence: { exitCode } })
})

it('requires every generated DOM report and binds each reference to its own task', async () => {
  const { root, config, output } = await fixture(async (execution, directory) => {
    const extra = path.join(directory, path.dirname(execution.acceptancePath), 'extra.json')
    await mkdir(path.dirname(extra), { recursive: true })
    await writeFile(extra, JSON.stringify(execution.acceptance))
  })
  expect(await captureRuntimeSample(config, output, root)).toMatchObject({ outcome: 'partial', complete: false, evidence: { error: expect.stringContaining('all fresh DOM evidence') } })
})

it('rejects missing DOM documents and references belonging to another task', async () => {
  let calls = 0
  const { root, config, output } = await fixture((execution) => {
    calls++
    if (calls === 1) {
      execution.suite.tasks[0].artifacts[0].indexPath = execution.acceptancePath.replace('invocation.json', 'missing.json')
    }
    else {
      execution.acceptance.taskLabel = 'another-task'
    }
  })
  expect(await captureRuntimeSample(config, output, root)).toMatchObject({ outcome: 'partial', complete: false })
  expect(await captureRuntimeSample(config, output, root)).toMatchObject({ outcome: 'partial', complete: false, evidence: { error: expect.stringContaining('another task') } })
})

it.each(['source', 'input', 'artifact', 'new-chunk', 'toolchain', 'input-receipt'])(
  'rejects changed %s during the measured command',
  async (fault) => {
    const { root, config, output } = await fixture(async (_execution, directory) => {
      const files = { 'source': 'input.js', 'input': 'packages/library/src/index.js', 'artifact': 'packages/library/dist/index.mjs', 'new-chunk': 'packages/library/dist/extra.mjs', 'toolchain': '.tmp/toolchain.json', 'input-receipt': '.tmp/sample.json.inputs.json' }
      await writeFile(path.join(directory, files[fault]), 'changed')
    })
    await expect(captureRuntimeSample(config, output, root)).rejects.toThrow(/changed during|clean known|Unexpected token/)
    await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' })
  },
)

it.each([
  { inputPolicy: undefined },
  { inputPolicy: 'handwritten' },
  { inputPolicy: { version: 'framework-tree-v2', roots: ['packages/library/'] } },
  { inputFiles: ['packages/library/src/index.js'] },
])('rejects a partial or manual framework input contract before launching', async (override) => {
  const { root, config, output } = await fixture()
  await expect(captureRuntimeSample({ ...config, ...override }, output, root)).rejects.toThrow(/configuration/)
  expect(mocks.run).not.toHaveBeenCalled()
})

it.each(['TASK_FILTER', 'EXCLUDE_PROJECTS', 'ACCEPTANCE_CASES'])('rejects inherited %s and arbitrary command overrides before launching a suite', async (key) => {
  const { root, config, output } = await fixture()
  vi.stubEnv(`WEAPP_VITE_E2E_${key}`, 'tdesign')
  await expect(captureRuntimeSample(config, output, root)).rejects.toThrow(/filters/)
  vi.unstubAllEnvs()
  await expect(captureRuntimeSample({ ...config, command: 'node', args: ['-e', 'void 0'] }, output, root)).rejects.toThrow(/configuration/)
  expect(mocks.run).not.toHaveBeenCalled()
})

it('rejects a dirty checkout despite an inherited clean override and rejects mismatched actual pnpm', async () => {
  const { root, config, output, toolchain } = await fixture()
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_DIRTY', '0')
  await writeFile(path.join(root, 'input.js'), 'dirty')
  await expect(captureRuntimeSample(config, output, root)).rejects.toThrow(/clean known/)
  await writeFile(path.join(root, 'input.js'), 'export const input = 1\n')
  toolchain.toolchain.actualPackageManager = 'pnpm@1.0.0'
  await writeFile(path.join(root, config.toolchain), JSON.stringify(toolchain))
  await expect(captureRuntimeSample(config, output, root)).rejects.toThrow(/toolchain mismatch/)
})

it('routes runtime --config --output through the CLI and returns nonzero for incomplete evidence', async () => {
  const { root, config, output } = await fixture((execution) => {
    execution.emit = false
  })
  const configPath = path.join(root, '.tmp/config.json')
  await writeFile(configPath, JSON.stringify(config))
  const previous = process.cwd()
  process.chdir(root)
  try {
    expect(await main(['runtime', '--config', configPath, '--output', output])).toBe(1)
    await expect(main(['runtime', '--config', configPath])).rejects.toThrow(/runtime requires/)
  }
  finally {
    process.chdir(previous)
  }
})
