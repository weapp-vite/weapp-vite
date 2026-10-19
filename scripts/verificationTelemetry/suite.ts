import type { SuiteReportPayload } from '../../e2e/scripts/suiteReport'
import type { SuiteTask } from '../../e2e/scripts/suiteRunner'
import type { VerificationPlan } from '../../e2e/scripts/verification/types'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { ACCEPTANCE_ROOT, ACCEPTANCE_RUN_ID_ENV } from '../../e2e/scripts/domAcceptanceReport/helpers'
import { partitionE2ETasks } from '../../e2e/scripts/e2e-suite-manifest'
import { aggregateVerificationReports } from '../../e2e/scripts/verification/aggregate'
import { assertVerificationPlan, createVerificationIdentity, createVerificationPlan, resolveVerificationTasks, verificationHash } from '../../e2e/scripts/verification/plan'
import { currentVerificationProfile } from '../../e2e/scripts/verification/profile'
import { verificationPlanSchema } from '../../e2e/scripts/verification/validation'

const suites = new Set(['ci-pr', 'ci-full', 'ide-dom-headless'])

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}

/** 只冻结原 partitionE2ETasks 的分配，不以新 planner 改变基线任务顺序或归属。 */
export async function createBaselineSuitePlan(options: Parameters<typeof createVerificationPlan>[0]) {
  const tasks = options.tasks ?? await resolveVerificationTasks(options.suite)
  const initial = await createVerificationPlan({ ...options, tasks })
  const assignments = new Map(Array.from({ length: options.shards }, (_, index) => partitionE2ETasks(tasks, { index, total: options.shards }).map(task => [task.label, index + 1] as const)).flat())
  const { planHash: _initialHash, ...content } = initial
  content.tasks = content.tasks.map(task => ({ ...task, shardIndex: task.outOfScopeReason ? 0 : assignments.get(task.label)! }))
  const plan = { ...content, planHash: verificationHash(content) }
  assertVerificationPlan(plan)
  return plan
}

/** 在原 build job 内生成共享计划，沿用已有 build artifact 传递，无新增依赖层。 */
export async function prepareBaselineSuites(root: string, mode: 'pr' | 'full', env = process.env) {
  if (!['pr', 'full'].includes(mode) || !env.GITHUB_RUN_ID || !env.GITHUB_RUN_ATTEMPT) {
    throw new Error('Baseline telemetry requires a native run identity and explicit pr/full mode')
  }
  for (const suite of [mode === 'pr' ? 'ci-pr' : 'ci-full', 'ide-dom-headless']) {
    const identity = createVerificationIdentity({ ...env, [ACCEPTANCE_RUN_ID_ENV]: `${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}-${suite}` })
    const plan = await createBaselineSuitePlan({ suite, shards: suite === 'ci-full' ? 4 : 1, profile: currentVerificationProfile(suite, env), identity })
    await writeJson(path.join(root, '.tmp/verification-telemetry/plans', `${suite}.json`), plan)
  }
}

export async function loadBaselineSuitePlan(suite: string, tasks: SuiteTask[], options: { filtered?: boolean, root?: string, env?: NodeJS.ProcessEnv } = {}) {
  if ((options.env ?? process.env).WEAPP_VITE_VERIFICATION_TELEMETRY !== '1' || !suites.has(suite)) {
    return undefined
  }
  if (options.filtered) {
    throw new Error('Formal baseline telemetry cannot record an ad-hoc suite selection')
  }
  const plan = verificationPlanSchema.parse(JSON.parse(await fs.readFile(path.join(options.root ?? ACCEPTANCE_ROOT, '.tmp/verification-telemetry/plans', `${suite}.json`), 'utf8')))
  assertVerificationPlan(plan, { suite, tasks, profile: currentVerificationProfile(suite, options.env), identity: createVerificationIdentity(options.env) })
  return plan
}

/** 保留原报告，另存严格分片证据；单分片当场复验聚合，多分片由收集端完整复验。 */
export async function writeBaselineSuiteTelemetry(plan: VerificationPlan, report: SuiteReportPayload, shardIndex: number, assignedLabels: string[], root = ACCEPTANCE_ROOT) {
  assertVerificationPlan(plan)
  const assigned = plan.tasks.filter(task => !task.outOfScopeReason && task.shardIndex === shardIndex)
  if (verificationHash([...assignedLabels].sort()) !== verificationHash(assigned.map(task => task.label).sort())
    || !report.execution || report.commitSha !== plan.commitSha || report.runId !== plan.runId
    || report.execution.status !== 'passed') {
    throw new Error('Baseline suite execution differs from its frozen legacy assignment')
  }
  const tasks = report.tasks.filter(task => assignedLabels.includes(task.label))
  const shard: SuiteReportPayload = {
    ...report,
    coverage: 'partial',
    acceptance: 'incomplete',
    tasks,
    summary: { artifactCount: tasks.reduce((count, task) => count + task.artifacts.length, 0), failedCount: 0, passedCount: tasks.length, taskCount: tasks.length, plannedCount: tasks.length, executedCount: tasks.length, blockedCount: 0, skippedCount: 0, notExecutedCount: 0, outOfScopeCount: 0 },
    execution: { ...report.execution, scope: 'shard', planHash: plan.planHash, shardIndex, shardTotal: plan.shardTotal, assignedTasks: assignedLabels },
  }
  const output = path.join(root, '.tmp/verification-telemetry/suite')
  await writeJson(path.join(output, 'plan.json'), plan)
  await writeJson(path.join(output, 'shard.json'), shard)
  await fs.copyFile(path.join(root, '.tmp/build-artifact-manifest.json'), path.join(output, 'toolchain.json'))
  if (plan.shardTotal === 1) {
    const files = tasks.flatMap(task => task.artifacts.filter(artifact => artifact.kind === 'dom-acceptance-report').map(artifact => path.resolve(root, artifact.indexPath)))
    const aggregate = await aggregateVerificationReports(plan, [shard], { reportsRoot: root, files })
    await writeJson(path.join(output, 'report.json'), aggregate)
  }
}
