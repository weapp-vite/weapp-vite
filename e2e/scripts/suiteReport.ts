import fs from 'node:fs'
import path from 'node:path'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const REPORTS_ROOT_DIR = path.join(ROOT_DIR, 'docs/reports')
const NON_FILE_STEM_PATTERN = /[^\w.-]+/g
const MULTI_DASH_PATTERN = /-+/g
const EDGE_DASH_PATTERN = /^-|-$/g

export interface SuiteTaskArtifact {
  indexPath: string
  kind: 'ide-warning-report' | 'suite-report'
}

export interface SuiteTaskReportEntry {
  artifacts: SuiteTaskArtifact[]
  durationMs: number
  exitCode: number
  label: string
}

export interface SuiteReportPayload {
  generatedAt: string
  jsonFile: string
  markdownFile: string
  reportDir: string
  reportSlug: string
  suiteName: string
  summary: {
    artifactCount: number
    failedCount: number
    passedCount: number
    taskCount: number
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
    return normalizeSlash(targetPath)
  }
  return relative
}

function renderRelativeMarkdownLink(reportDir: string, targetPath: string) {
  const absolute = toAbsoluteReportPath(targetPath)
  const relative = normalizeSlash(path.relative(reportDir, absolute))
  return `[${path.basename(targetPath)}](./${relative})`
}

function renderSuiteReportMarkdown(payload: SuiteReportPayload) {
  const lines = [
    `# ${payload.suiteName} 汇总报告`,
    '',
    `- 生成时间：\`${payload.generatedAt}\``,
    `- 任务通过：\`${payload.summary.passedCount}/${payload.summary.taskCount}\``,
    `- 失败任务：\`${payload.summary.failedCount}\``,
    `- 子报告：\`${payload.summary.artifactCount}\``,
    '',
    '## 1. 失败任务',
    '',
  ]

  const failedTasks = payload.tasks.filter(task => task.exitCode !== 0)
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
    const status = task.exitCode === 0 ? 'pass' : 'fail'
    lines.push(`- [${status}] ${task.label}：exit \`${task.exitCode}\`，耗时 \`${formatDuration(task.durationMs)}\``)
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
) {
  const { date, time } = formatDateParts(now)
  const reportSlug = `${date}-${time}-${sanitizeFileStem(suiteName)}-suite-report`
  const reportDir = path.join(reportsRootDir, reportSlug)
  const markdownFile = 'index.md'
  const jsonFile = 'index.json'

  fs.mkdirSync(reportDir, { recursive: true })

  const payload: SuiteReportPayload = {
    generatedAt: now.toISOString(),
    suiteName,
    reportSlug,
    reportDir,
    markdownFile,
    jsonFile,
    summary: {
      taskCount: taskResults.length,
      failedCount: taskResults.filter(task => task.exitCode !== 0).length,
      passedCount: taskResults.filter(task => task.exitCode === 0).length,
      artifactCount: taskResults.reduce((count, task) => count + task.artifacts.length, 0),
    },
    tasks: taskResults.map(task => ({
      ...task,
      artifacts: task.artifacts.map(artifact => ({
        ...artifact,
        indexPath: toRepoRelativePath(artifact.indexPath),
      })),
    })),
  }

  fs.writeFileSync(
    path.join(reportDir, markdownFile),
    renderSuiteReportMarkdown(payload),
    'utf8',
  )
  fs.writeFileSync(
    path.join(reportDir, jsonFile),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  )

  return payload
}
