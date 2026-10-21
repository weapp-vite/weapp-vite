import type { DurationHistory, VerificationProfile } from './types'
import { assertVerificationProfile } from './profile'
import { VERIFICATION_TOOL_VERSION } from './types'
import { historyReceiptSchema, verificationSuiteReportSchema } from './validation'

export interface TrustedHistoryInput {
  receipt: unknown
  reports: unknown[]
}

/** receipt 必须由可信默认分支工作流核验 GitHub run 元数据后生成，候选报告不能自行授权来源。 */
export function collectDurationHistory(inputs: TrustedHistoryInput[], options: {
  profile: VerificationProfile
  repository: string
  workflow: string
  now?: Date
  maxAgeDays?: number
  maxSamples?: number
}): DurationHistory {
  const now = options.now ?? new Date()
  const oldest = now.getTime() - (options.maxAgeDays ?? 30) * 86_400_000
  const samples = new Map<string, Array<{ durationMs: number, source: string, recordedAt: number }>>()
  const seenRuns = new Set<string>()
  for (const input of inputs) {
    const receipt = historyReceiptSchema.parse(input.receipt)
    if (receipt.repository !== options.repository || receipt.workflow !== options.workflow || receipt.headBranch !== receipt.defaultBranch) {
      throw new Error('Duration history is not from the expected successful default-branch workflow')
    }
    const source = `${receipt.repository}/actions/runs/${receipt.runId}/attempts/${receipt.runAttempt}`
    if (seenRuns.has(source)) {
      throw new Error('Duplicate duration-history run receipt')
    }
    seenRuns.add(source)
    const seenTasks = new Set<string>()
    for (const value of input.reports) {
      const parsed = verificationSuiteReportSchema.safeParse(value)
      if (!parsed.success) {
        continue
      }
      const report = parsed.data
      try {
        assertVerificationProfile(options.profile, report.execution.profile)
      }
      catch {
        continue
      }
      if (report.commitSha !== receipt.headSha || report.workingTreeDirty !== false || report.coverage !== 'complete'
        || report.acceptance !== 'passed' || report.execution.scope !== 'full' || report.execution.status !== 'passed') {
        continue
      }
      const recordedAt = Date.parse(report.execution.finishedAt)
      if (recordedAt < oldest || recordedAt > now.getTime() || Date.parse(report.execution.startedAt) > recordedAt) {
        continue
      }
      const assigned = report.execution.assignedTasks
      const actual = report.tasks.filter(task => task.status !== 'out-of-scope')
      if (!assigned.length || new Set(assigned).size !== assigned.length || actual.length !== assigned.length
        || new Set(actual.map(task => task.label)).size !== actual.length
        || actual.some(task => !assigned.includes(task.label) || task.status !== 'passed' || task.exitCode !== 0 || task.durationMs <= 0)) {
        throw new Error('Invalid complete duration-history task inventory')
      }
      for (const task of actual) {
        if (seenTasks.has(task.label)) {
          throw new Error('Duplicate duration-history task in one trusted run')
        }
        seenTasks.add(task.label)
        const entries = samples.get(task.label) ?? []
        entries.push({ durationMs: task.durationMs, source, recordedAt })
        samples.set(task.label, entries)
      }
    }
  }
  return {
    schemaVersion: 1,
    toolVersion: VERIFICATION_TOOL_VERSION,
    profile: options.profile,
    generatedAt: now.toISOString(),
    tasks: Object.fromEntries([...samples].sort(([left], [right]) => left.localeCompare(right)).map(([label, entries]) => {
      const selected = entries.sort((left, right) => right.recordedAt - left.recordedAt).slice(0, options.maxSamples ?? 10)
      const durations = selected.map(entry => entry.durationMs).sort((left, right) => left - right)
      const middle = Math.floor(durations.length / 2)
      const durationMs = durations.length % 2 ? durations[middle]! : (durations[middle - 1]! + durations[middle]!) / 2
      return [label, { durationMs, samples: selected.length, sources: selected.map(entry => entry.source) }]
    })),
  }
}
