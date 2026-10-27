import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { GITHUB_ISSUES_BUILD_BASELINE_LABEL, GITHUB_ISSUES_BUILD_TASK_LABELS } from '../../../e2e/ci/githubIssuesBuild/groups.ts'
import { aggregateVerificationReports } from '../../../e2e/scripts/verification/aggregate.ts'
import { TOPOLOGY_V2_COMPARISON_PROTOCOL } from '../../verification/topology.ts'
import { useIsolatedTopologyTestEnvironment } from '../../verification/topologyTestFixture.ts'
import { freeze, profile, shardReports } from '../../verificationE2E/fixtures.ts'
import { collectCiEvidence } from '../ci.mjs'
import { fixture } from './fixture.mjs'
import { withCiRun } from './github.mjs'
import { discoverTaskSuites } from './prepareTaskSuites.mjs'
import { readTaskSuite, taskSuiteScope } from './taskSuite.mjs'

useIsolatedTopologyTestEnvironment()

async function taskFixture(options = {}) {
  const value = fixture()
  const plan = await freeze({ ...options, identity: { runId: 'suite', commitSha: value.context.checkoutSha, workingTreeDirty: false } })
  const reports = shardReports(plan)
  const aggregate = await aggregateVerificationReports(plan, reports)
  value.files['miniapp-plan-linux-node-24-full'] = { 'plan.json': plan }
  for (const [index, report] of reports.entries()) {
    value.files[`miniapp-e2e-ci-full-linux-node-24-shard-${index + 1}`] = { 'dated-suite-report/index.json': report }
  }
  value.files['miniapp-aggregate-linux-node-24-full'] = { 'report.json': aggregate }
  value.files['miniapp-linux-node-24-weapp-build'] = { '.tmp/build-artifact-manifest.json': { schemaVersion: 2, commit: value.context.checkoutSha, os: 'linux', arch: 'x64', toolchain: { nodeVersion: 'v24.18.0', actualPackageManager: 'pnpm@11.0.0' } } }
  for (const name of Object.keys(value.files).filter(name => !value.artifacts.some(artifact => artifact.name === name))) {
    value.artifacts.push({ ...value.artifacts[0], id: value.artifacts.length + 100, name })
  }
  const descriptor = {
    id: 'ordinary-suite',
    kind: 'task-suite',
    scopeLevel: 'tasks',
    scope: taskSuiteScope(plan),
    plan: { artifact: 'miniapp-plan-linux-node-24-full', file: 'plan.json' },
    shards: reports.map((_, index) => ({ artifact: `miniapp-e2e-ci-full-linux-node-24-shard-${index + 1}`, filePattern: '**/*-suite-report/index.json', expectedCount: 1 })),
    aggregate: { artifact: 'miniapp-aggregate-linux-node-24-full', file: 'report.json' },
    toolchain: { artifact: 'miniapp-linux-node-24-weapp-build', file: '.tmp/build-artifact-manifest.json' },
  }
  value.contract.evidence.push(descriptor)
  return { ...value, plan, reports, aggregate, descriptor }
}

const buildTasks = labels => labels.map(label => ({ label, command: 'node', args: ['check.ts', label] }))

