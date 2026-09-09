import type { AcceptanceIdentity, AcceptanceStatus } from './domAcceptanceReport/types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createAcceptanceIdentity, sanitizeAcceptanceValue } from './domAcceptanceReport/helpers'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const REPORTS_ROOT_DIR = path.join(ROOT_DIR, 'docs/reports')
const NON_FILE_STEM_PATTERN = /[^\w.-]+/g
const MULTI_DASH_PATTERN = /-+/g
const EDGE_DASH_PATTERN = /^-|-$/g

export interface SuiteTaskArtifact {
  indexPath: string
  kind: 'ide-warning-report' | 'suite-report' | 'dom-acceptance-report'
}

export interface SuiteTaskReportEntry {
  artifacts: SuiteTaskArtifact[]
  durationMs: number
  exitCode: number
  label: string
  status?: AcceptanceStatus | 'out-of-scope'
  reason?: string
}

export interface SuiteReportContext extends AcceptanceIdentity {
  partial: boolean
  strict: boolean
  plannedTasks: Array<{ label: string, outOfScopeReason?: string }>
}

export interface SuiteReportPayload {
  generatedAt: string
  jsonFile: string
  markdownFile: string
  reportDir: string
  reportSlug: string
  suiteName: string
  runId: string
  commitSha: string
  workingTreeDirty: boolean | null
  strict: boolean
  coverage: 'complete' | 'partial'
  acceptance: 'passed' | 'incomplete' | 'failed'
  summary: {
    artifactCount: number
    failedCount: number
    passedCount: number
    taskCount: number
    plannedCount: number
    executedCount: number
    blockedCount: number
    skippedCount: number
    notExecutedCount: number
    outOfScopeCount: number
  }
  tasks: SuiteTaskReportEntry[]
}

function normalizeSlash(value: string) {
  return value.replaceAll('\\', '/')
}

function padNumber(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateParts(now = new Date()) {
  const year = now.getFullYear()
  const month = padNumber(now.getMonth() + 1)
  const day = padNumber(now.getDate())
  const hour = padNumber(now.getHours())
  const minute = padNumber(now.getMinutes())
  const second = padNumber(now.getSeconds())

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}${minute}${second}`,
  }
}

function sanitizeFileStem(value: string) {
  return value
    .replace(NON_FILE_STEM_PATTERN, '-')
    .replace(MULTI_DASH_PATTERN, '-')
    .replace(EDGE_DASH_PATTERN, '')
    || 'suite'
}

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(1)}s`
}

function toAbsoluteReportPath(targetPath: string) {
  if (path.isAbsolute(targetPath)) {
    return targetPath
  }
  return path.resolve(ROOT_DIR, targetPath)
}

function toRepoRelativePath(targetPath: string) {
  const relative = normalizeSlash(path.relative(ROOT_DIR, toAbsoluteReportPath(targetPath)))
  if (!relative || relative.startsWith('..')) {
    return `<external>/${path.basename(targetPath)}`
  }
  return relative
}

function renderRelativeMarkdownLink(reportDir: string, targetPath: string) {
  if (targetPath.startsWith('<external>/')) {
    return `\`${targetPath}\``
  }
  const absolute = toAbsoluteReportPath(targetPath)
  const relative = normalizeSlash(path.relative(toAbsoluteReportPath(reportDir), absolute))
  return `[${path.basename(targetPath)}](./${relative})`
}

function renderSuiteReportMarkdown(payload: SuiteReportPayload) {
  const lines = [
    `# ${payload.suiteName} 汇总报告`,
    '',
    `- 生成时间：\`${payload.generatedAt}\``,
    `- Run：\`${payload.runId}\`，提交：\`${payload.commitSha}\``,
    `- 工作区未提交变更：\`${payload.workingTreeDirty ?? 'unknown'}\``,
    `- 覆盖：\`${payload.coverage}\`，验收：\`${payload.acceptance}\`，严格模式：\`${payload.strict}\``,
    `- 计划/执行：\`${payload.summary.plannedCount}/${payload.summary.executedCount}\`，范围外：\`${payload.summary.outOfScopeCount}\``,
    `- 阻塞/跳过/未执行：\`${payload.summary.blockedCount}/${payload.summary.skippedCount}/${payload.summary.notExecutedCount}\``,
    `- 任务通过：\`${payload.summary.passedCount}/${payload.summary.taskCount}\``,
    `- 失败任务：\`${payload.summary.failedCount}\``,
    `- 子报告：\`${payload.summary.artifactCount}\``,
    '',
    '## 1. 失败任务',
    '',
  ]

  const failedTasks = payload.tasks.filter(task => task.status === 'failed' || task.status === 'blocked')
  if (failedTasks.length === 0) {
    lines.push('- 无失败任务。')
    lines.push('')
  }
  else {
    for (const task of failedTasks) {
      lines.push(`- ${task.label}：exit \`${task.exitCode}\`，耗时 \`${formatDuration(task.durationMs)}\``)
      if (task.artifacts.length === 0) {
        lines.push('  - 无子报告。')
      }
      else {
        for (const artifact of task.artifacts) {
          lines.push(`  - ${artifact.kind}：${renderRelativeMarkdownLink(payload.reportDir, artifact.indexPath)}`)
        }
      }
    }
    lines.push('')
  }

  lines.push('## 2. 全部任务')
  lines.push('')
  for (const task of payload.tasks) {
    const status = task.status ?? (task.exitCode === 0 ? 'passed' : 'failed')
    lines.push(`- [${status}] ${task.label}：exit \`${task.exitCode}\`，耗时 \`${formatDuration(task.durationMs)}\``)
    if (task.reason) {
      lines.push(`  - ${task.reason}`)
    }
    if (task.artifacts.length === 0) {
      lines.push('  - 无子报告。')
      continue
    }
    for (const artifact of task.artifacts) {
      lines.push(`  - ${artifact.kind}：${renderRelativeMarkdownLink(payload.reportDir, artifact.indexPath)}`)
    }
  }
  lines.push('')

  return `${lines.join('\n')}\n`
}

