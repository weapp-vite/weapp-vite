import { createHash } from 'node:crypto'
import process from 'node:process'
import { GITHUB_ISSUES_BUILD_BASELINE_LABEL, GITHUB_ISSUES_BUILD_TASK_LABELS } from '../../e2e/ci/githubIssuesBuild/groups.ts'

export type VerificationTopologyId = 'legacy-v1' | 'optimized-v1' | 'optimized-v2'

export interface VerificationTopology {
  id: VerificationTopologyId
  policy: 'verification-topology-v1'
  policyDigest: string
}

export const TOPOLOGY_ENV = 'WEAPP_VITE_VERIFICATION_TOPOLOGY'
export const TOPOLOGY_POLICY_ENV = 'WEAPP_VITE_VERIFICATION_TOPOLOGY_POLICY'
export const TOPOLOGY_COMPARISON_PROTOCOL = 'same-main-topology-v1'
export const TOPOLOGY_V2_COMPARISON_PROTOCOL = 'same-main-topology-v2'

/** 两侧使用相同的最终隔离实现，只改变这十四个文件的 worker 分区。 */
export const AUDITED_PARALLEL_FIXTURE_TESTS = [
  'test/auto-import.test.ts',
  'test/utils/fixtureIsolation.test.ts',
  'test/vue/advanced.test.ts',
  'test/vue/class-style-runtime.test.ts',
  'test/vue/compiler.test.ts',
  'test/vue/component-json.test.ts',
  'test/vue/emit-assets.test.ts',
  'test/vue/json-macros-strip.test.ts',
  'test/vue/native-page-layout.test.ts',
  'test/vue/resolver.installation.test.ts',
  'test/vue/runtime-export.test.ts',
  'test/vue/script-setup-define-model.test.ts',
  'test/vue/script-setup-define-props-emits.test.ts',
  'test/vue/sfc-integration.test.ts',
] as const

export const TDESIGN_AGGREGATE_LABEL = 'ide/template-wevu-tdesign-regression.aggregate.test.ts'
export const TDESIGN_SOURCE_LABELS = [
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.class-style-binding.test.ts',
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.form.test.ts',
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test.ts',
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test.ts',
] as const

const policy = {
  version: 'verification-topology-v1' as const,
  fixtures: { legacy: 'all-serial', optimized: AUDITED_PARALLEL_FIXTURE_TESTS },
  tdesign: { legacy: TDESIGN_SOURCE_LABELS, optimized: TDESIGN_AGGREGATE_LABEL },
  common: 'final-source-setup-owner-scheduler-observer-without-added-waits',
}
const policyDigest = createHash('sha256').update(JSON.stringify(policy)).digest('hex')
const v2PolicyDigest = createHash('sha256').update(JSON.stringify({
  ...policy,
  githubIssuesBuild: { baseline: GITHUB_ISSUES_BUILD_BASELINE_LABEL, candidate: GITHUB_ISSUES_BUILD_TASK_LABELS },
  preparation: 'frozen-context-in-job-standalone-aggregate-consumer-batches-node-contract-dedup-v2',
})).digest('hex')
const digestFor = (id: VerificationTopologyId) => id === 'optimized-v2' ? v2PolicyDigest : policyDigest

/** 比较协议固定两侧身份，默认拓扑只在独立验收通过后调整。 */
export function comparisonTopology(protocol: unknown, variant: unknown): VerificationTopologyId {
  if (![TOPOLOGY_COMPARISON_PROTOCOL, TOPOLOGY_V2_COMPARISON_PROTOCOL].includes(String(protocol))
    || !['baseline', 'candidate'].includes(String(variant))) {
    throw new Error('Unknown verification topology comparison protocol or variant')
  }
  return protocol === TOPOLOGY_COMPARISON_PROTOCOL
    ? variant === 'baseline' ? 'legacy-v1' : 'optimized-v1'
    : variant === 'baseline' ? 'optimized-v1' : 'optimized-v2'
}

/** 显式参数与继承环境必须一致，未知策略和旧策略摘要均在启动前拒绝。 */
export function resolveVerificationTopology(requested?: unknown, env: NodeJS.ProcessEnv = process.env): VerificationTopology {
  const inherited = env[TOPOLOGY_ENV]
  const id = requested ?? inherited ?? 'optimized-v1'
  if (id !== 'legacy-v1' && id !== 'optimized-v1' && id !== 'optimized-v2') {
    throw new Error('Unknown verification topology')
  }
  if ((inherited !== undefined && inherited !== id)
    || (env[TOPOLOGY_POLICY_ENV] !== undefined && env[TOPOLOGY_POLICY_ENV] !== digestFor(id))) {
    throw new Error('Verification topology differs from the inherited frozen identity')
  }
  return { id, policy: policy.version, policyDigest: digestFor(id) }
}

/** 回读报告时不从环境补齐缺失身份，防止旧报告冒充新协议。 */
export function assertVerificationTopology(value: unknown): asserts value is VerificationTopology {
  const entry = value as VerificationTopology | undefined
  if (!entry || Object.keys(entry).sort().join(',') !== 'id,policy,policyDigest'
    || !['legacy-v1', 'optimized-v1', 'optimized-v2'].includes(entry.id)
    || entry.policy !== policy.version || entry.policyDigest !== digestFor(entry.id)) {
    throw new Error('Missing or invalid frozen verification topology')
  }
}

export function topologyEnvironment(topology: VerificationTopology): Record<string, string> {
  assertVerificationTopology(topology)
  return { [TOPOLOGY_ENV]: topology.id, [TOPOLOGY_POLICY_ENV]: topology.policyDigest }
}

/** 仅映射已登记的物理分组；真实报告仍保存实际执行文件。 */
export function logicalTopologyTaskLabels(label: string): string[] {
  return label === TDESIGN_AGGREGATE_LABEL
    ? [...TDESIGN_SOURCE_LABELS]
    : (GITHUB_ISSUES_BUILD_TASK_LABELS as readonly string[]).includes(label) ? [GITHUB_ISSUES_BUILD_BASELINE_LABEL] : [label]
}

/** 对照工具只归一化登记的构建文件，实际报告和断言保留原始身份。 */
export function logicalTopologyCaseFile(file: string): string {
  const prefix = file.startsWith('e2e/') ? 'e2e/' : ''
  const label = prefix ? file.slice(prefix.length) : file
  return (GITHUB_ISSUES_BUILD_TASK_LABELS as readonly string[]).includes(label) ? `${prefix}${GITHUB_ISSUES_BUILD_BASELINE_LABEL}` : file
}

/** 正式配置必须自己指定两侧策略，不能仅继承调用者环境或默认值。 */
export function formalVerificationTopology(config: { comparisonProtocol?: unknown, topology?: unknown, variant?: unknown }): VerificationTopology {
  if (config.comparisonProtocol !== undefined && config.topology !== comparisonTopology(config.comparisonProtocol, config.variant)) {
    throw new Error('Formal topology comparison requires explicit reviewed baseline and candidate topologies')
  }
  return resolveVerificationTopology(config.topology)
}