async function logicalTaskFixture(topology = 'optimized-v2', labels = GITHUB_ISSUES_BUILD_TASK_LABELS, provider = 'none') {
  const value = await taskFixture({ topology, profile: { ...profile, provider }, tasks: buildTasks(['unrelated', ...labels]) })
  const attempt = topology === 'optimized-v1' ? 1 : 2
  const variant = topology === 'optimized-v1' ? 'baseline' : 'candidate'
  value.context.verificationTopology = topology
  value.context.runAttempt = attempt
  value.run.run_attempt = attempt
  value.configuration.identity.runAttempt = attempt
  value.configuration.comparisonProtocol = TOPOLOGY_V2_COMPARISON_PROTOCOL
  value.configuration.cohort = { id: `${variant}-1`, variant }
  value.contract.comparisonProtocol = TOPOLOGY_V2_COMPARISON_PROTOCOL
  for (const job of value.jobs) {
    job.run_attempt = attempt
  }
  const file = '.github/verification-workload.json'
  const source = JSON.stringify({ ...JSON.parse(value.immutableFiles[file]), verificationTopologyByAttempt: { 1: 'optimized-v1', 2: 'optimized-v2' } })
  value.immutableFiles[file] = source
  Object.assign(value.context.benchmarkWorkload.manifest, { blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0${source}`).digest('hex'), sha256: createHash('sha256').update(source).digest('hex') })
  value.contract.workload = structuredClone(value.context.benchmarkWorkload)
  Object.assign(value.descriptor, {
    scopeLevel: 'logical-tasks-v2',
    comparisonProtocol: TOPOLOGY_V2_COMPARISON_PROTOCOL,
    scope: taskSuiteScope(value.plan, 'logical-tasks-v2'),
  })
  return value
}

it('accepts complete non-strict task execution without claiming DOM checkpoint coverage', async () => {
  const value = await taskFixture()
  const result = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(result.sample?.complete).toBe(true)
  expect(result.evidence.execution.inventories.find(entry => entry.id === 'ordinary-suite')).toEqual({ id: 'ordinary-suite', kind: 'task-suite', scope: taskSuiteScope(value.plan) })
  expect(result.sample.profile.node).toContain('v24.18.0')
})

it('accepts the official GitHub OS spelling while retaining the actual resource value', async () => {
  const value = await taskFixture()
  value.files['miniapp-linux-node-24-weapp-build']['.tmp/build-artifact-manifest.json'].os = 'Linux'
  const result = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(result.sample?.complete).toBe(true)
  expect(result.evidence.execution.resources.some(resource => resource.os === 'Linux')).toBe(true)
  expect(result.sample.profile.os).toContain('linux')
})

it('prepares counted artifact selectors from the actual ordinary-suite plan', async () => {
  const value = await taskFixture()
  const result = await withCiRun(value.repository, 123, value.execute, async ({ download }) => discoverTaskSuites(value.artifacts, download, value.context, { ...value.configuration, profile: value.contract.profile }))
  expect(result.gaps).toEqual([])
  expect(result.evidence).toHaveLength(1)
  expect(result.evidence[0]).toMatchObject({ kind: 'task-suite', scopeLevel: 'tasks', scope: taskSuiteScope(value.plan) })
  expect(result.evidence[0].shards[0]).toMatchObject({ filePattern: '**/*-suite-report/index.json', expectedCount: 1 })
})

it('recomputes complete baseline shards without adding an aggregation job and retains the receipt', async () => {
  const value = await taskFixture()
  for (const [index, shard] of value.reports.entries()) {
    const name = `verification-suite-miniapp-e2e-ci-full-linux-node-24-shard-${index + 1}`
    value.files[name] = { 'plan.json': value.plan, 'shard.json': shard, 'toolchain.json': value.files['miniapp-linux-node-24-weapp-build']['.tmp/build-artifact-manifest.json'] }
    value.artifacts.push({ ...value.artifacts[0], id: 200 + index, name })
  }
  value.artifacts = value.artifacts.filter(artifact => !artifact.name.startsWith('miniapp-plan-'))
  const result = await withCiRun(value.repository, 123, value.execute, async ({ download }) => discoverTaskSuites(value.artifacts, download, value.context, { ...value.configuration, profile: value.contract.profile }))
  expect(result.gaps).toEqual([])
  expect(result.evidence).toHaveLength(1)
  expect(result.evidence[0]).toMatchObject({ aggregateMode: 'verified-shards', kind: 'task-suite', scope: taskSuiteScope(value.plan) })
  value.contract.evidence = [value.contract.evidence[0], result.evidence[0]]
  const observed = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(observed.sample?.complete).toBe(true)
  expect(observed.evidence.execution.aggregates[0].report).toMatchObject({ coverage: 'complete', acceptance: 'passed', execution: { scope: 'full', status: 'passed' } })
})

it('compares the complete reviewed v2 logical task set while checking each physical definition independently', async () => {
  const baseline = await logicalTaskFixture('optimized-v1', [GITHUB_ISSUES_BUILD_BASELINE_LABEL])
  const candidate = await logicalTaskFixture()
  expect(taskSuiteScope(baseline.plan)).not.toEqual(taskSuiteScope(candidate.plan))
  const results = await Promise.all([baseline, candidate].map(value => collectCiEvidence(value.repository, 123, value.configuration, value.execute)))
  expect(results.every(result => result.sample?.complete)).toBe(true)
  expect(results[0].sample.scopeDigest).toBe(results[1].sample.scopeDigest)
  expect(results[1].evidence.execution.inventories.find(entry => entry.id === 'ordinary-suite').scope)
    .toEqual([[GITHUB_ISSUES_BUILD_BASELINE_LABEL, null, null], ['unrelated', null, null]])
  expect(candidate.plan.tasks).toHaveLength(25)
  candidate.reports[0].tasks[0].definitionHash = 'f'.repeat(64)
  expect((await collectCiEvidence(candidate.repository, 123, candidate.configuration, candidate.execute)).sample).toBeNull()
})

it.each(['missing', 'opposite', 'changed-policy'])(
  'rejects %s frozen-context binding for the actual v2 task-suite plan',
  async (fault) => {
    const value = await logicalTaskFixture()
    const context = { ...value.context }
    if (fault === 'missing') {
      delete context.verificationTopology
    }
    if (fault === 'opposite') {
      context.verificationTopology = 'optimized-v1'
    }
    if (fault === 'changed-policy') {
      value.plan.executionTopology.policyDigest = 'f'.repeat(64)
    }
    await expect(readTaskSuite(value.descriptor, context, async () => value.plan)).rejects.toThrow(/topology|policy/iu)
  },
)

it('keeps actual task-suite provider in the v2 comparison scope', async () => {
  const first = await logicalTaskFixture()
  const second = await logicalTaskFixture('optimized-v2', GITHUB_ISSUES_BUILD_TASK_LABELS, 'headless')
  const values = await Promise.all([first, second].map(value => collectCiEvidence(value.repository, 123, value.configuration, value.execute)))
  expect(values.every(value => value.sample?.complete)).toBe(true)
  expect(values[0].sample.scopeDigest).not.toBe(values[1].sample.scopeDigest)
})

it('requires actual plan topology under a formal v2 contract even for physical task scope', async () => {
  const value = await taskFixture({ topology: 'optimized-v1' })
  const context = { ...value.context, verificationTopology: 'optimized-v2' }
  await expect(readTaskSuite(value.descriptor, context, async () => value.plan, { comparisonProtocol: TOPOLOGY_V2_COMPARISON_PROTOCOL }))
    .rejects
    .toThrow(/topology differs from the frozen CI context/u)
})

it.each(['missing', 'duplicate', 'mixed', 'reason', 'templates'])(
  'rejects %s physical build groups instead of hiding them in one logical task',
  async (fault) => {
    const value = await logicalTaskFixture()
    const changed = structuredClone(value.plan)
    if (fault === 'missing') {
      changed.tasks.pop()
    }
    if (fault === 'duplicate') {
      changed.tasks.push(changed.tasks[1])
    }
    if (fault === 'mixed') {
      changed.tasks.push({ ...changed.tasks[1], label: GITHUB_ISSUES_BUILD_BASELINE_LABEL })
    }
    if (fault === 'reason') {
      changed.tasks[1].outOfScopeReason = 'not applicable'
    }
    if (fault === 'templates') {
      changed.tasks[1].acceptanceTemplates = ['another-template']
    }
    expect(() => taskSuiteScope(changed, 'logical-tasks-v2')).toThrow()
  },
)

it.each(['missing protocol', 'old protocol', 'unknown protocol', 'strict plan', 'missing actual task', 'physical scope claim'])(
  'retains raw timing without a sample for v2 %s',
  async (fault) => {
    const value = await logicalTaskFixture()
    if (fault === 'missing protocol') {
      delete value.descriptor.comparisonProtocol
    }
    if (fault === 'old protocol') {
      value.descriptor.comparisonProtocol = 'same-main-topology-v1'
    }
    if (fault === 'unknown protocol') {
      value.descriptor.comparisonProtocol = 'unreviewed'
    }
    if (fault === 'strict plan') {
      value.plan.strict = true
    }
    if (fault === 'missing actual task') {
      value.reports[0].tasks.pop()
    }
    if (fault === 'physical scope claim') {
      value.descriptor.scope = taskSuiteScope(value.plan)
    }
    const result = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
    expect(result.sample).toBeNull()
    expect(result.incompleteReason).toBeTruthy()
  },
)

it('keeps ordinary task scope sensitive to physical definitions and limits logical scope to the reviewed pair', async () => {
  const value = await logicalTaskFixture()
  const changed = structuredClone(value.plan)
  changed.tasks[0].definitionHash = 'f'.repeat(64)
  expect(taskSuiteScope(changed)).not.toEqual(taskSuiteScope(value.plan))
  expect(taskSuiteScope(changed, 'logical-tasks-v2')).toEqual(taskSuiteScope(value.plan, 'logical-tasks-v2'))
  changed.executionTopology.id = 'legacy-v1'
  expect(() => taskSuiteScope(changed, 'logical-tasks-v2')).toThrow('reviewed v2')
  expect(() => taskSuiteScope(value.plan, 'unreviewed')).toThrow('Unsupported')
})

it.each([
  ['missing shard', value => value.descriptor.shards.pop()],
  ['duplicate shard', value => value.descriptor.shards[1] = value.descriptor.shards[0]],
  ['changed task definition', value => value.reports[0].tasks[0].definitionHash = 'f'.repeat(64)],
  ['missing actual task', value => value.reports[0].tasks.pop()],
  ['failed execution', value => value.reports[0].tasks[0].status = 'failed'],
  ['modified aggregate', value => value.aggregate.tasks[0].durationMs++],
  ['changed expected scope', value => value.descriptor.scope.pop()],
  ['unknown clean state', value => value.plan.workingTreeDirty = null],
  ['wrong toolchain', value => value.files['miniapp-linux-node-24-weapp-build']['.tmp/build-artifact-manifest.json'].toolchain.nodeVersion = 'v22.20.0'],
  ['wrong actual OS', value => value.files['miniapp-linux-node-24-weapp-build']['.tmp/build-artifact-manifest.json'].os = 'Windows'],
  ['unknown actual OS', value => value.files['miniapp-linux-node-24-weapp-build']['.tmp/build-artifact-manifest.json'].os = 'LINUX'],
  ['wrong actual architecture', value => value.files['miniapp-linux-node-24-weapp-build']['.tmp/build-artifact-manifest.json'].arch = 'arm64'],
  ['strict masquerading as task scope', value => value.plan.strict = true],
  ['checkpoint claim', value => value.descriptor.scopeLevel = 'checkpoints'],
  ['unknown aggregation mode', value => value.descriptor.aggregateMode = 'assumed-complete'],
  ['ambiguous derived aggregation', value => value.descriptor.aggregateMode = 'verified-shards'],
])('retains only raw timing for %s', async (_, mutate) => {
  const value = await taskFixture()
  mutate(value)
  const result = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(result.sample).toBeNull()
  expect(result.incompleteReason).toBeTruthy()
})
