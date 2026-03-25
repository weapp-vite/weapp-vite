import type { SpawnOptions } from 'node:child_process'
import type { SuiteTaskArtifact } from './suiteReport'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { createSuiteReport } from './suiteReport'

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

export function getTaskSpawnOptions(task: SuiteTask, platform = process.platform): SpawnOptions {
  return {
    cwd: process.cwd(),
    env: {
      ...process.env,
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

async function defaultRunTask(task: SuiteTask) {
  const collector = createTaskArtifactCollector()

  return await new Promise<number>((resolve, reject) => {
    const child = spawn(task.command, task.args, getTaskSpawnOptions(task))

    let stdoutBuffer = ''
    let stderrBuffer = ''

    function consumeBufferedLines(buffer: string) {
      const normalized = buffer.replace(CRLF_PATTERN, '\n')
      const lines = normalized.split('\n')
      const remainder = lines.pop() ?? ''

      for (const line of lines) {
        collector.collectFromText(line)
      }

      return remainder
    }

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      process.stdout.write(text)
      stdoutBuffer = consumeBufferedLines(stdoutBuffer + text)
    })

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      process.stderr.write(text)
      stderrBuffer = consumeBufferedLines(stderrBuffer + text)
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (stdoutBuffer) {
        collector.collectFromText(stdoutBuffer)
      }
      if (stderrBuffer) {
        collector.collectFromText(stderrBuffer)
      }
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
  const runTask = options.runTask ?? defaultRunTask
  const writeReport = options.writeReport ?? true
  const results: SuiteTaskResult[] = []

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
    console.log(
      `[e2e-suite-report] index=${path.relative(ROOT_DIR, path.join(report.reportDir, report.markdownFile)).replaceAll('\\', '/')} tasks=${report.summary.taskCount} failed=${report.summary.failedCount} childReports=${report.summary.artifactCount}`,
    )
  }
  console.log(formatSuiteSummary(suiteName, results))

  if (results.some(result => result.exitCode !== 0)) {
    process.exitCode = 1
    return 1
  }

  return 0
}
