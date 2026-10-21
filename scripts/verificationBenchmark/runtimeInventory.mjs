import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertTaskCaseCoverage } from '../../e2e/scripts/domAcceptanceReport/taskCases.ts'

/** 从被测工作树的正式入口冻结清单，不接受配置或已完成报告反推验收范围。 */
export async function createRuntimeInventory(root, suite) {
  const [manifest, cases] = await Promise.all([
    import(pathToFileURL(path.join(root, 'e2e/scripts/e2e-suite-manifest.ts')).href),
    import(pathToFileURL(path.join(root, 'e2e/scripts/domAcceptanceReport/taskCases.ts')).href),
  ])
  const tasks = await manifest.getSuiteTasks(suite)
  assert(tasks.length && new Set(tasks.map(task => task.label)).size === tasks.length, 'Runtime benchmark formal task inventory is empty or duplicated')
  return await Promise.all(tasks.map(async task => ({
    label: task.label,
    outOfScopeReason: task.outOfScopeReason,
    acceptanceTemplates: task.acceptanceTemplates,
    cases: task.outOfScopeReason ? [] : await cases.readPlannedTaskCases(task, 'devtools'),
  })))
}

/** 只允许正式清单中既定的非适用任务，并核对完整实际任务与执行分配。 */
export function assertRuntimeTaskInventory(report, inventory) {
  assert.deepEqual(report.tasks.map(task => task.label).sort(), inventory.map(task => task.label).sort(), 'Runtime benchmark task set differs from the formal manifest')
  assert.deepEqual([...report.execution.assignedTasks].sort(), inventory.filter(task => !task.outOfScopeReason).map(task => task.label).sort(), 'Runtime benchmark assigned task set differs from the formal manifest')
  for (const planned of inventory) {
    const actual = report.tasks.find(task => task.label === planned.label)
    if (planned.outOfScopeReason) {
      assert(actual.status === 'out-of-scope' && actual.reason === planned.outOfScopeReason
        && actual.durationMs === 0 && actual.exitCode === 0 && actual.artifacts.length === 0, 'Runtime benchmark non-applicable task differs from the formal manifest')
    }
    else {
      assert(actual.status !== 'out-of-scope', 'Runtime benchmark cannot exclude an applicable formal task')
    }
  }
}

/** 同一任务的全部 invocation 必须覆盖冻结的用例及模板集合。 */
export function assertRuntimeCaseInventory(planned, reports) {
  if (planned.outOfScopeReason) {
    assert(reports.length === 0, 'Non-applicable runtime task cannot contain DOM evidence')
    return
  }
  if (planned.acceptanceTemplates) {
    assert.deepEqual(reports.map(report => report.template).sort(), [...planned.acceptanceTemplates].sort(), 'Runtime benchmark template set differs from the formal manifest')
  }
  assertTaskCaseCoverage(planned.cases, reports)
}
