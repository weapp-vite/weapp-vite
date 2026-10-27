import assert from 'node:assert/strict'
import { assertVerificationTopology, resolveVerificationTopology } from '../../verification/topology.ts'

/** 正式 v2 证据必须证明实际执行策略与原生审批冻结的策略完全一致。 */
export function assertCiExecutionTopology(actual, context) {
  assert(['optimized-v1', 'optimized-v2'].includes(context.verificationTopology), 'Missing reviewed frozen CI verification topology')
  assertVerificationTopology(actual)
  assert.deepEqual(actual, resolveVerificationTopology(context.verificationTopology, {}), 'Actual execution topology differs from the frozen CI context')
}
