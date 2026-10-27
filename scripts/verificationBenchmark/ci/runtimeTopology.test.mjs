import { expect, it } from 'vitest'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../../../e2e/scripts/domAcceptanceReport/helpers.ts'
import { resolveVerificationTopology, TOPOLOGY_V2_COMPARISON_PROTOCOL } from '../../verification/topology.ts'
import { collectCiEvidence } from '../ci.mjs'
import { runtimeScope } from '../evidence.mjs'
import { fixture, time } from './fixture.mjs'

function runtimeFixture() {
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
    execution: { scope: 'full', status: 'passed', executionTopology: resolveVerificationTopology('optimized-v1', {}), profile: { provider: 'headless', os: 'linux', arch: 'x64', nodeMajor: 24 }, assignedTasks: ['runtime'] },
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
  return { ...value, report, acceptance }
}

function formalize(value) {
  value.context.verificationTopology = 'optimized-v1'
  value.contract.comparisonProtocol = TOPOLOGY_V2_COMPARISON_PROTOCOL
  value.configuration.comparisonProtocol = TOPOLOGY_V2_COMPARISON_PROTOCOL
}

it('requires actual runtime topology for formal v2 CI while retaining old contract compatibility', async () => {
  const value = runtimeFixture()
  delete value.report.execution.executionTopology
  expect((await collectCiEvidence(value.repository, 123, value.configuration, value.execute)).sample?.complete).toBe(true)
  formalize(value)
  const missing = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(missing.sample).toBeNull()
  expect(missing.incompleteReason).toMatch(/topology/iu)
  value.report.execution.executionTopology = resolveVerificationTopology('optimized-v1', {})
  const valid = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(valid.sample?.complete).toBe(true)
  expect(valid.evidence.execution.inventories.find(entry => entry.id === 'runtime').comparisonScope).toMatchObject({ provider: 'headless' })
})

it.each([
  ['other reviewed topology', value => value.report.execution.executionTopology = resolveVerificationTopology('optimized-v2', {}), 'Actual execution topology differs from the frozen CI context'],
  ['changed policy', value => value.report.execution.executionTopology.policyDigest = 'f'.repeat(64), 'Missing or invalid frozen verification topology'],
  ['different actual provider', value => value.contract.profile.provider = 'devtools', 'Actual runtime provider differs from the frozen benchmark contract'],
  ['mixed acceptance provider', value => value.acceptance.provider = 'devtools', 'DOM acceptance metadata incomplete: Missing observed DevTools or base library version in mounted'],
])('retains only raw timing for formal v2 runtime %s', async (_, mutate, expected) => {
  const value = runtimeFixture()
  formalize(value)
  mutate(value)
  const result = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(result.sample).toBeNull()
  expect(result.incompleteReason?.split('\n')[0]).toBe(expected)
})
