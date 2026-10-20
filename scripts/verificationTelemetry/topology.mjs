import assert from 'node:assert/strict'

const implementations = new Map([
  ['./.github/workflows/reusable-node-command.yml', 'baseline'],
  ['./.github/workflows/reusable-quality-platform.yml', 'candidate'],
])

/** 从实际质量入口判别受支持的拓扑，未知或混合入口不能退回基线。 */
export function verificationTopologyVariant(workflow) {
  const variants = ['build-pr', 'build-release-pr', 'build-full'].map(id => implementations.get(workflow?.jobs?.[id]?.uses))
  assert(variants.every(variant => variant && variant === variants[0]), 'Unknown or mixed verification workflow topology')
  return variants[0]
}

/** 基线保留原投影；候选同时冻结原生 job 的步骤、环境和失败策略。 */
export function workflowTopology(workflow, variant) {
  assert(['baseline', 'candidate'].includes(variant), 'Unknown verification topology variant')
  return Object.fromEntries(Object.entries(workflow.jobs).map(([id, job]) => [id, Object.fromEntries(Object.entries(job)
    .filter(([key]) => variant === 'candidate' || ['name', 'if', 'needs', 'strategy', 'uses', 'runs-on', 'with'].includes(key))
    .map(([key, value]) => [key, key === 'with' ? Object.fromEntries(Object.entries(value).filter(([input]) => input !== 'verification_telemetry')) : value]))]))
}
