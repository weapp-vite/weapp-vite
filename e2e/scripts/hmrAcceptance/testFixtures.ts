import type { PlannedTaskCaseReader } from '../domAcceptanceReport/taskCases'
import type { HmrAcceptanceStage } from '../hmr-acceptance-manifest'
import type { HmrStageEvidence } from './report'
import type { HmrUnitReceipt } from './unit'
import { freeze, identity, profile, shardReports } from '../../../scripts/verificationE2E/fixtures'
import { createPlannedTaskCaseReader } from '../domAcceptanceReport/taskCases'
import { getSuiteTasks } from '../e2e-suite-manifest'

export function createHmrUnitReceipt(overrides: Partial<HmrUnitReceipt> = {}): HmrUnitReceipt {
  return {
    schemaVersion: 1,
    kind: 'hmr-unit-receipt',
    ...identity,
    command: ['pnpm', 'test:hmr'],
    status: 'passed',
    exitCode: 0,
    startedAt: '2026-10-19T00:00:00.000Z',
    finishedAt: '2026-10-19T00:01:00.000Z',
    artifacts: { stdout: 'unit/stdout.log', stderr: 'unit/stderr.log', vitest: 'unit/vitest.json' },
    summary: { testFiles: 1, totalTests: 2, passedTests: 2, failedTests: 0, pendingTests: 0, todoTests: 0 },
    ...overrides,
  }
}

async function freezeHmrStageEvidence(stage: HmrAcceptanceStage, readCases: PlannedTaskCaseReader): Promise<HmrStageEvidence> {
  const plan = await freeze({ suite: stage.suite, tasks: await getSuiteTasks(stage.suite), shards: 1, profile: { ...profile, provider: stage.provider }, readCases })
  const shard = shardReports(plan)[0]!
  const supported = plan.tasks.filter(task => !task.outOfScopeReason)
  const cases = supported.flatMap(task => task.cases ?? []).filter(item => item.providerScope?.scope !== 'out-of-scope').length
  return {
    stage,
    plan,
    ...(stage.provider === 'none'
      ? {}
      : {
          runtime: { runId: plan.runId, commitSha: plan.commitSha, provider: stage.provider, tasks: supported.map(task => task.label).sort(), cases, checkpoints: cases },
        }),
    report: {
      ...shard,
      schemaVersion: 2,
      tasks: plan.tasks.map((task) => {
        const result = { label: task.label, definitionHash: task.definitionHash, durationMs: task.estimatedDurationMs, exitCode: 0, artifacts: [] }
        return task.outOfScopeReason
          ? { ...result, status: 'out-of-scope' as const, reason: task.outOfScopeReason }
          : { ...result, status: 'passed' as const }
      }),
      summary: { ...shard.summary, taskCount: plan.tasks.length, plannedCount: supported.length, executedCount: supported.length, passedCount: supported.length, outOfScopeCount: plan.tasks.length - supported.length },
      strict: plan.strict,
      suiteName: `e2e:${stage.suite}`,
      coverage: 'complete',
      acceptance: 'passed',
      execution: { ...shard.execution, scope: 'full', status: 'passed' },
      excludedProjects: [],
      generatedAt: shard.execution.finishedAt,
      reportDir: '',
      reportSlug: stage.name,
      markdownFile: '',
      jsonFile: 'aggregate.json',
    },
  }
}

export function createHmrStageEvidence(stage: HmrAcceptanceStage) {
  return freezeHmrStageEvidence(stage, createPlannedTaskCaseReader())
}

export function createHmrStageEvidenceSet(stages: readonly HmrAcceptanceStage[]) {
  const readCases = createPlannedTaskCaseReader()
  return Promise.all(stages.map(stage => freezeHmrStageEvidence(stage, readCases)))
}

export function passingVitestJson() {
  return {
    success: true,
    numTotalTests: 2,
    numPassedTests: 2,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [{
      name: 'hmr.test.ts',
      status: 'passed',
      assertionResults: [
        { fullName: 'HMR native updates', status: 'passed' },
        { fullName: 'HMR classic fallback', status: 'passed' },
      ],
    }],
  }
}
