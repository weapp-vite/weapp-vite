import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const REPORTS_ROOT_DIR = path.join(ROOT_DIR, 'docs/reports')
const REPORT_META_FILE = path.resolve('/tmp', 'weapp-vite-e2e-ide-warning-report-paths.json')
const EVENT_LOG_FILE_ENV = 'WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE'
const REPORT_MARKDOWN_FILE_ENV = 'WEAPP_VITE_E2E_IDE_WARNING_REPORT_MD_FILE'
const REPORT_JSON_FILE_ENV = 'WEAPP_VITE_E2E_IDE_WARNING_REPORT_JSON_FILE'
const REPORT_SLUG_ENV = 'WEAPP_VITE_E2E_IDE_WARNING_REPORT_SLUG'
const REPORT_DIR_ENV = 'WEAPP_VITE_E2E_IDE_WARNING_REPORT_DIR'
const TYPE_UNCOMPATIBLE_PATTERN = /received type-uncompatible value:\s*expected <([^>]+)>\s*but (g(?:et|ot) .+)$/i
const ANSI_ESCAPE_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B-\u001F\u007F]/g
const ABSOLUTE_PATH_PATTERN = /(?:[A-Za-z]:[\\/][^\s"'`<>()[\]{}]+|\/(?:Users|tmp|var|private|opt|home)\/[^\s"'`<>()[\]{}]+)/g

export type IdeReportSource = 'build' | 'runtime'
export type IdeReportKind = 'message' | 'stats'
export type IdeReportLevel = 'warn' | 'error' | 'exception'

export interface IdeWarningReportPaths {
  reportSlug: string
  reportDir: string
  eventLogPath: string
  reportMarkdownPath: string
  reportJsonPath: string
}

export interface IdeReportEvent {
  source: IdeReportSource
  kind: IdeReportKind
  project: string
  level?: IdeReportLevel
  channel?: string
  label?: string
  text?: string
  warn?: number
  error?: number
  exception?: number
  total?: number
  exit?: number
}

interface IssueGroup {
  source: IdeReportSource
  channel: string
  level: IdeReportLevel
  message: string
  count: number
  rawLines: string[]
}

interface TypeUncompatibleGroup {
  source: IdeReportSource
  channel: string
  level: IdeReportLevel
  message: string
  expectedType: string
  actualValue: string
  count: number
  rawLines: string[]
}

interface BuildStatsSample {
  label: string
  warn: number
  error: number
  exit: number
}

interface RuntimeStatsSample {
  warn: number
  error: number
  exception: number
  total: number
}

interface ProjectReportSummary {
  buildWarn: number
  buildError: number
  runtimeWarn: number
  runtimeError: number
  runtimeException: number
  totalIssues: number
  typeUncompatibleCount: number
}

export interface ProjectReportPayload {
  generatedAt: string
  command: string
  project: string
  markdownFile: string
  jsonFile: string
  summary: ProjectReportSummary
  buildStatsSamples: BuildStatsSample[]
  runtimeStatsSamples: RuntimeStatsSample[]
  issues: IssueGroup[]
  typeUncompatibleIssues: TypeUncompatibleGroup[]
}

export interface IdeReportIndexProject {
  project: string
  markdownFile: string
  jsonFile: string
  summary: ProjectReportSummary
}

export interface IdeReportIndexPayload {
  generatedAt: string
  command: string
  reportSlug: string
  markdownFile: string
  jsonFile: string
  summary: {
    projectCount: number
    buildWarn: number
    buildError: number
    runtimeWarn: number
    runtimeError: number
    runtimeException: number
    totalIssues: number
    typeUncompatibleCount: number
  }
  projects: IdeReportIndexProject[]
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
    timestamp: `${year}${month}${day}-${hour}${minute}${second}`,
  }
}

function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function resetFile(filePath: string) {
  ensureParentDir(filePath)
  fs.writeFileSync(filePath, '', 'utf8')
}

function writeReportMetaFile(paths: IdeWarningReportPaths) {
  ensureParentDir(REPORT_META_FILE)
  fs.writeFileSync(REPORT_META_FILE, `${JSON.stringify(paths, null, 2)}\n`, 'utf8')
}

function readReportMetaFile(): IdeWarningReportPaths | null {
  try {
    const raw = fs.readFileSync(REPORT_META_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<IdeWarningReportPaths>
    if (
      typeof parsed.reportSlug !== 'string'
      || typeof parsed.reportDir !== 'string'
      || typeof parsed.eventLogPath !== 'string'
      || typeof parsed.reportMarkdownPath !== 'string'
      || typeof parsed.reportJsonPath !== 'string'
    ) {
      return null
    }

    return {
      reportSlug: parsed.reportSlug,
      reportDir: parsed.reportDir,
      eventLogPath: parsed.eventLogPath,
      reportMarkdownPath: parsed.reportMarkdownPath,
      reportJsonPath: parsed.reportJsonPath,
    }
  }
  catch {
    return null
  }
}

function normalizeSlash(value: string) {
  return value.replaceAll('\\', '/')
}

function toRepoRelativePath(targetPath: string) {
  const absolute = path.resolve(targetPath)
  const relative = normalizeSlash(path.relative(ROOT_DIR, absolute))
  if (!relative || relative.startsWith('..')) {
    return path.basename(absolute)
  }
  return relative
}

function renderRelativeMarkdownLink(label: string, targetPath: string) {
  return `[${label}](./${normalizeSlash(path.basename(targetPath))})`
}

function sanitizeCommandArg(arg: string) {
  if (!arg) {
    return arg
  }

  const normalized = normalizeSlash(arg)
  if (!path.isAbsolute(arg)) {
    return normalized
  }

  const relative = normalizeSlash(path.relative(ROOT_DIR, arg))
  if (relative && !relative.startsWith('..')) {
    return relative
  }

  const base = path.basename(arg)
  if (base === 'node' || base === 'node.exe') {
    return 'node'
  }

  return base
}

function sanitizeReportText(value: string) {
  return normalizeSlash(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' | ')
    .replace(CONTROL_CHAR_PATTERN, ' ')
    .replace(ABSOLUTE_PATH_PATTERN, candidate => sanitizeCommandArg(candidate))
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function sanitizeCommand(argv = process.argv) {
  return argv.map(sanitizeCommandArg).join(' ')
}

function createProjectFileStem(project: string) {
  return project
    .replace(/[\\/]+/g, '__')
    .replace(/[^a-zA-Z0-9_.-]/g, '-')
}

function sortIssues(left: IssueGroup, right: IssueGroup) {
  if (right.count !== left.count) {
    return right.count - left.count
  }
  return left.message.localeCompare(right.message)
}

function readReportEvents(paths: IdeWarningReportPaths) {
  if (!fs.existsSync(paths.eventLogPath)) {
    return [] as IdeReportEvent[]
  }

  const lines = fs.readFileSync(paths.eventLogPath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const events: IdeReportEvent[] = []
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as IdeReportEvent
      if (
        parsed
        && typeof parsed === 'object'
        && typeof parsed.source === 'string'
        && typeof parsed.kind === 'string'
        && typeof parsed.project === 'string'
      ) {
        events.push({
          ...parsed,
          project: sanitizeReportText(parsed.project) || '<unknown-project>',
          channel: typeof parsed.channel === 'string' ? sanitizeReportText(parsed.channel) : parsed.channel,
          label: typeof parsed.label === 'string' ? sanitizeReportText(parsed.label) : parsed.label,
          text: typeof parsed.text === 'string' ? sanitizeReportText(parsed.text) : parsed.text,
        })
      }
    }
    catch {
      // Ignore malformed lines from aborted runs.
    }
  }
  return events
}

function renderProjectMarkdown(payload: ProjectReportPayload) {
  const lines: string[] = [
    `# IDE Warning/Error 项目报告：${payload.project}`,
    '',
    '## 1. 汇总',
    '',
    `- 命令：\`${payload.command}\``,
    `- build warn/error：\`${payload.summary.buildWarn}/${payload.summary.buildError}\``,
    `- runtime warn/error/exception：\`${payload.summary.runtimeWarn}/${payload.summary.runtimeError}/${payload.summary.runtimeException}\``,
    `- 总问题数：\`${payload.summary.totalIssues}\``,
    `- type-uncompatible 命中数：\`${payload.summary.typeUncompatibleCount}\``,
    '',
    '## 2. 所有 Warning/Error',
    '',
  ]

  if (payload.issues.length === 0) {
    lines.push('- 未采集到 warning/error/exception。')
    lines.push('')
  }
  else {
    payload.issues.forEach((issue, index) => {
      lines.push(`${index + 1}. \`${issue.count}\` 次：\`[${issue.source}/${issue.channel}/${issue.level}] ${issue.message}\``)
      lines.push(`   - 示例原始行：\`${issue.rawLines[0]}\``)
      lines.push('')
    })
  }

  lines.push('## 3. Type-Uncompatible 子集')
  lines.push('')
  if (payload.typeUncompatibleIssues.length === 0) {
    lines.push('- 未命中 `received type-uncompatible value`。')
    lines.push('')
  }
  else {
    payload.typeUncompatibleIssues.forEach((issue, index) => {
      lines.push(`${index + 1}. \`${issue.count}\` 次：\`${issue.message}\``)
      lines.push(`   - expected: \`${issue.expectedType}\``)
      lines.push(`   - actual: \`${issue.actualValue}\``)
      lines.push(`   - 示例原始行：\`${issue.rawLines[0]}\``)
      lines.push('')
    })
  }

  lines.push('## 4. Build Stats 样本')
  lines.push('')
  if (payload.buildStatsSamples.length === 0) {
    lines.push('- 未采集到 build stats。')
    lines.push('')
  }
  else {
    payload.buildStatsSamples.forEach((sample, index) => {
      lines.push(`${index + 1}. \`${sample.label}\` -> warn=${sample.warn} error=${sample.error} exit=${sample.exit}`)
    })
    lines.push('')
  }

  lines.push('## 5. Runtime Stats 样本')
  lines.push('')
  if (payload.runtimeStatsSamples.length === 0) {
    lines.push('- 未采集到 runtime stats。')
    lines.push('')
  }
  else {
    payload.runtimeStatsSamples.forEach((sample, index) => {
      lines.push(`${index + 1}. \`warn=${sample.warn} error=${sample.error} exception=${sample.exception} total=${sample.total}\``)
    })
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function renderIndexMarkdown(payload: IdeReportIndexPayload) {
  const lines: string[] = [
    `# IDE Warning/Error 总报告（${payload.generatedAt}）`,
    '',
    '## 1. 输入与范围',
    '',
    `- 命令：\`${payload.command}\``,
    `- 报告目录：\`${payload.reportSlug}/\``,
    '',
    '## 2. 总览',
    '',
    `- 项目数：\`${payload.summary.projectCount}\``,
    `- build warn/error：\`${payload.summary.buildWarn}/${payload.summary.buildError}\``,
    `- runtime warn/error/exception：\`${payload.summary.runtimeWarn}/${payload.summary.runtimeError}/${payload.summary.runtimeException}\``,
    `- 总问题数：\`${payload.summary.totalIssues}\``,
    `- type-uncompatible 命中数：\`${payload.summary.typeUncompatibleCount}\``,
    '',
    '## 3. 项目报告',
    '',
  ]

  if (payload.projects.length === 0) {
    lines.push('- 未采集到项目级 warning/error。')
    lines.push('')
  }
  else {
    payload.projects.forEach((project, index) => {
      lines.push(`${index + 1}. ${renderRelativeMarkdownLink(project.project, project.markdownFile)}`)
      lines.push(`   - build warn/error：\`${project.summary.buildWarn}/${project.summary.buildError}\``)
      lines.push(`   - runtime warn/error/exception：\`${project.summary.runtimeWarn}/${project.summary.runtimeError}/${project.summary.runtimeException}\``)
      lines.push(`   - type-uncompatible：\`${project.summary.typeUncompatibleCount}\``)
      lines.push(`   - JSON：${renderRelativeMarkdownLink(path.basename(project.jsonFile), project.jsonFile)}`)
      lines.push('')
    })
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function resolveReportProjectPath(projectPath: string | undefined) {
  if (!projectPath) {
    return '<unknown-project>'
  }
  return toRepoRelativePath(projectPath)
}

export function initializeIdeWarningReportRun(now = new Date()): IdeWarningReportPaths {
  const { date, timestamp } = formatDateParts(now)
  const reportSlug = `${date}-${timestamp.slice(-6)}-ide-warning-report`
  const reportDir = path.join(REPORTS_ROOT_DIR, reportSlug)
  const eventLogPath = path.resolve('/tmp', `weapp-vite-e2e-ide-report-${timestamp}.jsonl`)
  const reportMarkdownPath = path.join(reportDir, 'index.md')
  const reportJsonPath = path.join(reportDir, 'index.json')

  resetFile(eventLogPath)
  fs.mkdirSync(reportDir, { recursive: true })

  return {
    reportSlug,
    reportDir,
    eventLogPath,
    reportMarkdownPath,
    reportJsonPath,
  }
}

export function resolveIdeWarningReportPathsFromEnv(): IdeWarningReportPaths | null {
  const reportSlug = process.env[REPORT_SLUG_ENV]
  const reportDir = process.env[REPORT_DIR_ENV]
  const eventLogPath = process.env[EVENT_LOG_FILE_ENV]
  const reportMarkdownPath = process.env[REPORT_MARKDOWN_FILE_ENV]
  const reportJsonPath = process.env[REPORT_JSON_FILE_ENV]

  if (reportSlug && reportDir && eventLogPath && reportMarkdownPath && reportJsonPath) {
    return {
      reportSlug,
      reportDir,
      eventLogPath,
      reportMarkdownPath,
      reportJsonPath,
    }
  }

  return readReportMetaFile()
}

export function ensureIdeWarningReportEnv(now = new Date()) {
  const reportSlug = process.env[REPORT_SLUG_ENV]
  const reportDir = process.env[REPORT_DIR_ENV]
  const eventLogPath = process.env[EVENT_LOG_FILE_ENV]
  const reportMarkdownPath = process.env[REPORT_MARKDOWN_FILE_ENV]
  const reportJsonPath = process.env[REPORT_JSON_FILE_ENV]

  if (reportSlug && reportDir && eventLogPath && reportMarkdownPath && reportJsonPath) {
    const existing = resolveIdeWarningReportPathsFromEnv()
    if (existing) {
      return existing
    }
  }

  const paths = initializeIdeWarningReportRun(now)
  process.env[EVENT_LOG_FILE_ENV] = paths.eventLogPath
  process.env[REPORT_MARKDOWN_FILE_ENV] = paths.reportMarkdownPath
  process.env[REPORT_JSON_FILE_ENV] = paths.reportJsonPath
  process.env[REPORT_SLUG_ENV] = paths.reportSlug
  process.env[REPORT_DIR_ENV] = paths.reportDir
  writeReportMetaFile(paths)
  return paths
}

export function clearRuntimeWarningLog(eventLogPath: string) {
  resetFile(eventLogPath)
}

export function appendIdeReportEvent(event: IdeReportEvent) {
  const paths = resolveIdeWarningReportPathsFromEnv()
  if (!paths) {
    return
  }

  const sanitizedEvent: IdeReportEvent = {
    ...event,
    project: sanitizeReportText(event.project) || '<unknown-project>',
    channel: typeof event.channel === 'string' ? sanitizeReportText(event.channel) : event.channel,
    label: typeof event.label === 'string' ? sanitizeReportText(event.label) : event.label,
    text: typeof event.text === 'string' ? sanitizeReportText(event.text) : event.text,
  }

  ensureParentDir(paths.eventLogPath)
  fs.appendFileSync(paths.eventLogPath, `${JSON.stringify(sanitizedEvent)}\n`, 'utf8')
}

function createEmptyProjectSummary(): ProjectReportSummary {
  return {
    buildWarn: 0,
    buildError: 0,
    runtimeWarn: 0,
    runtimeError: 0,
    runtimeException: 0,
    totalIssues: 0,
    typeUncompatibleCount: 0,
  }
}

function buildProjectReports(paths: IdeWarningReportPaths, events: IdeReportEvent[], now = new Date()) {
  const projectMap = new Map<string, {
    project: string
    summary: ProjectReportSummary
    buildStatsSamples: BuildStatsSample[]
    runtimeStatsSamples: RuntimeStatsSample[]
    issues: Map<string, IssueGroup>
    typeUncompatibleIssues: Map<string, TypeUncompatibleGroup>
  }>()

  for (const event of events) {
    const project = event.project || '<unknown-project>'
    let projectState = projectMap.get(project)
    if (!projectState) {
      projectState = {
        project,
        summary: createEmptyProjectSummary(),
        buildStatsSamples: [],
        runtimeStatsSamples: [],
        issues: new Map(),
        typeUncompatibleIssues: new Map(),
      }
      projectMap.set(project, projectState)
    }

    if (event.kind === 'stats') {
      if (event.source === 'build') {
        projectState.buildStatsSamples.push({
          label: event.label || '<unknown-label>',
          warn: event.warn ?? 0,
          error: event.error ?? 0,
          exit: event.exit ?? 1,
        })
      }
      else {
        projectState.runtimeStatsSamples.push({
          warn: event.warn ?? 0,
          error: event.error ?? 0,
          exception: event.exception ?? 0,
          total: event.total ?? 0,
        })
      }
      continue
    }

    if (!event.level || !event.text) {
      continue
    }

    const channel = event.channel || event.source
    const rawLine = `[${event.level}] [${event.source}:${channel}] ${event.text}`
    const issueKey = `${event.source}|${channel}|${event.level}|${event.text}`
    const existingIssue = projectState.issues.get(issueKey)
    if (existingIssue) {
      existingIssue.count += 1
      existingIssue.rawLines.push(rawLine)
    }
    else {
      projectState.issues.set(issueKey, {
        source: event.source,
        channel,
        level: event.level,
        message: event.text,
        count: 1,
        rawLines: [rawLine],
      })
    }

    projectState.summary.totalIssues += 1
    if (event.source === 'build') {
      if (event.level === 'warn') {
        projectState.summary.buildWarn += 1
      }
      if (event.level === 'error') {
        projectState.summary.buildError += 1
      }
    }
    else {
      if (event.level === 'warn') {
        projectState.summary.runtimeWarn += 1
      }
      if (event.level === 'error') {
        projectState.summary.runtimeError += 1
      }
      if (event.level === 'exception') {
        projectState.summary.runtimeException += 1
      }
    }

    const typeUncompatibleMatched = event.text.match(TYPE_UNCOMPATIBLE_PATTERN)
    if (!typeUncompatibleMatched) {
      continue
    }

    projectState.summary.typeUncompatibleCount += 1
    const typeKey = `${event.source}|${channel}|${event.level}|${event.text}`
    const existingType = projectState.typeUncompatibleIssues.get(typeKey)
    if (existingType) {
      existingType.count += 1
      existingType.rawLines.push(rawLine)
      continue
    }
    projectState.typeUncompatibleIssues.set(typeKey, {
      source: event.source,
      channel,
      level: event.level,
      message: event.text,
      expectedType: typeUncompatibleMatched[1].trim(),
      actualValue: typeUncompatibleMatched[2].trim(),
      count: 1,
      rawLines: [rawLine],
    })
  }

  const generatedAt = now.toISOString()
  const command = sanitizeCommand()
  const projects = Array.from(projectMap.values())
    .sort((left, right) => left.project.localeCompare(right.project))
    .map((projectState) => {
      const fileStem = createProjectFileStem(projectState.project)
      const markdownFile = `${fileStem}.md`
      const jsonFile = `${fileStem}.json`
      const payload: ProjectReportPayload = {
        generatedAt,
        command,
        project: projectState.project,
        markdownFile,
        jsonFile,
        summary: projectState.summary,
        buildStatsSamples: projectState.buildStatsSamples,
        runtimeStatsSamples: projectState.runtimeStatsSamples,
        issues: Array.from(projectState.issues.values()).sort(sortIssues),
        typeUncompatibleIssues: Array.from(projectState.typeUncompatibleIssues.values()).sort((left, right) => {
          if (right.count !== left.count) {
            return right.count - left.count
          }
          return left.message.localeCompare(right.message)
        }),
      }
      fs.writeFileSync(path.join(paths.reportDir, markdownFile), renderProjectMarkdown(payload), 'utf8')
      fs.writeFileSync(path.join(paths.reportDir, jsonFile), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
      return payload
    })

  const indexPayload: IdeReportIndexPayload = {
    generatedAt,
    command,
    reportSlug: paths.reportSlug,
    markdownFile: path.basename(paths.reportMarkdownPath),
    jsonFile: path.basename(paths.reportJsonPath),
    summary: projects.reduce(
      (summary, project) => {
        summary.projectCount += 1
        summary.buildWarn += project.summary.buildWarn
        summary.buildError += project.summary.buildError
        summary.runtimeWarn += project.summary.runtimeWarn
        summary.runtimeError += project.summary.runtimeError
        summary.runtimeException += project.summary.runtimeException
        summary.totalIssues += project.summary.totalIssues
        summary.typeUncompatibleCount += project.summary.typeUncompatibleCount
        return summary
      },
      {
        projectCount: 0,
        buildWarn: 0,
        buildError: 0,
        runtimeWarn: 0,
        runtimeError: 0,
        runtimeException: 0,
        totalIssues: 0,
        typeUncompatibleCount: 0,
      },
    ),
    projects: projects.map(project => ({
      project: project.project,
      markdownFile: project.markdownFile,
      jsonFile: project.jsonFile,
      summary: project.summary,
    })),
  }

  return indexPayload
}

export function writeIdeWarningReport(paths: IdeWarningReportPaths, now = new Date()) {
  const events = readReportEvents(paths)
  const indexPayload = buildProjectReports(paths, events, now)

  fs.writeFileSync(paths.reportJsonPath, `${JSON.stringify(indexPayload, null, 2)}\n`, 'utf8')
  fs.writeFileSync(paths.reportMarkdownPath, renderIndexMarkdown(indexPayload), 'utf8')
  process.stdout.write(
    `[ide-warning-report] index=${toRepoRelativePath(paths.reportMarkdownPath)} projects=${indexPayload.summary.projectCount} issues=${indexPayload.summary.totalIssues}\n`,
  )

  return indexPayload
}
