import { expect, it } from 'vitest'
import { evaluateAcceptanceCase } from '../../e2e/scripts/domAcceptanceReport/helpers.ts'
import { freezeProviderCaseScope } from '../../e2e/scripts/domAcceptanceReport/taskCases.ts'
import { getSuiteTasks } from '../../e2e/scripts/e2e-suite-manifest.ts'
import { taskDefinitionHash } from '../../e2e/scripts/verification/plan.ts'
import { assertRuntimeCaseInventory, assertRuntimeTaskInventory } from './runtimeInventory.mjs'

function acceptedCase(item) {
  return evaluateAcceptanceCase({
    ...item,
    id: item.name,
    state: 'passed',
    acceptance: {
      fixture: 'e2e-apps/fixture',
      provider: 'devtools',
      runtime: { ideVersion: 'stable-fixture', baseLibraryVersion: 'sdk-fixture' },
      checkpoints: [{ id: 'mount', route: '/pages/index/index', action: 'launch', nodes: [{ selector: '.title', text: 'Ready' }] }],
      evidence: [{ id: 'mount', route: 'pages/index/index', source: 'devtools-page-frame', capturedAt: '2026-10-19T00:00:01.000Z', nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
    },
  })
}

async function formalReport() {
  const inventory = await getSuiteTasks('ide-full:exhaustive')
  const report = {
    execution: { assignedTasks: inventory.filter(task => !task.outOfScopeReason).map(task => task.label) },
    tasks: inventory.map(task => ({
      label: task.label,
      status: task.outOfScopeReason ? 'out-of-scope' : 'passed',
      reason: task.outOfScopeReason,
      durationMs: task.outOfScopeReason ? 0 : 1,
      exitCode: 0,
      artifacts: [],
    })),
  }
  return { report, inventory }
}

it('accepts the complete real exhaustive task set including exactly its three declared non-applicable tasks', async () => {
  const { report, inventory } = await formalReport()
  expect(report.tasks.filter(task => task.status === 'out-of-scope')).toHaveLength(3)
  expect(() => assertRuntimeTaskInventory(report, inventory)).not.toThrow()
})

it.each(['missing', 'extra', 'duplicate', 'exclude', 'reason', 'assigned', 'duration', 'artifacts'])(
  'rejects a %s deviation from the actual exhaustive manifest',
  async (fault) => {
    const { report, inventory } = await formalReport()
    const applicable = report.tasks.find(task => task.status === 'passed')
    const nonApplicable = report.tasks.find(task => task.status === 'out-of-scope')
    if (fault === 'missing') {
      report.tasks.pop()
    }
    if (fault === 'extra') {
      report.tasks.push({ ...applicable, label: 'unexpected-task' })
    }
    if (fault === 'duplicate') {
      report.tasks.push({ ...applicable })
    }
    if (fault === 'exclude') {
      applicable.status = 'out-of-scope'
      applicable.reason = 'Excluded by WEAPP_VITE_E2E_EXCLUDE_PROJECTS'
    }
    if (fault === 'reason') {
      nonApplicable.reason = 'temporary exemption'
    }
    if (fault === 'assigned') {
      report.execution.assignedTasks.pop()
    }
    if (fault === 'duration') {
      nonApplicable.durationMs = 1
    }
    if (fault === 'artifacts') {
      nonApplicable.artifacts.push({ kind: 'dom-acceptance-report', indexPath: 'unexpected.json' })
    }
    expect(() => assertRuntimeTaskInventory(report, inventory)).toThrow(/formal/)
  },
)

it('requires all formal cases and templates and rejects DOM evidence for a non-applicable task', () => {
  const first = { file: 'e2e/task.test.ts', name: 'first' }
  const second = { file: 'e2e/task.test.ts', name: 'second' }
  const planned = { cases: [first, second], acceptanceTemplates: ['one', 'two'] }
  const reports = [{ provider: 'devtools', template: 'one', cases: [acceptedCase(first)] }, { provider: 'devtools', template: 'two', cases: [acceptedCase(second)] }]
  expect(() => assertRuntimeCaseInventory(planned, reports, 'devtools')).not.toThrow()
  expect(() => assertRuntimeCaseInventory(planned, [{ ...reports[0], cases: [acceptedCase(first), acceptedCase(first)] }, reports[1]], 'devtools')).toThrow(/case inventory/)
  expect(() => assertRuntimeCaseInventory(planned, [{ ...reports[0], template: 'two' }, reports[1]], 'devtools')).toThrow(/template set/)
  expect(() => assertRuntimeCaseInventory({ outOfScopeReason: 'non-applicable' }, reports, 'devtools')).toThrow(/cannot contain/)
})

it.each(['missing-state', 'missing-status', 'missing-acceptance', 'skipped', 'failed', 'pending'])(
  'rejects %s despite an exact runtime case inventory',
  (fault) => {
    const item = { file: 'e2e/task.test.ts', name: 'renders' }
    const actual = acceptedCase(item)
    if (fault.startsWith('missing-')) {
      delete actual[fault.slice('missing-'.length)]
    }
    else {
      actual.state = fault
    }
    expect(() => assertRuntimeCaseInventory({ cases: [item] }, [{ provider: 'devtools', cases: [actual] }], 'devtools')).toThrow('Planned DOM case did not pass with acceptance evidence')
  },
)

it('accepts only provider-scoped skips and rejects missing or inconsistent provider identity', () => {
  const item = { file: 'e2e/task.test.ts', name: 'headless only' }
  const applicability = { providers: ['headless'], conditions: [{ modifier: 'runIf', expression: 'runtimeProvider === \'headless\'', source: 'e2e/task.test.ts:1' }] }
  const scoped = { ...item, providerScope: freezeProviderCaseScope(applicability, 'devtools') }
  const planned = { cases: [scoped] }
  const skipped = evaluateAcceptanceCase({ ...item, id: 'headless', state: 'skipped' })
  const reports = [{ provider: 'devtools', cases: [skipped] }]
  expect(() => assertRuntimeCaseInventory(planned, reports, 'devtools')).not.toThrow()
  expect(() => assertRuntimeCaseInventory(planned, reports)).toThrow('actual provider is missing or invalid')
  expect(() => assertRuntimeCaseInventory(planned, reports, 'unknown')).toThrow('actual provider is missing or invalid')
  expect(() => assertRuntimeCaseInventory(planned, reports, 'headless')).toThrow('DOM provider differs')
  expect(() => assertRuntimeCaseInventory(planned, [{ cases: [skipped] }], 'devtools')).toThrow('DOM provider differs')
  expect(() => assertRuntimeCaseInventory({ cases: [item] }, reports, 'devtools')).toThrow('Planned DOM case did not pass')
  expect(() => assertRuntimeCaseInventory(planned, [{ provider: 'devtools', cases: [acceptedCase(item)] }], 'devtools')).toThrow('Planned DOM case did not pass')
  const inScope = { ...item, providerScope: freezeProviderCaseScope(applicability, 'headless') }
  expect(() => assertRuntimeCaseInventory({ cases: [inScope] }, [{ provider: 'headless', cases: [skipped] }], 'headless')).toThrow('Planned DOM case did not pass')
  expect(() => assertRuntimeCaseInventory({ cases: [inScope] }, reports, 'devtools')).toThrow('Invalid frozen DOM provider')
})

it.each(['missing-actual', 'invalid-frozen', 'missing-frozen', 'changed-non-applicable'])(
  'rejects %s task definitions instead of treating a missing hash as a compatibility default',
  async (fault) => {
    const { report, inventory } = await formalReport()
    const frozen = inventory.map(task => ({ ...task, definitionHash: taskDefinitionHash(task) }))
    report.tasks.forEach((task, index) => task.definitionHash = frozen[index].definitionHash)
    if (fault === 'missing-actual') {
      delete report.tasks[0].definitionHash
    }
    if (fault === 'invalid-frozen') {
      frozen[0].definitionHash = ''
      report.tasks[0].definitionHash = ''
    }
    if (fault === 'missing-frozen') {
      frozen[0].definitionHash = undefined
      report.tasks[0].definitionHash = undefined
    }
    if (fault === 'changed-non-applicable') {
      report.tasks.find(task => task.status === 'out-of-scope').definitionHash = 'f'.repeat(64)
    }
    expect(() => assertRuntimeTaskInventory(report, frozen)).toThrow('task definition')
  },
)
