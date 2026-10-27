import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { GITHUB_ISSUES_BUILD_TASK_LABELS } from '../../e2e/ci/githubIssuesBuild/groups.ts'
import { assertTaskCaseCoverage } from '../../e2e/scripts/domAcceptanceReport/taskCases.ts'
import { assertVerificationTopology, logicalTopologyTaskLabels } from '../verification/topology.ts'

/** 从被测工作树的正式入口冻结清单，不接受配置或已完成报告反推验收范围。 */
export async function createRuntimeInventory(root, suite, executionTopology) {
  if (executionTopology) {
    assertVerificationTopology(executionTopology)
  }
  const [manifest, cases, definitions] = await Promise.all([
    import(pathToFileURL(path.join(root, 'e2e/scripts/e2e-suite-manifest.ts')).href),
    import(pathToFileURL(path.join(root, 'e2e/scripts/domAcceptanceReport/taskCases.ts')).href),
    executionTopology ? import(pathToFileURL(path.join(root, 'e2e/scripts/verification/plan.ts')).href) : undefined,
  ])
  const tasks = await manifest.getSuiteTasks(suite, { topology: executionTopology?.id })
  assert(tasks.length && new Set(tasks.map(task => task.label)).size === tasks.length, 'Runtime benchmark formal task inventory is empty or duplicated')
  return await Promise.all(tasks.map(async (task) => {
    const definitionHash = definitions?.taskDefinitionHash(task)
    assert(!executionTopology || /^[a-f0-9]{64}$/u.test(definitionHash ?? ''), 'Runtime benchmark formal task definition hash is missing or invalid')
    return {
      label: task.label,
      ...(definitions ? { definitionHash } : {}),
      outOfScopeReason: task.outOfScopeReason,
      acceptanceTemplates: task.acceptanceTemplates,
      cases: task.outOfScopeReason ? [] : await cases.readPlannedTaskCases(task, 'devtools'),
    }
  }))
}

/** 只允许正式清单中既定的非适用任务，并核对完整实际任务与执行分配。 */
export function assertRuntimeTaskInventory(report, inventory) {
  assert.deepEqual(report.tasks.map(task => task.label).sort(), inventory.map(task => task.label).sort(), 'Runtime benchmark task set differs from the formal manifest')
  assert.deepEqual([...report.execution.assignedTasks].sort(), inventory.filter(task => !task.outOfScopeReason).map(task => task.label).sort(), 'Runtime benchmark assigned task set differs from the formal manifest')
  for (const planned of inventory) {
    const actual = report.tasks.find(task => task.label === planned.label)
    if (Object.hasOwn(planned, 'definitionHash')) {
      assert(/^[a-f0-9]{64}$/u.test(planned.definitionHash ?? '') && actual.definitionHash === planned.definitionHash, 'Runtime benchmark task definition differs from the frozen formal manifest')
    }
    if (planned.outOfScopeReason) {
      assert(actual.status === 'out-of-scope' && actual.reason === planned.outOfScopeReason
        && actual.durationMs === 0 && actual.exitCode === 0 && actual.artifacts.length === 0, 'Runtime benchmark non-applicable task differs from the formal manifest')
    }
    else {
      assert(actual.status !== 'out-of-scope', 'Runtime benchmark cannot exclude an applicable formal task')
    }
  }
}

/** 同一任务的全部 invocation 必须覆盖冻结的用例及模板集合，并绑定显式传入的实际 provider。 */
export function assertRuntimeCaseInventory(planned, reports, provider) {
  assert(provider === 'devtools' || provider === 'headless', 'Runtime benchmark actual provider is missing or invalid')
  if (planned.outOfScopeReason) {
    assert(reports.length === 0, 'Non-applicable runtime task cannot contain DOM evidence')
    return
  }
  assert(reports.every(report => report.provider === provider), 'Runtime benchmark DOM provider differs from the actual provider')
  if (planned.acceptanceTemplates) {
    assert.deepEqual(reports.map(report => report.template).sort(), [...planned.acceptanceTemplates].sort(), 'Runtime benchmark template set differs from the formal manifest')
  }
  assertTaskCaseCoverage(planned.cases, reports, false, provider)
}

/** 比较完整任务集合时只展开已审阅的 TDesign 四合一，不忽略其他任务。 */
export function logicalRuntimeTaskInventory(inventory) {
  assert(new Set(inventory.map(task => task.label)).size === inventory.length, 'Physical runtime task inventory is duplicated')
  const groups = inventory.filter(task => GITHUB_ISSUES_BUILD_TASK_LABELS.includes(task.label))
  assert(!groups.length || groups.length === GITHUB_ISSUES_BUILD_TASK_LABELS.length, 'Logical build group inventory is incomplete')
  const tasks = new Map()
  for (const task of inventory) {
    for (const label of logicalTopologyTaskLabels(task.label)) {
      const value = [label, task.outOfScopeReason ?? null, task.acceptanceTemplates ?? null]
      const previous = tasks.get(label)
      // 构建任务按真实变体拆开后映射回一个逻辑任务，其他重叠仍属于重复执行。
      if (previous) {
        assert(label === 'ci/github-issues.build.test.ts' && previous.physical !== label && task.label !== label, 'Logical runtime task inventory is duplicated')
        assert.deepEqual(previous.value, value, 'Logical build group metadata differs')
      }
      tasks.set(label, { physical: task.label, value })
    }
  }
  return [...tasks.values()].map(entry => entry.value).sort(([left], [right]) => left.localeCompare(right))
}
