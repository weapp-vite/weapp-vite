import type { HmrAcceptanceStage } from '../hmr-acceptance-manifest'
import type { HmrStageEvidence } from './report'
import type { HmrUnitReceipt } from './unit'
import { freeze, identity, profile, shardReports } from '../../../scripts/verificationE2E/fixtures'
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

export async function createHmrStageEvidence(stage: HmrAcceptanceStage): Promise<HmrStageEvidence> {
  const plan = await freeze({ suite: stage.suite, tasks: await getSuiteTasks(stage.suite), shards: 1, profile: { ...profile, provider: stage.provider } })
  const shard = shardReports(plan)[0]!
  const cases = plan.tasks.flatMap(task => task.cases ?? []).filter(item => item.providerScope?.scope !== 'out-of-scope').length
  return {
    stage,
    plan,
    ...(stage.provider === 'none'
      ? {}
      : {
          runtime: { runId: plan.runId, commitSha: plan.commitSha, provider: stage.provider, tasks: plan.tasks.map(task => task.label).sort(), cases, checkpoints: cases },
        }),
    report: {
      ...shard,
      schemaVersion: 2,
      tasks: shard.tasks.map(task => ({ ...task, status: 'passed' })),
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
