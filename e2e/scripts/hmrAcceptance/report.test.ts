import { describe, expect, it } from 'vitest'
import { resolveVerificationTopology } from '../../../scripts/verification/topology.ts'
import { useIsolatedTopologyTestEnvironment } from '../../../scripts/verification/topologyTestFixture.ts'
import { rehash } from '../../../scripts/verificationE2E/fixtures'
import { HMR_ACCEPTANCE_STAGES } from '../hmr-acceptance-manifest'
import { assertHmrAcceptanceComplete, createHmrAcceptanceSummary, evaluateHmrCapabilityCoverage } from './report'
import { createHmrStageEvidence, createHmrUnitReceipt } from './testFixtures'

useIsolatedTopologyTestEnvironment()

describe('HMR acceptance across distinct runtime providers', () => {
  it('reports the three verified stages together without substituting one provider for another', async () => {
    const stages = await Promise.all(HMR_ACCEPTANCE_STAGES.map(createHmrStageEvidence))
    const result = createHmrAcceptanceSummary(HMR_ACCEPTANCE_STAGES, stages, createHmrUnitReceipt())
    expect(result).toMatchObject({ scope: 'full', coverage: 'complete', acceptance: 'passed' })
    expect(result.capabilityAcceptance).toMatchObject({
      status: 'passed-for-scope',
      globalRuntimeStatus: 'incomplete',
      missingRuntimeCoverage: ['platform'],
      missingRequiredCoverage: [],
      scopeBoundaries: [{ capabilityId: 'platform', target: 'non-wechat', buildCoverage: 'passed', runtimeCoverage: 'not-executed' }],
    })
    expect(() => assertHmrAcceptanceComplete(result)).not.toThrow()
    expect(result.unit?.summary).toMatchObject({ totalTests: 2, passedTests: 2 })
    expect(result.stages.map(stage => stage.profile.provider)).toEqual(['none', 'headless', 'devtools'])
    expect(result.executionTopology).toEqual(stages[0]!.plan.executionTopology)
    expect(result.stages.every(stage => stage.executionTopology.id === result.executionTopology.id)).toBe(true)
    expect(result.historicalCoverage.meaning).toBe('coverage-mapping-only')
    expect(result.historicalCoverage.failures).toHaveLength(26)
    expect(result.historicalCoverage.failures.filter(item => item.suite === 'ide-full:exhaustive')).toHaveLength(8)
  })

  it.each(['missing-report', 'different-report', 'mixed-stages', 'invalid-plan'])(
    'rejects %s execution topology at the summary boundary',
    async (fault) => {
      const stages = await Promise.all(HMR_ACCEPTANCE_STAGES.map(createHmrStageEvidence))
      const last = stages.at(-1)!
      const otherTopology = resolveVerificationTopology('legacy-v1')
      if (fault === 'missing-report') {
        delete last.report.execution!.executionTopology
      }
      if (fault === 'different-report') {
        last.report.execution!.executionTopology = otherTopology
      }
      if (fault === 'mixed-stages') {
        last.plan = rehash({ ...last.plan, executionTopology: otherTopology })
        last.report.execution!.executionTopology = otherTopology
        last.report.execution!.planHash = last.plan.planHash
      }
      if (fault === 'invalid-plan') {
        last.plan = rehash({ ...last.plan, executionTopology: { ...last.plan.executionTopology, policyDigest: '0'.repeat(64) } })
        last.report.execution!.planHash = last.plan.planHash
      }
      expect(() => createHmrAcceptanceSummary(HMR_ACCEPTANCE_STAGES, stages, createHmrUnitReceipt())).toThrow(/topology/)
    },
  )

  it('labels an independently passing stage without claiming full HMR acceptance', async () => {
    const build = HMR_ACCEPTANCE_STAGES[0]
    const result = createHmrAcceptanceSummary([build], [await createHmrStageEvidence(build)])
    expect(result.scope).toBe('stage')
    expect(result.capabilityAcceptance.status).toBe('not-evaluated')
    expect(result.capabilityAcceptance.missingRuntimeCoverage).toContain('engine-full-reload')
    expect(result).not.toHaveProperty('unit')
  })

  it.each(['missing', 'duplicate', 'sha', 'run', 'dirty', 'partial', 'skipped', 'blocked', 'provider', 'strict', 'plan', 'cleanup-failed', 'out-of-scope-plan', 'out-of-scope-report', 'out-of-scope-count'])(
    'rejects %s evidence instead of accepting a zero command exit code',
    async (fault) => {
      const stages = await Promise.all(HMR_ACCEPTANCE_STAGES.map(createHmrStageEvidence))
      const last = stages.at(-1)!
      if (fault === 'missing') {
        stages.pop()
      }
      if (fault === 'duplicate') {
        stages[2] = stages[1]!
      }
      if (fault === 'sha') {
        last.report.commitSha = 'c'.repeat(40)
      }
      if (fault === 'run') {
        last.report.runId = 'other-run'
      }
      if (fault === 'dirty') {
        last.report.workingTreeDirty = true
      }
      if (fault === 'partial') {
        last.report.coverage = 'partial'
      }
      if (fault === 'skipped') {
        last.report.summary.skippedCount = 1
      }
      if (fault === 'blocked') {
        last.report.summary.blockedCount = 1
      }
      if (fault === 'provider') {
        last.report.execution!.profile.provider = 'headless'
      }
      if (fault === 'strict') {
        last.report.strict = false
      }
      if (fault === 'plan') {
        last.report.execution!.planHash = 'd'.repeat(64)
      }
      if (fault === 'cleanup-failed') {
        last.report.execution!.status = 'failed'
      }
      if (fault === 'out-of-scope-plan') {
        last.plan.tasks[0]!.outOfScopeReason = 'Excluded by WEAPP_VITE_E2E_EXCLUDE_PROJECTS'
      }
      if (fault === 'out-of-scope-report') {
        last.report.tasks[0]!.status = 'out-of-scope'
      }
      if (fault === 'out-of-scope-count') {
        last.report.summary.outOfScopeCount = 1
      }
      expect(() => createHmrAcceptanceSummary(HMR_ACCEPTANCE_STAGES, stages, createHmrUnitReceipt())).toThrow()
    },
  )

  it('rejects three passing E2E layers without successful matching unit evidence', async () => {
    const stages = await Promise.all(HMR_ACCEPTANCE_STAGES.map(createHmrStageEvidence))
    const empty = createHmrUnitReceipt({ summary: { testFiles: 0, totalTests: 0, passedTests: 0, failedTests: 0, pendingTests: 0, todoTests: 0 } })
    for (const unit of [
      undefined,
      empty,
      createHmrUnitReceipt({ status: 'failed' }),
      createHmrUnitReceipt({ exitCode: 1 }),
      createHmrUnitReceipt({ commitSha: 'c'.repeat(40) }),
      createHmrUnitReceipt({ runId: 'other-run' }),
      createHmrUnitReceipt({ workingTreeDirty: true }),
    ]) {
      expect(() => createHmrAcceptanceSummary(HMR_ACCEPTANCE_STAGES, stages, unit)).toThrow('unit evidence')
    }
  })

  it.each(['missing', 'sha', 'provider', 'tasks', 'cases', 'checkpoints', 'invalid-checkpoints'])(
    'rejects %s runtime receipts even when every task exit code is zero',
    async (fault) => {
      const stages = await Promise.all(HMR_ACCEPTANCE_STAGES.map(createHmrStageEvidence))
      const runtime = stages[2]!.runtime!
      if (fault === 'missing') {
        delete stages[2]!.runtime
      }
      if (fault === 'sha') {
        runtime.commitSha = 'c'.repeat(40)
      }
      if (fault === 'provider') {
        runtime.provider = 'headless'
      }
      if (fault === 'tasks') {
        runtime.tasks.push(runtime.tasks[0]!)
      }
      if (fault === 'cases') {
        runtime.cases -= 1
      }
      if (fault === 'checkpoints') {
        runtime.checkpoints = 0
      }
      if (fault === 'invalid-checkpoints') {
        runtime.checkpoints = Number.NaN
      }
      expect(() => createHmrAcceptanceSummary(HMR_ACCEPTANCE_STAGES, stages, createHmrUnitReceipt())).toThrow('runtime cases and checkpoints')
    },
  )

  it.each(['ide/hmr-additional-capabilities.runtime.test.ts', 'ci/hmr-platform-fallback.test.ts'])(
    'cannot claim full success when the frozen inventory omits required evidence for %s',
    async (label) => {
      const stages = await Promise.all(HMR_ACCEPTANCE_STAGES.map(createHmrStageEvidence))
      const stage = stages.find(item => item.plan.tasks.some(task => task.label === label))!
      stage.plan = rehash({ ...stage.plan, tasks: stage.plan.tasks.filter(task => task.label !== label) })
      stage.report.tasks = stage.report.tasks.filter(task => task.label !== label)
      stage.report.execution!.planHash = stage.plan.planHash
      for (const key of ['taskCount', 'plannedCount', 'executedCount', 'passedCount'] as const) {
        stage.report.summary[key] -= 1
      }
      if (stage.runtime) {
        stage.runtime.tasks = stage.plan.tasks.map(task => task.label).sort()
        stage.runtime.cases = stage.plan.tasks.flatMap(task => task.cases ?? []).filter(item => item.providerScope?.scope !== 'out-of-scope').length
        stage.runtime.checkpoints = stage.runtime.cases
      }
      const result = createHmrAcceptanceSummary(HMR_ACCEPTANCE_STAGES, stages, createHmrUnitReceipt())
      expect(result).toMatchObject({ coverage: 'partial', acceptance: 'incomplete', capabilityAcceptance: { status: 'incomplete' } })
      expect(result.capabilityAcceptance.missingRequiredCoverage).toEqual(label.startsWith('ide/') ? ['engine-full-reload', 'patch-shape', 'skyline'] : ['platform'])
      expect(() => assertHmrAcceptanceComplete(result)).toThrow('missing required capability evidence')
    },
  )

  it('treats unknown future capabilities as required and does not infer runtime execution from mappings', () => {
    const result = evaluateHmrCapabilityCoverage([], [{ id: 'future-capability' }, { id: 'engine-full-reload' }])
    expect(result.missingRuntimeCoverage).toEqual(['future-capability', 'engine-full-reload'])
    expect(result.missingRequiredCoverage).toEqual(['future-capability', 'engine-full-reload'])
  })
})
