import { expect, it } from 'vitest'
import { getSuiteTasks } from '../../e2e/scripts/e2e-suite-manifest.ts'
import { assertRuntimeCaseInventory, assertRuntimeTaskInventory } from './runtimeInventory.mjs'

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
  const reports = [{ template: 'one', cases: [first] }, { template: 'two', cases: [second] }]
  expect(() => assertRuntimeCaseInventory(planned, reports)).not.toThrow()
  expect(() => assertRuntimeCaseInventory(planned, [{ ...reports[0], cases: [first, first] }, reports[1]])).toThrow(/case inventory/)
  expect(() => assertRuntimeCaseInventory(planned, [{ ...reports[0], template: 'two' }, reports[1]])).toThrow(/template set/)
  expect(() => assertRuntimeCaseInventory({ outOfScopeReason: 'non-applicable' }, reports)).toThrow(/cannot contain/)
})
