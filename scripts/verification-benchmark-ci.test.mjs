import { existsSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../e2e/scripts/domAcceptanceReport/helpers.ts'
import { hash } from './coverageShards/contracts.mjs'
import { ciCriticalPath, ciRunMetrics, collectCiEvidence } from './verificationBenchmark/ci.mjs'
import { fixture, jobs, needs, statuses, time } from './verificationBenchmark/ci/fixture.mjs'
import { compareSamples } from './verificationBenchmark/compare.mjs'
import { runtimeScope } from './verificationBenchmark/evidence.mjs'
import { coverageLogicalScope } from './verificationTelemetry/logicalCoverage.mjs'

it('compares real logical coverage cases while independently verifying each project assignment', async () => {
  const value = fixture()
  const plan = value.files['coverage-plan']['plan.json']
  const shard = value.files['coverage-shard-1']['manifest.json']
  shard.cases = [{ ...plan.inventory[0], name: 'works', state: 'passed' }]
  value.contract.evidence[0].scopeLevel = 'logical-cases'
  value.contract.evidence[0].scope = coverageLogicalScope(plan, [shard])
  const baseline = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(baseline.sample?.complete).toBe(true)
  plan.inventory[0].projectName = 'fast'
  shard.cases[0].projectName = 'fast'
  const { planHash: _oldHash, ...data } = plan
  plan.planHash = hash(JSON.stringify(data))
  shard.planHash = plan.planHash
  value.files['coverage-complete']['shard-verdict.json'].planHash = plan.planHash
  const candidate = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(candidate.sample?.complete).toBe(true)
  expect(candidate.evidence.execution.scopeDigest).toBe(baseline.evidence.execution.scopeDigest)
  shard.cases[0].projectName = 'wrong'
  expect((await collectCiEvidence(value.repository, 123, value.configuration, value.execute)).sample).toBeNull()
})

it('separates approval, queue, execution critical path and total runner time', () => {
  expect(ciRunMetrics({ status: 'completed', conclusion: 'success' }, jobs, statuses, needs)).toMatchObject({
    approvalWaitMs: 7000,
    schedulingWaitMs: 7000,
    executionMs: 11000,
    runnerMs: 18000,
    criticalPath: ['Approve PR checks', 'build', 'tests'],
  })
})

it('requires an exact complete topology instead of guessing dependencies from job names', () => {
  expect(() => ciCriticalPath(jobs, { ...needs, unexpected: [] })).toThrow(/every measured/)
  expect(() => ciCriticalPath(jobs, { ...needs, build: ['absent'] })).toThrow(/missing/)
  expect(() => ciCriticalPath(jobs, { ...needs, build: ['tests'] })).toThrow(/cycle|ordering/)
  expect(() => ciCriticalPath(jobs, { ...needs, build: ['lint'] })).toThrow(/ordering/)
  expect(() => ciCriticalPath([...jobs, jobs[0]], needs)).toThrow(/unique/)
})

it('rejects missing approval evidence, wrong run identity, cancellation and negative intervals', () => {
  const run = { status: 'completed', conclusion: 'success' }
  expect(() => ciRunMetrics(run, jobs, [], needs)).toThrow(/approval timing/)
  expect(() => ciRunMetrics(run, jobs, statuses.map(value => ({ ...value, log_url: 'https://example.test/job/9' })), needs)).toThrow(/approval timing/)
  expect(() => ciRunMetrics({ ...run, conclusion: 'cancelled' }, jobs, statuses, needs)).toThrow(/not successful/)
  expect(() => ciRunMetrics(run, jobs.map(value => value.id === 3 ? { ...value, conclusion: 'failure' } : value), statuses, needs)).toThrow(/successful/)
  expect(() => ciRunMetrics(run, jobs, statuses.map(value => value.state === 'queued' ? { ...value, created_at: time(0) } : value), needs)).toThrow(/reversed/)
})

it('only excludes skipped conditional jobs when the frozen topology explains them', () => {
  const values = [...jobs, { name: 'manual-diagnostic', status: 'completed', conclusion: 'skipped' }]
  expect(() => ciCriticalPath(values, needs)).toThrow(/successful/)
  expect(ciCriticalPath(values, { needs, outOfScope: { 'manual-diagnostic': 'workflow_dispatch only; this is a pull_request run' } }).durationMs).toBe(11000)
  expect(() => ciCriticalPath(jobs, { needs, outOfScope: { build: 'skip' } })).toThrow(/out-of-scope/)
})

it('binds actual frozen identity and verified execution evidence into comparison-compatible samples', async () => {
  const value = fixture()
  const result = await collectCiEvidence(value.repository, '123', value.configuration, value.execute)
  expect(result.sample).toMatchObject({ id: 'baseline-1', variant: 'baseline', complete: true, outcome: 'passed', revision: value.context.checkoutSha })
  expect(result.sample.inputDigest).toMatch(/^[a-f\d]{64}$/u)
  expect(result.sample.scopeDigest).toMatch(/^[a-f\d]{64}$/u)
  expect(result.sample.profile.node).toContain('v24.18.0')
  expect(result.sample.profile.node).toContain('pnpm@11.0.0')
  expect(value.downloads).toHaveLength(4)
  expect(value.downloads.every(directory => !existsSync(path.dirname(directory)))).toBe(true)
  const samples = ['baseline', 'candidate'].flatMap(variant => [1, 2, 3].map(index => ({ ...result.sample, id: `${variant}-${index}`, variant })))
  expect(compareSamples(samples).cohorts.candidate.samples).toHaveLength(3)
})

it.each([
  ['missing identity', value => delete value.configuration.identity],
  ['unknown identity field', value => value.configuration.identity.ignoredBase = 'wrong'],
  ['wrong repository', value => value.run.repository.full_name = 'another/repo'],
  ['wrong workflow', value => value.run.path = '.github/workflows/other.yml'],
  ['wrong attempt', value => value.run.run_attempt++],
  ['missing native PR metadata', value => value.run.pull_requests = []],
  ['context attempt', value => value.context.runAttempt++],
  ['context base', value => value.context.baseSha = 'f'.repeat(40)],
  ['context merge', value => value.context.checkoutSha = 'f'.repeat(40)],
  ['actual merge parents', value => value.commit.parents[0].sha = 'f'.repeat(40)],
])('rejects %s and removes downloaded temporary context on failure', async (_, mutate) => {
  const value = fixture()
  mutate(value)
  await expect(collectCiEvidence(value.repository, '123', value.configuration, value.execute)).rejects.toThrow(/identity|context|merge/iu)
  expect(value.downloads.every(directory => !existsSync(path.dirname(directory)))).toBe(true)
})

it.each([
  ['missing', value => value.artifacts.shift()],
  ['duplicated', value => value.artifacts.push({ ...value.artifacts[0], id: 99 })],
  ['expired', value => value.artifacts[0].expired = true],
  ['wrong run', value => value.artifacts[0].workflow_run.id++],
  ['stale attempt', value => value.artifacts[0].created_at = time(-1)],
])('rejects a %s context artifact before trusting its contents', async (_, mutate) => {
  const value = fixture()
  mutate(value)
  await expect(collectCiEvidence(value.repository, '123', value.configuration, value.execute)).rejects.toThrow(/artifact/iu)
})

it.each([
  ['absent contract', value => delete value.configuration.contract],
  ['contract without execution evidence', value => delete value.contract.evidence],
  ['missing execution artifact', value => value.artifacts.pop()],
  ['partial execution', value => value.files['coverage-shard-1']['manifest.json'].inventory = []],
  ['scope mismatch', value => value.contract.evidence[0].scope = []],
  ['failed original thresholds', value => value.files['coverage-complete']['shard-verdict.json'].status = 'failed'],
  ['blob tampering', value => value.files['coverage-shard-1']['blob.json'] = 'other'],
  ['wrong actual Node patch', value => value.files['coverage-plan']['plan.json'].identity.nodeVersion = 'v24.18.1'],
  ['changed topology', value => value.contract.needs = {}],
])('retains only raw timing for %s instead of producing a complete sample', async (_, mutate) => {
  const value = fixture()
  mutate(value)
  const result = await collectCiEvidence(value.repository, '123', value.configuration, value.execute)
  expect(result).toMatchObject({ sample: null, metrics: { executionMs: 11000 } })
  expect(result.incompleteReason).toBeTruthy()
  expect(value.downloads.every(directory => !existsSync(path.dirname(directory)))).toBe(true)
})

it('rejects externally supplied digest claims inside an immutable contract', async () => {
  const value = fixture()
  value.contract.inputDigest = 'a'.repeat(64)
  await expect(collectCiEvidence(value.repository, '123', value.configuration, value.execute)).rejects.toThrow(/contract/iu)
})

it('requires real complete runtime checkpoints and matching toolchain artifacts alongside coverage', async () => {
  const value = fixture()
  const cases = [evaluateAcceptanceCase({
    id: 'mounted',
    file: 'e2e/ide/example.test.ts',
    name: 'mounts',
    state: 'passed',
    startedAt: Date.parse(time(1)),
    finishedAt: Date.parse(time(3)),
    acceptance: {
      fixture: 'e2e-apps/base',
      provider: 'headless',
      checkpoints: [{ id: 'mounted', route: '/pages/index/index', action: 'launch', nodes: [{ selector: '.title', text: 'Ready' }] }],
      evidence: [{ id: 'mounted', route: 'pages/index/index', source: 'headless-logical-tree', capturedAt: time(2), nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
    },
  })]
  const acceptance = {
    schemaVersion: 1,
    runId: 'suite',
    invocationId: 'invocation',
    commitSha: value.context.checkoutSha,
    taskLabel: 'runtime',
    template: null,
    provider: 'headless',
    strict: true,
    environment: { nodeVersion: 'v24.18.0', ideVersion: null, baseLibraryVersion: null },
    startedAt: time(1),
    finishedAt: time(3),
    status: 'passed',
    errors: [],
    cases,
    summary: summarizeAcceptanceCases(cases),
  }
  const report = {
    runId: 'suite',
    commitSha: value.context.checkoutSha,
    workingTreeDirty: false,
    strict: true,
    coverage: 'complete',
    acceptance: 'passed',
    execution: { scope: 'full', status: 'passed', profile: { provider: 'headless', os: 'linux', arch: 'x64', nodeMajor: 24 }, assignedTasks: ['runtime'] },
    tasks: [{ label: 'runtime', status: 'passed', exitCode: 0, durationMs: 2000, artifacts: [{ kind: 'dom-acceptance-report' }] }],
  }
  value.files.runtime = {
    'suite.json': report,
    'acceptance.json': acceptance,
    'toolchain.json': { schemaVersion: 2, commit: value.context.checkoutSha, os: 'Linux', arch: 'x64', toolchain: { nodeVersion: 'v24.18.0', actualPackageManager: 'pnpm@11.0.0' } },
  }
  value.artifacts.push({ ...value.artifacts[0], id: 99, name: 'runtime' })
  value.contract.evidence.push({
    id: 'runtime',
    kind: 'runtime',
    scope: runtimeScope(report, [acceptance]),
    suite: { artifact: 'runtime', file: 'suite.json' },
    acceptance: [{ artifact: 'runtime', file: 'acceptance.json' }],
    toolchain: { artifact: 'runtime', file: 'toolchain.json' },
  })
  expect((await collectCiEvidence(value.repository, '123', value.configuration, value.execute)).sample?.complete).toBe(true)
  value.files.runtime['toolchain.json'].arch = 'arm64'
  const mismatched = await collectCiEvidence(value.repository, '123', value.configuration, value.execute)
  expect(mismatched.sample).toBeNull()
  expect(mismatched.incompleteReason).toMatch(/resource\/toolchain/iu)
  value.files.runtime['toolchain.json'].arch = 'x64'
  acceptance.cases[0].acceptance.evidence = []
  const partial = await collectCiEvidence(value.repository, '123', value.configuration, value.execute)
  expect(partial.sample).toBeNull()
  expect(partial.incompleteReason).toMatch(/incomplete/iu)
  expect(value.downloads.every(directory => !existsSync(path.dirname(directory)))).toBe(true)
})
