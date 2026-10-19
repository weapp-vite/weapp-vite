import assert from 'node:assert/strict'
import { classifyCoverageScope, coverageScopePolicy } from '../../verificationTelemetry/coveragePolicy.mjs'
import { coverageLogicalScope } from '../../verificationTelemetry/logicalCoverage.mjs'
import { readArtifactDocuments } from './artifacts.mjs'
import { readExecutionEvidence } from './evidence.mjs'

export async function discoverCoverage(artifacts, download, context, configuration) {
  const evidence = []
  const gaps = []
  for (const artifact of artifacts.filter(value => value.name.startsWith('coverage-plan-'))) {
    const suffix = artifact.name.slice('coverage-plan-'.length)
    try {
      const planReference = { artifact: artifact.name, file: 'plan.json' }
      const [bytes] = await readArtifactDocuments(planReference, download)
      const plan = JSON.parse(bytes.toString('utf8'))
      assert(Number.isSafeInteger(plan.shards) && plan.shards > 0 && plan.shards <= 100, 'Invalid coverage shard count')
      const shardReferences = Array.from({ length: plan.shards }, (_, index) => ({ artifact: `coverage-shard-${suffix}-${index + 1}`, file: 'manifest.json', blob: 'blob.json' }))
      const reports = await Promise.all(shardReferences.map(async reference => JSON.parse((await readArtifactDocuments(reference, download))[0].toString('utf8'))))
      const descriptor = {
        id: `coverage-${suffix}`,
        kind: 'coverage',
        profile: Object.fromEntries(['os', 'nodeMajor', 'nodeVersion', 'packageManager', 'arch'].map(key => [key, plan.identity?.[key]])),
        scopeLevel: 'audited-cases',
        scopePolicy: coverageScopePolicy,
        scope: classifyCoverageScope(coverageLogicalScope(plan, reports)),
        plan: planReference,
        shards: shardReferences,
        verdict: { artifact: `coverage-complete-${suffix}`, file: 'shard-verdict.json' },
      }
      const observed = await readExecutionEvidence({ ...configuration, evidence: [descriptor] }, context, download, configuration)
      assert(observed.complete, observed.reason)
      evidence.push(descriptor)
    }
    catch (error) {
      gaps.push({ id: `coverage-${suffix}`, reason: error.message })
    }
  }
  if (!evidence.length) {
    gaps.push({ id: 'coverage', reason: 'No complete actual test inventory, native execution blobs and original-threshold verdict; add identical evidence-only instrumentation to both variants without changing their execution commands or thresholds' })
  }
  return { evidence, gaps }
}
