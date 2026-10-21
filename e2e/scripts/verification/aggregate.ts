import type { SuiteReportPayload, SuiteTaskReportEntry } from '../suiteReport'
import type { VerificationPlan, VerificationTiming } from './types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { assertVerificationTopology } from '../../../scripts/verification/topology.ts'
import { validateTaskAcceptance } from '../domAcceptanceReport/task'
import { providerOutOfScopeCases } from '../domAcceptanceReport/taskCases'
import { assertVerificationPlan, verificationHash } from './plan'
import { assertVerificationProfile } from './profile'
import { assertE2ETimings } from './timing'
import { VERIFICATION_TOOL_VERSION } from './types'
import { verificationSuiteReportSchema } from './validation'

/** 下载的报告属于外部输入，保留可选字段兼容并在边界校验阶段耗时。 */
function readReportTimings(value: unknown): VerificationTiming[] {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new TypeError('Invalid E2E timing record')
  }
  assertE2ETimings(value)
  return value
}

export async function jsonFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? jsonFiles(path.join(root, entry.name))
    : entry.isFile() && entry.name.endsWith('.json') ? [path.join(root, entry.name)] : []))).flat().sort()
}

async function resolveArtifact(root: string, relative: string, files: string[]) {
  const normalized = relative.replaceAll('\\', '/')
  if (path.isAbsolute(relative) || /^[A-Z]:\//i.test(normalized) || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error('Verification evidence paths must remain inside the downloaded artifact directory')
  }
  const suffix = normalized.replace(/^docs\/reports\//, '')
  const matches = files.filter((file) => {
    const local = path.relative(root, file).replaceAll('\\', '/')
    return local === normalized || local.endsWith(`/${normalized}`) || local === suffix || local.endsWith(`/${suffix}`)
  })
  if (matches.length !== 1) {
    throw new Error(`Expected one downloaded evidence artifact: ${relative}; found ${matches.length}`)
  }
  return matches[0]!
}

/** 聚合逐一复验计划分配与严格 case 证据；局部报告自身不能成为全量通过。 */
export async function aggregateVerificationReports(plan: VerificationPlan, values: unknown[], options: {
  reportsRoot?: string
  files?: string[]
  now?: Date
} = {}): Promise<SuiteReportPayload> {
  assertVerificationPlan(plan)
  if (plan.workingTreeDirty !== false) {
    throw new Error('Full distributed acceptance requires a clean, known checkout')
  }
  const reports = values.map(value => verificationSuiteReportSchema.parse(value))
  const timings = reports.flatMap(report => readReportTimings(report.timings))
  assertE2ETimings([...timings, ...reports.flatMap(report => report.tasks.flatMap(task => readReportTimings(task.timings)))])
  if (reports.length !== plan.shardTotal) {
    throw new Error('Missing or duplicate verification shard reports')
  }
  const seenShards = new Set<number>()
  const seenTasks = new Set<string>()
  const seenInvocations = new Set<string>()
  const results: SuiteTaskReportEntry[] = []
  const files = options.files ?? (options.reportsRoot ? await jsonFiles(options.reportsRoot) : [])
  for (const report of reports) {
    const execution = report.execution
    assertVerificationProfile(plan.profile, execution.profile)
    assertVerificationTopology(execution.executionTopology)
    if (verificationHash(execution.executionTopology) !== verificationHash(plan.executionTopology)) {
      throw new Error('Shard verification topology mismatch')
    }
    if (report.runId !== plan.runId || report.commitSha !== plan.commitSha || report.workingTreeDirty !== false
      || report.strict !== plan.strict || execution.planHash !== plan.planHash || execution.scope !== 'shard'
      || execution.shardTotal !== plan.shardTotal || !execution.shardIndex || execution.shardIndex > plan.shardTotal
      || seenShards.has(execution.shardIndex) || execution.status !== 'passed'
      || report.coverage !== 'partial' || report.acceptance !== 'incomplete'
      || Date.parse(execution.finishedAt) < Date.parse(execution.startedAt)
      || Date.parse(execution.finishedAt) > (options.now ?? new Date()).getTime()) {
      throw new Error('Shard identity, execution status or frozen plan does not match')
    }
    seenShards.add(execution.shardIndex)
    const assigned = plan.tasks.filter(task => !task.outOfScopeReason && task.shardIndex === execution.shardIndex)
    if (JSON.stringify([...execution.assignedTasks].sort()) !== JSON.stringify(assigned.map(task => task.label).sort())
      || new Set(execution.assignedTasks).size !== execution.assignedTasks.length
      || report.tasks.length !== assigned.length || new Set(report.tasks.map(task => task.label)).size !== report.tasks.length) {
      throw new Error('Shard assigned-task inventory has omissions, duplicates or unexpected tasks')
    }
    if ((report.summary.providerOutOfScopeCaseCount ?? 0) !== assigned.reduce((sum, task) => sum + providerOutOfScopeCases(task.cases).length, 0)) {
      throw new Error('Shard provider case scope count does not match the frozen plan')
    }
    for (const task of report.tasks) {
      const planned = assigned.find(planned => planned.label === task.label)
      if (!planned || seenTasks.has(task.label) || task.definitionHash !== planned.definitionHash || task.exitCode !== 0 || task.status !== 'passed') {
        throw new Error('Shard task did not pass its frozen definition exactly once')
      }
      seenTasks.add(task.label)
      const providerCases = providerOutOfScopeCases(planned.cases)
      if (!isDeepStrictEqual(task.providerOutOfScopeCases ?? [], providerCases)) {
        throw new Error('Shard provider case scope records do not match the frozen plan')
      }
      if (plan.strict) {
        if (!options.reportsRoot || !planned.cases?.length) {
          throw new Error('Strict shard aggregation requires planned cases and downloaded evidence')
        }
        const artifacts = await Promise.all(task.artifacts.map(async artifact => ({
          ...artifact,
          indexPath: artifact.kind === 'dom-acceptance-report' ? await resolveArtifact(options.reportsRoot!, artifact.indexPath, files) : artifact.indexPath,
        })))
        for (const artifact of artifacts.filter(artifact => artifact.kind === 'dom-acceptance-report')) {
          const value: unknown = JSON.parse(await fs.readFile(artifact.indexPath, 'utf8'))
          const invocationId = value && typeof value === 'object' && 'invocationId' in value ? value.invocationId : undefined
          if (typeof invocationId !== 'string' || seenInvocations.has(invocationId)) {
            throw new Error('Duplicate or invalid DOM acceptance invocation across shards')
          }
          seenInvocations.add(invocationId)
        }
        await validateTaskAcceptance({ label: task.label, command: 'pnpm', args: [], artifacts, acceptanceTemplates: planned.acceptanceTemplates, env: { WEAPP_VITE_E2E_RUNTIME_PROVIDER: plan.profile.provider === 'headless' ? 'headless' : 'devtools' } }, plan, planned.cases)
      }
      results.push({ ...task, providerOutOfScopeCases: providerCases })
    }
  }
  const expected = plan.tasks.filter(task => !task.outOfScopeReason)
  if (seenTasks.size !== expected.length || expected.some(task => !seenTasks.has(task.label))) {
    throw new Error('Full verification task coverage is incomplete')
  }
  const startedAt = reports.map(report => report.execution.startedAt).sort()[0]!
  const finishedAt = reports.map(report => report.execution.finishedAt).sort().at(-1)!
  const tasks: SuiteTaskReportEntry[] = plan.tasks.map(task => task.outOfScopeReason
    ? { label: task.label, status: 'out-of-scope', reason: task.outOfScopeReason, durationMs: 0, exitCode: 0, artifacts: [] }
    : results.find(result => result.label === task.label)!)
  return {
    schemaVersion: 2,
    toolVersion: VERIFICATION_TOOL_VERSION,
    execution: { scope: 'full', status: 'passed', profile: plan.profile, executionTopology: plan.executionTopology, planHash: plan.planHash, assignedTasks: expected.map(task => task.label), startedAt, finishedAt },
    excludedProjects: [],
    generatedAt: (options.now ?? new Date()).toISOString(),
    jsonFile: 'aggregate.json',
    markdownFile: '',
    reportDir: '',
    reportSlug: `verification-${plan.runId}`,
    suiteName: `e2e:${plan.suite}`,
    runId: plan.runId,
    commitSha: plan.commitSha,
    workingTreeDirty: false,
    strict: plan.strict,
    coverage: 'complete',
    acceptance: 'passed',
    timings,
    tasks,
    summary: { artifactCount: tasks.reduce((sum, task) => sum + task.artifacts.length, 0), failedCount: 0, passedCount: expected.length, taskCount: tasks.length, plannedCount: expected.length, executedCount: expected.length, blockedCount: 0, skippedCount: 0, notExecutedCount: 0, outOfScopeCount: tasks.length - expected.length, providerOutOfScopeCaseCount: tasks.reduce((sum, task) => sum + (task.providerOutOfScopeCases?.length ?? 0), 0) },
  }
}
