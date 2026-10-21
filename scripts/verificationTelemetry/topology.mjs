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

/** 两侧同时冻结完整 job，包括步骤、环境、遥测输入与失败策略。 */
export function workflowTopology(workflow, variant) {
  assert(['baseline', 'candidate'].includes(variant), 'Unknown verification topology variant')
  return structuredClone(workflow.jobs)
}