export function createSuiteReport(
  taskResults: SuiteTaskReportEntry[],
  suiteName: string,
  now = new Date(),
  reportsRootDir = REPORTS_ROOT_DIR,
  context: SuiteReportContext = { ...createAcceptanceIdentity(), strict: false, partial: false, plannedTasks: taskResults },
) {
  const { date, time } = formatDateParts(now)
  const reportSlug = `${date}-${time}-${sanitizeFileStem(suiteName)}-${randomUUID().slice(0, 8)}-suite-report`
  const reportDir = path.join(reportsRootDir, reportSlug)
  const markdownFile = 'index.md'
  const jsonFile = 'index.json'

  fs.mkdirSync(reportDir, { recursive: true })

  const resultsByLabel = new Map(taskResults.map(task => [task.label, task]))
  const tasks: SuiteTaskReportEntry[] = context.plannedTasks.map((task) => {
    if (task.outOfScopeReason) {
      return { label: task.label, status: 'out-of-scope', reason: task.outOfScopeReason, artifacts: [], durationMs: 0, exitCode: 0 }
    }
    const result = resultsByLabel.get(task.label)
    return result
      ? { ...result, status: result.status ?? (result.exitCode === 0 ? 'passed' : 'failed') }
      : { label: task.label, status: 'not-executed', reason: 'Task was not executed in this run', artifacts: [], durationMs: 0, exitCode: 1 }
  })
  const hasIncomplete = tasks.some(task => task.status !== 'passed' && task.status !== 'out-of-scope')
  const payload: SuiteReportPayload = {
    generatedAt: now.toISOString(),
    suiteName,
    runId: context.runId,
    commitSha: context.commitSha,
    workingTreeDirty: context.workingTreeDirty ?? null,
    strict: context.strict,
    coverage: context.partial || tasks.some(task => task.status === 'not-executed') ? 'partial' : 'complete',
    acceptance: tasks.some(task => task.status === 'failed') ? 'failed' : hasIncomplete || context.partial || !taskResults.length ? 'incomplete' : 'passed',
    reportSlug,
    reportDir,
    markdownFile,
    jsonFile,
    summary: {
      taskCount: tasks.length,
      plannedCount: tasks.filter(task => task.status !== 'out-of-scope').length,
      executedCount: taskResults.length,
      failedCount: tasks.filter(task => task.status === 'failed').length,
      passedCount: tasks.filter(task => task.status === 'passed').length,
      blockedCount: tasks.filter(task => task.status === 'blocked').length,
      skippedCount: tasks.filter(task => task.status === 'skipped').length,
      notExecutedCount: tasks.filter(task => task.status === 'not-executed').length,
      outOfScopeCount: tasks.filter(task => task.status === 'out-of-scope').length,
      artifactCount: taskResults.reduce((count, task) => count + task.artifacts.length, 0),
    },
    tasks: tasks.map(task => ({
      ...task,
      artifacts: task.artifacts.map(artifact => ({
        ...artifact,
        indexPath: toRepoRelativePath(artifact.indexPath),
      })),
    })),
  }

  fs.writeFileSync(
    path.join(reportDir, markdownFile),
    renderSuiteReportMarkdown(sanitizeAcceptanceValue(payload)),
    'utf8',
  )
  fs.writeFileSync(
    path.join(reportDir, jsonFile),
    `${JSON.stringify(sanitizeAcceptanceValue({
      ...payload,
      reportDir: toRepoRelativePath(payload.reportDir),
    }), null, 2)}\n`,
    'utf8',
  )

  return payload
}
