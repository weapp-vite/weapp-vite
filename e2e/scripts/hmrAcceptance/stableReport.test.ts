import type { HmrStageEvidence } from './report'
import { beforeAll, describe, expect, it } from 'vitest'
import { isolateTopologyTestEnvironment, useIsolatedTopologyTestEnvironment } from '../../../scripts/verification/topologyTestFixture.ts'
import { rehash } from '../../../scripts/verificationE2E/fixtures'
import { HMR_CLASSIC_ACCEPTANCE_STAGES } from '../hmr-acceptance-manifest'
import { assertHmrAcceptanceComplete, createHmrAcceptanceSummary, evaluateHmrCapabilityCoverage } from './report'
import { CLASSIC_HMR_OUT_OF_SCOPE_REASONS } from './stableScope'
import { createHmrStageEvidenceSet, createHmrUnitReceipt } from './testFixtures'

useIsolatedTopologyTestEnvironment()

let frozen: HmrStageEvidence[]

beforeAll(async () => {
  const restore = isolateTopologyTestEnvironment()
  try {
    frozen = await createHmrStageEvidenceSet(HMR_CLASSIC_ACCEPTANCE_STAGES)
  }
  finally {
    restore()
  }
})

describe('classic HMR acceptance boundaries', () => {
  it('keeps the complete inventory while counting only supported passing tasks and cases', () => {
    const stages = structuredClone(frozen)
    const summary = createHmrAcceptanceSummary(HMR_CLASSIC_ACCEPTANCE_STAGES, stages, createHmrUnitReceipt())
    expect(summary).toMatchObject({ acceptance: 'passed', coverage: 'complete', acceptanceScope: 'wechat-classic-runtime-and-cross-platform-build' })
    expect(summary.capabilityAcceptance.status).toBe('passed-for-scope')
    expect(summary.capabilityAcceptance.globalRuntimeStatus).toBe('incomplete')
    expect(summary.capabilityAcceptance.missingRuntimeCoverage).not.toContain('ide-classic-handoff')
    for (const [index, stage] of stages.entries()) {
      const supported = stage.plan.tasks.filter(task => !task.outOfScopeReason)
      expect(stage.report.summary.passedCount).toBe(supported.length)
      expect(summary.stages[index]!.outOfScopeTasks).toEqual(stage.plan.tasks.filter(task => task.outOfScopeReason).map(task => ({ label: task.label, reason: task.outOfScopeReason })))
      expect(summary.stages[index]!.outOfScopeTasks.length).toBeGreaterThan(0)
      if (stage.runtime) {
        expect(stage.runtime.tasks).toEqual(supported.map(task => task.label).sort())
      }
    }
    expect(() => assertHmrAcceptanceComplete(summary)).not.toThrow()
  })

  it.each(['missing-task', 'borrowed-reason', 'changed-reason', 'missing-case', 'promoted-experiment', 'passed-experiment', 'reason-report', 'extra-runtime-task', 'missing-runtime-case'])(
    'rejects %s even when hashes and task exits are made consistent',
    (fault) => {
      const stages = structuredClone(frozen)
      const stage = stages.find(item => item.stage.provider === 'devtools')!
      const supported = stage.plan.tasks.find(task => !task.outOfScopeReason)!
      const excluded = stage.plan.tasks.find(task => task.outOfScopeReason)!
      const mixed = stage.plan.tasks.find(task => task.label === 'ide/issue-1015-css-hmr.runtime.test.ts')!
      if (fault === 'missing-task') {
        stage.plan.tasks = stage.plan.tasks.filter(task => task !== supported)
      }
      if (fault === 'borrowed-reason') {
        supported.outOfScopeReason = excluded.outOfScopeReason
      }
      if (fault === 'changed-reason') {
        excluded.outOfScopeReason = excluded.outOfScopeReason === CLASSIC_HMR_OUT_OF_SCOPE_REASONS.stateful
          ? CLASSIC_HMR_OUT_OF_SCOPE_REASONS.handoff
          : CLASSIC_HMR_OUT_OF_SCOPE_REASONS.stateful
      }
      if (fault === 'missing-case') {
        mixed.cases = []
      }
      if (fault === 'promoted-experiment') {
        delete excluded.outOfScopeReason
      }
      if (fault === 'passed-experiment') {
        stage.report.tasks.find(task => task.label === excluded.label)!.status = 'passed'
      }
      if (fault === 'reason-report') {
        stage.report.tasks.find(task => task.label === excluded.label)!.reason = 'another diagnostic reason'
      }
      if (fault === 'extra-runtime-task') {
        stage.runtime!.tasks.push(excluded.label)
      }
      if (fault === 'missing-runtime-case') {
        stage.runtime!.cases -= 1
      }
      stage.plan = rehash(stage.plan)
      stage.report.execution!.planHash = stage.plan.planHash
      expect(() => createHmrAcceptanceSummary(HMR_CLASSIC_ACCEPTANCE_STAGES, stages, createHmrUnitReceipt())).toThrow()
    },
  )

  it('continues to require unknown capabilities instead of silently assigning them an experimental boundary', () => {
    expect(evaluateHmrCapabilityCoverage(structuredClone(frozen), [{ id: 'future-capability' }]).missingRequiredCoverage).toEqual(['future-capability'])
  })
})
