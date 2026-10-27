import assert from 'node:assert/strict'
import { GITHUB_ISSUES_BUILD_BASELINE_LABEL, GITHUB_ISSUES_BUILD_TASK_LABELS } from '../../../e2e/ci/githubIssuesBuild/groups.ts'
import { aggregateVerificationReports } from '../../../e2e/scripts/verification/aggregate.ts'
import { verificationPlanSchema, verificationSuiteReportSchema } from '../../../e2e/scripts/verification/validation.ts'
import { TOPOLOGY_V2_COMPARISON_PROTOCOL } from '../../verification/topology.ts'
import { verificationResource } from '../../verificationTelemetry/os.mjs'
import { logicalRuntimeTaskInventory } from '../runtimeInventory.mjs'
import { assertCiExecutionTopology } from './executionTopology.mjs'

export function taskSuiteScope(plan, scopeLevel = 'tasks') {
  if (scopeLevel === 'logical-tasks-v2') {
    const topology = plan.executionTopology?.id
    assert(['optimized-v1', 'optimized-v2'].includes(topology), 'Logical task scope requires a reviewed v2 comparison topology')
    assert(!plan.tasks.some(task => topology === 'optimized-v1'
      ? GITHUB_ISSUES_BUILD_TASK_LABELS.includes(task.label)
      : task.label === GITHUB_ISSUES_BUILD_BASELINE_LABEL), 'Logical build task inventory differs from its frozen topology')
    return logicalRuntimeTaskInventory(plan.tasks)
  }
  assert(scopeLevel === 'tasks', 'Unsupported task-suite scope level')
  return plan.tasks.map(task => [task.label, task.definitionHash, task.outOfScopeReason ?? null]).sort(([left], [right]) => left.localeCompare(right))
}

/** 普通 CI 证明实际 task 全集与定义；严格 IDE 仍走独立 DOM case/checkpoint 门禁。 */
export async function readTaskSuite(descriptor, context, read, contract = {}) {
  const plan = verificationPlanSchema.parse(await read(descriptor.plan))
  assert(plan.strict === false && ['tasks', 'logical-tasks-v2'].includes(descriptor.scopeLevel), 'Task-suite evidence only supports explicitly non-strict task scope')
  if (descriptor.scopeLevel === 'logical-tasks-v2') {
    assert(descriptor.comparisonProtocol === TOPOLOGY_V2_COMPARISON_PROTOCOL, 'Logical task scope requires the explicit reviewed v2 comparison protocol')
  }
  const formalV2 = descriptor.comparisonProtocol === TOPOLOGY_V2_COMPARISON_PROTOCOL || contract.comparisonProtocol === TOPOLOGY_V2_COMPARISON_PROTOCOL
  if (formalV2) {
    assertCiExecutionTopology(plan.executionTopology, context)
  }
  assert(plan.commitSha === context.checkoutSha, 'Task-suite checkout mismatch')
  assert(Array.isArray(descriptor.shards) && descriptor.shards.length === plan.shardTotal, 'Missing task-suite shard references')
  const shards = await Promise.all(descriptor.shards.map(reference => read(reference)))
  const expected = await aggregateVerificationReports(plan, shards)
  if (descriptor.aggregateMode === 'verified-shards') {
    assert(!descriptor.aggregate, 'Derived task-suite aggregation cannot also claim an uploaded aggregate')
  }
  else {
    assert(descriptor.aggregateMode === undefined, 'Unknown task-suite aggregation mode')
    const actual = verificationSuiteReportSchema.parse(await read(descriptor.aggregate))
    for (const key of ['schemaVersion', 'toolVersion', 'runId', 'commitSha', 'workingTreeDirty', 'strict', 'coverage', 'acceptance', 'execution', 'tasks', 'summary']) {
      assert.deepEqual(actual[key], expected[key], `Task-suite aggregate differs from verified shards: ${key}`)
    }
  }
  const toolchain = await read(descriptor.toolchain)
  assert(toolchain.schemaVersion === 2 && toolchain.commit === context.checkoutSha, 'Task-suite toolchain checkout mismatch')
  const scope = taskSuiteScope(plan, descriptor.scopeLevel)
  return { scope, ...(formalV2 ? { comparisonScope: { provider: plan.profile.provider, tasks: scope } } : {}), resource: verificationResource(toolchain, plan.profile), ...(descriptor.aggregateMode === 'verified-shards' ? { aggregateReceipt: expected } : {}) }
}
