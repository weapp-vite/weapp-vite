import type { SpawnOptions } from 'node:child_process'
import type { SuiteTaskArtifact } from './suiteReport'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { createSuiteReport } from './suiteReport'

const REPORT_MARKER_ENV = 'WEAPP_VITE_E2E_REPORT_MARKERS'

export interface SuiteTask {
  artifacts?: SuiteTaskArtifact[]
  env?: Record<string, string>
  label: string
  command: string
  args: string[]
}

export interface SuiteTaskResult {
  artifacts: SuiteTaskArtifact[]
  durationMs: number
  exitCode: number
  label: string
}

interface RunSuiteOptions {
  afterAll?: () => Promise<void> | void
  beforeEachTask?: (task: SuiteTask) => Promise<void> | void
  failOnTaskFailure?: boolean
  runTask?: (task: SuiteTask) => Promise<number>
  writeReport?: boolean
}

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(1)}s`
}

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const REPORT_LINE_PATTERN = /^\[(ide-warning-report|e2e-suite-report)\]\s+index=(\S+)/
const CRLF_PATTERN = /\r\n/g
const NEWLINE_SPLIT_PATTERN = /\r?\n/

function shouldEmitReportMarkers(env = process.env) {
  return env[REPORT_MARKER_ENV] === '1'
}

function createTaskArtifactCollector() {
  const artifacts: SuiteTaskArtifact[] = []
  const seen = new Set<string>()

  function collectFromText(text: string) {
    const lines = text.split(NEWLINE_SPLIT_PATTERN)
    for (const line of lines) {
      const matched = line.match(REPORT_LINE_PATTERN)
      if (!matched) {
        continue
      }

      const kind = matched[1] as SuiteTaskArtifact['kind']
      const indexPath = path.isAbsolute(matched[2])
        ? matched[2]
        : path.resolve(ROOT_DIR, matched[2])
      const artifactKey = `${kind}:${indexPath}`
      if (seen.has(artifactKey)) {
        continue
      }
      seen.add(artifactKey)
      artifacts.push({
        kind,
        indexPath,
      })
    }
  }

  return {
    artifacts,
    collectFromText,
  }
}

function createOutputForwarder(
  write: (text: string) => void,
  collector: ReturnType<typeof createTaskArtifactCollector>,
) {
  let buffer = ''

  function handleText(text: string) {
    const normalized = (buffer + text).replace(CRLF_PATTERN, '\n')
    const lines = normalized.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      collector.collectFromText(line)
      if (!REPORT_LINE_PATTERN.test(line)) {
        write(`${line}\n`)
      }
    }
  }

  function flush() {
    if (!buffer) {
      return
    }

    collector.collectFromText(buffer)
    if (!REPORT_LINE_PATTERN.test(buffer)) {
      write(buffer)
    }
    buffer = ''
  }

  return {
    flush,
    handleText,
  }
}

export function getTaskSpawnOptions(task: SuiteTask, platform = process.platform): SpawnOptions {
  return {
    cwd: process.cwd(),
    env: {
      ...process.env,
      [REPORT_MARKER_ENV]: '1',
      ...task.env,
    },
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: platform === 'win32',
  }
}

export function formatSuiteSummary(suiteName: string, results: SuiteTaskResult[]) {
  const failures = results.filter(result => result.exitCode !== 0)
  const lines = [
    '',
    `[${suiteName}] summary ${results.length - failures.length}/${results.length} passed`,
  ]

  if (failures.length === 0) {
    lines.push(`[${suiteName}] all tasks passed`)
    return lines.join('\n')
  }

  lines.push(`[${suiteName}] failed tasks:`)
  for (const failure of failures) {
    lines.push(`[${suiteName}] - ${failure.label} (exit ${failure.exitCode}, ${formatDuration(failure.durationMs)})`)
  }
  return lines.join('\n')
}

export function formatSuiteArtifactsSummary(suiteName: string, artifacts: SuiteTaskArtifact[]) {
  const seen = new Set<string>()
  const lines = [`[${suiteName}] reports:`]

  for (const artifact of artifacts) {
    const artifactKey = `${artifact.kind}:${artifact.indexPath}`
    if (seen.has(artifactKey)) {
      continue
    }
    seen.add(artifactKey)
    lines.push(`[${suiteName}] - ${artifact.kind}: ${path.relative(ROOT_DIR, artifact.indexPath).replaceAll('\\', '/')}`)
  }

  if (lines.length === 1) {
    return ''
  }

  return lines.join('\n')
}

async function defaultRunTask(task: SuiteTask) {
  const collector = createTaskArtifactCollector()

  return await new Promise<number>((resolve, reject) => {
    const child = spawn(task.command, task.args, getTaskSpawnOptions(task))
    const stdoutForwarder = createOutputForwarder(text => process.stdout.write(text), collector)
    const stderrForwarder = createOutputForwarder(text => process.stderr.write(text), collector)

    child.stdout.on('data', (chunk) => {
      stdoutForwarder.handleText(chunk.toString())
    })

    child.stderr.on('data', (chunk) => {
      stderrForwarder.handleText(chunk.toString())
    })

    child.on('error', reject)
    child.on('close', (code) => {
      stdoutForwarder.flush()
      stderrForwarder.flush()
      task.artifacts = collector.artifacts
      resolve(code ?? 1)
    })
  })
}

export async function runTaskSuite(
  suiteName: string,
  tasks: SuiteTask[],
  options: RunSuiteOptions = {},
) {
  const failOnTaskFailure = options.failOnTaskFailure ?? true
  const runTask = options.runTask ?? defaultRunTask
  const writeReport = options.writeReport ?? true
  const results: SuiteTaskResult[] = []
  let suiteReportArtifact: SuiteTaskArtifact | undefined

  for (const task of tasks) {
    console.log(`[${suiteName}] run ${task.label}`)
    const startedAt = Date.now()
    let exitCode = 1

    try {
      await options.beforeEachTask?.(task)
      exitCode = await runTask(task)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[${suiteName}] task crashed: ${task.label}`)
      console.error(message)
    }

    const durationMs = Date.now() - startedAt
    results.push({
      artifacts: task.artifacts ?? [],
      label: task.label,
      exitCode,
      durationMs,
    })

    const status = exitCode === 0 ? 'pass' : 'fail'
    console.log(`[${suiteName}] ${status} ${task.label} (${formatDuration(durationMs)})`)
  }

  await options.afterAll?.()
  if (writeReport) {
    const report = createSuiteReport(results, suiteName)
    suiteReportArtifact = {
      kind: 'suite-report',
      indexPath: path.join(report.reportDir, report.markdownFile),
    }
    if (shouldEmitReportMarkers()) {
      process.stdout.write(
        `[e2e-suite-report] index=${path.relative(ROOT_DIR, suiteReportArtifact.indexPath).replaceAll('\\', '/')} tasks=${report.summary.taskCount} failed=${report.summary.failedCount} childReports=${report.summary.artifactCount}\n`,
      )
    }
  }
  console.log(formatSuiteSummary(suiteName, results))
  if (!shouldEmitReportMarkers()) {
    const artifactSummary = formatSuiteArtifactsSummary(
      suiteName,
      suiteReportArtifact ? [...results.flatMap(result => result.artifacts), suiteReportArtifact] : results.flatMap(result => result.artifacts),
    )
    if (artifactSummary) {
      console.log(artifactSummary)
    }
  }

  if (failOnTaskFailure && results.some(result => result.exitCode !== 0)) {
    process.exitCode = 1
    return 1
  }

  return results.some(result => result.exitCode !== 0) ? 1 : 0
}
