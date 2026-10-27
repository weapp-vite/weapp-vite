import type { VerificationPlan } from './types'
import { createHash } from 'node:crypto'
import { assertVerificationTopology } from '../../../scripts/verification/topology.ts'
import { isValidProviderCaseScope } from '../domAcceptanceReport/caseCoverage'
import { isStrictDomAcceptanceSuite } from '../domAcceptanceReport/helpers'
import { VERIFICATION_TOOL_VERSION } from './types'

export function verificationHash(value: unknown): string {
  const canonical = (entry: unknown): unknown => Array.isArray(entry)
    ? entry.map(canonical)
    : entry && typeof entry === 'object'
      ? Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [key, canonical(value)]))
      : entry
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

/** 聚合只依赖冻结契约，不加载 Git、源码 AST 或任务调度器。 */
export function assertVerificationPlanContract(plan: VerificationPlan) {
  assertVerificationTopology(plan.executionTopology)
  const { planHash, ...content } = plan
  if (plan.schemaVersion !== 1 || plan.toolVersion !== VERIFICATION_TOOL_VERSION || planHash !== verificationHash(content)
    || plan.workingTreeDirty !== false || !plan.profile.arch
    || !plan.tasks.length || new Set(plan.tasks.map(task => task.label)).size !== plan.tasks.length
    || plan.strict !== isStrictDomAcceptanceSuite(plan.suite)
    || !Number.isInteger(plan.shardTotal) || plan.shardTotal < 1
    || new Set(plan.tasks.filter(task => !task.outOfScopeReason).map(task => task.shardIndex)).size !== plan.shardTotal
    || plan.tasks.some(task => !Number.isFinite(task.estimatedDurationMs) || task.estimatedDurationMs <= 0
      || !Number.isInteger(task.shardIndex) || task.shardIndex < (task.outOfScopeReason ? 0 : 1) || task.shardIndex > plan.shardTotal
      || (task.outOfScopeReason && task.shardIndex !== 0)
      || (plan.strict && !task.outOfScopeReason && (!task.cases?.length
        || new Set(task.cases.map(item => JSON.stringify([item.file, item.name]))).size !== task.cases.length
        || task.cases.every(item => item.providerScope?.scope === 'out-of-scope')
        || task.cases.some(item => item.file !== `e2e/${task.label}`
          || !isValidProviderCaseScope(item.providerScope, plan.profile.provider === 'headless' ? 'headless' : 'devtools')))))) {
    throw new Error('Invalid or modified frozen verification plan')
  }
}
