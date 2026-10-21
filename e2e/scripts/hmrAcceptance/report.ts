import type { HmrAcceptanceStage } from '../hmr-acceptance-manifest'
import type { SuiteReportPayload } from '../suiteReport'
import type { VerificationPlan } from '../verification/types'
import type { HmrRuntimeReceipt } from './runtimeEvidence'
import type { HmrUnitReceipt } from './unit'
import { assertVerificationTopology } from '../../../scripts/verification/topology.ts'
import { HMR_ACCEPTANCE_CAPABILITIES, HMR_ACCEPTANCE_SCENARIOS } from '../hmr-acceptance-manifest'
import { verificationHash } from '../verification/plan'
import { assertVerificationProfile } from '../verification/profile'
import { HMR_ACCEPTANCE_CAPABILITY_COVERAGE } from './capabilities'
import { HMR_HISTORICAL_IDE_BASELINE, HMR_HISTORICAL_IDE_FAILURES } from './history'
import { assertHmrUnitReceipt } from './unit'

export interface HmrStageEvidence {
  stage: HmrAcceptanceStage
  plan: VerificationPlan
  report: SuiteReportPayload
  runtime?: HmrRuntimeReceipt
}

/** 仅 platform 的非微信 runtime 边界可按批准范围豁免，未知能力默认仍是必需项。 */
export function evaluateHmrCapabilityCoverage(evidence: HmrStageEvidence[], capabilities: readonly { id: string }[] = HMR_ACCEPTANCE_CAPABILITIES) {
  const passed = (file: string, provider: 'none' | 'devtools' | 'headless') => {
    const stage = evidence.find(item => item.stage.provider === provider)
    const label = file.replace(/^e2e\//, '')
    const task = stage?.plan.tasks.find(item => item.label === label)
    return Boolean(task && stage?.report.tasks.some(item => item.label === label && item.definitionHash === task.definitionHash && item.status === 'passed' && item.exitCode === 0))
  }
  const hasRuntime = (capabilityId: string) => {
    const coverage = HMR_ACCEPTANCE_CAPABILITY_COVERAGE.find(item => item.capabilityId === capabilityId)
    return coverage?.runtime === 'planned' && coverage.runtimeScenarios.length > 0
      && coverage.runtimeScenarios.every(id => HMR_ACCEPTANCE_SCENARIOS.some(scenario => scenario.id === id
        && scenario.capabilityIds.includes(capabilityId as typeof scenario.capabilityIds[number])
        && !scenario.observation && scenario.expectations.length > 0
        && scenario.ide.length > 0 && scenario.headless.length > 0
        && scenario.ide.every(file => passed(file, 'devtools')) && scenario.headless.every(file => passed(file, 'headless'))))
  }
  const missingRuntimeCoverage = capabilities.filter(capability => !hasRuntime(capability.id)).map(capability => capability.id)
  const scopeBoundaries = HMR_ACCEPTANCE_CAPABILITY_COVERAGE.flatMap((coverage) => {
    const boundary = coverage.runtimeApplicability
    if (coverage.capabilityId !== 'platform' || boundary?.target !== 'non-wechat' || !boundary.reason.trim() || !boundary.requiredBuildTests.length) {
      return []
    }
    const buildPassed = boundary.requiredBuildTests.every(file => coverage.build.includes(file) && passed(file, 'none'))
    return [{ capabilityId: coverage.capabilityId, ...boundary, buildCoverage: buildPassed ? 'passed' : 'incomplete', runtimeCoverage: 'not-executed' }]
  })
  const missingRequiredCoverage = missingRuntimeCoverage.filter(id => !scopeBoundaries.some(boundary => boundary.capabilityId === id && boundary.buildCoverage === 'passed'))
  return { missingRuntimeCoverage, missingRequiredCoverage, scopeBoundaries }
}

/** 综合汇总同时要求有效单测收据和逐项复验的完整 E2E 分层报告。 */
export function createHmrAcceptanceSummary(expected: readonly HmrAcceptanceStage[], evidence: HmrStageEvidence[], unit?: HmrUnitReceipt) {
  if (!expected.length || evidence.length !== expected.length
    || new Set(evidence.map(item => item.stage.name)).size !== expected.length) {
    throw new Error('HMR acceptance is missing a required stage or contains duplicate stages')
  }
  const identity = evidence[0]!.plan
  assertVerificationTopology(identity.executionTopology)
  const scope = expected.length === 3 ? 'full' : 'stage'
  if (scope === 'full') {
    assertHmrUnitReceipt(unit, identity)
  }
  for (const { stage, plan, report, runtime } of evidence) {
    const reportTopology = report.execution?.executionTopology
    assertVerificationTopology(plan.executionTopology)
    assertVerificationTopology(reportTopology)
    if (verificationHash(plan.executionTopology) !== verificationHash(identity.executionTopology)
      || verificationHash(reportTopology) !== verificationHash(identity.executionTopology)) {
      throw new Error('HMR acceptance requires the same frozen execution topology across every plan and report')
    }
    // 汇总阶段的环境已切到最后一个 provider；按冻结内容复核，避免把 build 误作 strict runtime。
    const { planHash, ...content } = plan
    if (planHash !== verificationHash(content) || plan.strict !== (stage.provider !== 'none')) {
      throw new Error('HMR acceptance contains a modified or mismatched frozen plan')
    }
    const requested = expected.find(item => item.name === stage.name)
    if (!requested || requested.suite !== plan.suite || requested.provider !== plan.profile.provider
      || report.runId !== identity.runId || plan.runId !== identity.runId
      || report.commitSha !== identity.commitSha || plan.commitSha !== identity.commitSha
      || report.workingTreeDirty !== false || plan.workingTreeDirty !== false
      || report.suiteName !== `e2e:${requested.suite}`
      || report.strict !== (requested.provider !== 'none')
      || report.coverage !== 'complete' || report.acceptance !== 'passed'
      || report.execution?.scope !== 'full' || report.execution.status !== 'passed'
      || report.execution.planHash !== plan.planHash
      || report.summary.plannedCount === 0 || report.summary.plannedCount !== plan.tasks.length || report.summary.plannedCount !== report.summary.executedCount
      || report.summary.passedCount !== report.summary.plannedCount
      || report.summary.failedCount || report.summary.blockedCount || report.summary.skippedCount || report.summary.notExecutedCount || report.summary.outOfScopeCount
      || plan.tasks.some(task => task.outOfScopeReason) || report.tasks.some(task => task.status === 'out-of-scope')) {
      throw new Error('HMR acceptance requires complete passing stages from the same clean commit and frozen plans')
    }
    if (report.tasks.length !== plan.tasks.length || new Set(report.tasks.map(task => task.label)).size !== report.tasks.length
      || plan.tasks.some(planned => !report.tasks.some(task => task.label === planned.label && task.definitionHash === planned.definitionHash && task.status === 'passed' && task.exitCode === 0))) {
      throw new Error('HMR acceptance requires every task to pass its frozen definition exactly once')
    }
    if (stage.provider !== 'none') {
      const plannedCases = plan.tasks.flatMap(task => task.cases ?? []).filter(item => item.providerScope?.scope !== 'out-of-scope').length
      if (!runtime || runtime.runId !== identity.runId || runtime.commitSha !== identity.commitSha || runtime.provider !== stage.provider
        || JSON.stringify(runtime.tasks) !== JSON.stringify(plan.tasks.map(task => task.label).sort())
        || !plannedCases || !Number.isSafeInteger(runtime.cases) || !Number.isSafeInteger(runtime.checkpoints)
        || runtime.cases !== plannedCases || runtime.checkpoints < plannedCases) {
        throw new Error('HMR acceptance requires matching completed runtime cases and checkpoints')
      }
    }
    assertVerificationProfile(plan.profile, report.execution.profile)
    assertVerificationProfile({ ...identity.profile, provider: plan.profile.provider }, plan.profile)
  }
  const capabilityCoverage = evaluateHmrCapabilityCoverage(evidence)
  const incomplete = scope === 'full' && capabilityCoverage.missingRequiredCoverage.length > 0
  return {
    schemaVersion: 1,
    kind: 'hmr-acceptance',
    scope,
    runId: identity.runId,
    commitSha: identity.commitSha,
    workingTreeDirty: false,
    executionTopology: identity.executionTopology,
    acceptanceScope: 'wechat-runtime-and-cross-platform-build',
    coverage: incomplete ? 'partial' : 'complete',
    acceptance: incomplete ? 'incomplete' : 'passed',
    ...(scope === 'full' ? { unit } : {}),
    capabilities: HMR_ACCEPTANCE_CAPABILITIES,
    capabilityCoveragePlan: HMR_ACCEPTANCE_CAPABILITY_COVERAGE,
    capabilityAcceptance: {
      status: scope === 'stage' ? 'not-evaluated' : incomplete ? 'incomplete' : capabilityCoverage.missingRuntimeCoverage.length ? 'passed-for-scope' : 'passed',
      globalRuntimeStatus: capabilityCoverage.missingRuntimeCoverage.length ? 'incomplete' : 'passed',
      ...capabilityCoverage,
    },
    scenarios: HMR_ACCEPTANCE_SCENARIOS,
    historicalCoverage: {
      baseline: HMR_HISTORICAL_IDE_BASELINE,
      meaning: 'coverage-mapping-only',
      failures: HMR_HISTORICAL_IDE_FAILURES.map(failure => ({
        ...failure,
        suite: failure.scenarioId ? 'ide-hmr' : 'ide-full:exhaustive',
      })),
    },
    stages: evidence.map(({ stage, plan, report, runtime }) => ({
      stage: stage.name,
      suite: plan.suite,
      planHash: plan.planHash,
      executionTopology: plan.executionTopology,
      profile: plan.profile,
      summary: report.summary,
      ...(runtime ? { runtime } : {}),
    })),
  }
}

/** 全量命令保留不完整摘要后仍必须失败，不能用退出零掩盖未知或漏跑的必需能力。 */
export function assertHmrAcceptanceComplete(summary: ReturnType<typeof createHmrAcceptanceSummary>) {
  if (summary.scope === 'full' && (summary.acceptance !== 'passed' || summary.capabilityAcceptance.missingRequiredCoverage.length)) {
    throw new Error(`HMR acceptance is missing required capability evidence: ${summary.capabilityAcceptance.missingRequiredCoverage.join(', ')}`)
  }
}
