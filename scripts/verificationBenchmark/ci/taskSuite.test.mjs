import { expect, it } from 'vitest'
import { aggregateVerificationReports } from '../../../e2e/scripts/verification/aggregate.ts'
import { freeze, shardReports } from '../../verificationE2E/fixtures.ts'
import { collectCiEvidence } from '../ci.mjs'
import { fixture } from './fixture.mjs'
import { withCiRun } from './github.mjs'
import { discoverTaskSuites } from './prepareTaskSuites.mjs'
import { taskSuiteScope } from './taskSuite.mjs'

async function taskFixture() {
  const value = fixture()
  const plan = await freeze({ identity: { runId: 'suite', commitSha: value.context.checkoutSha, workingTreeDirty: false } })
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
