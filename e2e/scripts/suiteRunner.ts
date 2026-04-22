import type { SpawnOptions } from 'node:child_process'
import type { SuiteTaskArtifact } from './suiteReport'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { createSuiteReport } from './suiteReport'

const REPORT_MARKER_ENV = 'WEAPP_VITE_E2E_REPORT_MARKERS'
const DEVTOOLS_SKIP_LOGIN_CHECK_ENV = 'WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK'
const DEVTOOLS_CONFIG_BASENAME = 'vitest.e2e.devtools.config.ts'

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
const TASK_HEARTBEAT_INTERVAL_MS = 30_000
const TASK_STDIO_CLOSE_GRACE_MS = 200

function shouldEmitReportMarkers(env = process.env) {
  return env[REPORT_MARKER_ENV] === '1'
}

function isDevtoolsVitestTask(task: SuiteTask) {
  if (task.command !== 'pnpm') {
    return false
  }

  return task.args.some(arg => arg.endsWith(DEVTOOLS_CONFIG_BASENAME))
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

function startTaskHeartbeat(suiteName: string, label: string, startedAt: number) {
  const timer = setInterval(() => {
    console.log(`[${suiteName}] still running ${label} (${formatDuration(Date.now() - startedAt)})`)
  }, TASK_HEARTBEAT_INTERVAL_MS)

  return () => {
    clearInterval(timer)
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
    let exitCode: number | undefined
    let stdoutClosed = child.stdout == null
    let stderrClosed = child.stderr == null
    let stdioCloseGraceTimer: NodeJS.Timeout | undefined
    let settled = false

    function clearGraceTimer() {
      if (stdioCloseGraceTimer) {
        clearTimeout(stdioCloseGraceTimer)
        stdioCloseGraceTimer = undefined
      }
    }

    function finalize(code: number) {
      if (settled) {
        return
      }

      settled = true
      clearGraceTimer()
      stdoutForwarder.flush()
      stderrForwarder.flush()
      task.artifacts = collector.artifacts
      child.stdout?.destroy()
      child.stderr?.destroy()
      resolve(code)
    }

    function scheduleFinalize() {
      if (settled || exitCode === undefined || stdioCloseGraceTimer) {
        return
      }

      stdioCloseGraceTimer = setTimeout(() => {
        finalize(exitCode ?? 1)
      }, TASK_STDIO_CLOSE_GRACE_MS)
      stdioCloseGraceTimer.unref?.()
    }

    function maybeFinalize() {
      if (settled || exitCode === undefined) {
        return
      }

      if (stdoutClosed && stderrClosed) {
        finalize(exitCode)
        return
      }

      scheduleFinalize()
    }

    function onStdoutClose() {
      stdoutClosed = true
      maybeFinalize()
    }

    function onStderrClose() {
      stderrClosed = true
      maybeFinalize()
    }

    function onError(error: Error) {
      if (settled) {
        return
      }

      clearGraceTimer()
      reject(error)
    }

    function onExit(code: number | null) {
      exitCode = code ?? 1
      maybeFinalize()
    }

    child.stdout.on('data', (chunk) => {
      stdoutForwarder.handleText(chunk.toString())
    })

    child.stderr.on('data', (chunk) => {
      stderrForwarder.handleText(chunk.toString())
    })

    child.stdout?.on('close', onStdoutClose)
    child.stderr?.on('close', onStderrClose)
    child.on('error', onError)
    child.on('exit', onExit)
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
  let devtoolsLoginPreflightPassed = false
  let suiteReportArtifact: SuiteTaskArtifact | undefined

  for (const task of tasks) {
    console.log(`[${suiteName}] run ${task.label}`)
    const startedAt = Date.now()
    const stopHeartbeat = startTaskHeartbeat(suiteName, task.label, startedAt)
    let exitCode = 1

    try {
      if (devtoolsLoginPreflightPassed && isDevtoolsVitestTask(task)) {
        task.env = {
          ...task.env,
          [DEVTOOLS_SKIP_LOGIN_CHECK_ENV]: '1',
        }
      }
      await options.beforeEachTask?.(task)
      exitCode = await runTask(task)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[${suiteName}] task crashed: ${task.label}`)
      console.error(message)
    }
    finally {
      stopHeartbeat()
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

    if (exitCode === 0 && isDevtoolsVitestTask(task)) {
      devtoolsLoginPreflightPassed = true
    }
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
