import { createMatrix, frozenManifest, metricsForShard, policy, targetKey } from './contract.mjs'
import { hmrProfileCapability } from './profileCapability.mjs'

export const target = { id: 'pr-7', prNumber: 7, headSha: 'a'.repeat(40), headRepository: 'owner/repo', baselineSha: policy.baselineSha }
export const plan = { manifest: frozenManifest(), schemaVersion: 2, purpose: 'full', samplingContract: policy.samplingContract, driverSha: 'b'.repeat(40), repository: 'owner/repo', runId: '10', targets: [{ ...target, key: targetKey(target) }], reused: [], matrix: createMatrix([target]) }

export function fixture(shard = 'hmr:classic:weapp-vite-template', os = 'ubuntu-latest') {
  const identity = { schemaVersion: 2, purpose: 'full', samplingContract: policy.samplingContract, driverSha: plan.driverSha, headSha: target.headSha, baselineSha: target.baselineSha, targetId: target.id, prNumber: 7, runId: '10', os, shard }
  const metrics: string[] = metricsForShard(shard)
  const count = shard === 'build' || shard === 'auto-build' ? 7 : 20
  const samples = Array.from({ length: count }, (_, round) => (round % 2 ? ['optimized', 'baseline'] : ['baseline', 'optimized']).map((side) => {
    const profileCapability = shard.startsWith('hmr:') ? hmrProfileCapability(side, side === 'baseline' ? target.baselineSha : target.headSha, shard.split(':')[1]!) : undefined
    return { round, side, profileCapability, values: metrics.map(id => ({ id, ms: side === 'baseline' ? 100 : 102, profileStatus: profileCapability?.status === 'unavailable' ? 'unavailable' : 'missing', output: { pageCount: 1, templateDigest: 'a'.repeat(64), configDigest: 'b'.repeat(64) } })) }
  })).flat()
  return { identity, report: { ...identity, baseline: { commit: target.baselineSha }, optimized: { commit: target.headSha }, manifest: { metrics }, executionPlan: { metrics, confirmation: [] as string[] }, primary: { errors: [] as string[], samples }, gate: { status: 'passed' } } }
}
