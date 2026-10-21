import assert from 'node:assert/strict'
import { discoverBaselineTaskSuites } from '../../verificationTelemetry/baselineEvidence.mjs'
import { readArtifactDocuments } from './artifacts.mjs'
import { readExecutionEvidence } from './evidence.mjs'
import { taskSuiteScope } from './taskSuite.mjs'

/** 由真实 plan 自动定位同轮 shards/verdict，不从配置声称任务已经执行。 */
export async function discoverTaskSuites(artifacts, download, context, configuration) {
  const evidence = []
  const gaps = []
  for (const artifact of artifacts.filter(value => value.name.startsWith('miniapp-plan-'))) {
    const suffix = artifact.name.slice('miniapp-plan-'.length)
    try {
      const match = /^(.*-node-\d+)-(pr|full)$/u.exec(suffix)
      assert(match, 'Unsupported miniapp plan resource identity')
      const [, resource, mode] = match
      const reference = { artifact: artifact.name, file: 'plan.json' }
      const [bytes] = await readArtifactDocuments(reference, download)
      const plan = JSON.parse(bytes.toString('utf8'))
      assert(Number.isSafeInteger(plan.shardTotal) && plan.shardTotal > 0 && plan.shardTotal <= 100, 'Invalid miniapp shard count')
      const descriptor = {
        id: `task-suite-${suffix}`,
        kind: 'task-suite',
        scopeLevel: 'tasks',
        scope: taskSuiteScope(plan),
        plan: reference,
        shards: Array.from({ length: plan.shardTotal }, (_, index) => ({ artifact: `miniapp-e2e-ci-${mode}-${resource}-shard-${index + 1}`, filePattern: '**/*-suite-report/index.json', expectedCount: 1 })),
        aggregate: { artifact: `miniapp-aggregate-${suffix}`, file: 'report.json' },
        toolchain: { artifact: `miniapp-${resource}-weapp-build`, file: '.tmp/build-artifact-manifest.json' },
      }
      const observed = await readExecutionEvidence({ ...configuration, evidence: [descriptor] }, context, download, configuration)
      assert(observed.complete, observed.reason)
      evidence.push(descriptor)
    }
    catch (error) {
      gaps.push({ id: `task-suite-${suffix}`, reason: error.message })
    }
  }
  const baseline = await discoverBaselineTaskSuites(artifacts, async reference => JSON.parse((await readArtifactDocuments(reference, download))[0].toString('utf8')))
  evidence.push(...baseline.evidence)
  gaps.push(...baseline.gaps)
  if (!evidence.length) {
    gaps.push({ id: 'task-suites', reason: 'No complete non-strict suite plan, actual shard task results, aggregate verdict and matching full toolchain; baseline must add the same evidence instrumentation while preserving its original commands' })
  }
  return { evidence, gaps }
}
