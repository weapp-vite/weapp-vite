import assert from 'node:assert/strict'
import { aggregateVerificationReports } from '../../../e2e/scripts/verification/aggregate.ts'
import { verificationPlanSchema, verificationSuiteReportSchema } from '../../../e2e/scripts/verification/validation.ts'
import { verificationResource } from '../../verificationTelemetry/os.mjs'

export function taskSuiteScope(plan) {
  return plan.tasks.map(task => [task.label, task.definitionHash, task.outOfScopeReason ?? null]).sort(([left], [right]) => left.localeCompare(right))
}

/** 普通 CI 证明实际 task 全集与定义；严格 IDE 仍走独立 DOM case/checkpoint 门禁。 */
export async function readTaskSuite(descriptor, context, read) {
  const plan = verificationPlanSchema.parse(await read(descriptor.plan))
  assert(plan.strict === false && descriptor.scopeLevel === 'tasks', 'Task-suite evidence only supports explicitly non-strict task scope')
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
  return { scope: taskSuiteScope(plan), resource: verificationResource(toolchain, plan.profile), ...(descriptor.aggregateMode === 'verified-shards' ? { aggregateReceipt: expected } : {}) }
}
