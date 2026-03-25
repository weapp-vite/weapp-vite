import process from 'node:process'
import { execa } from 'execa'

export interface SuiteTask {
  label: string
  command: string
  args: string[]
}

export interface SuiteTaskResult {
  durationMs: number
  exitCode: number
  label: string
}

interface RunSuiteOptions {
  afterAll?: () => Promise<void> | void
  beforeEachTask?: (task: SuiteTask) => Promise<void> | void
  runTask?: (task: SuiteTask) => Promise<number>
}

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(1)}s`
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
  const result = await execa(task.command, task.args, {
    stdio: 'inherit',
    reject: false,
  })
  return result.exitCode ?? 1
}

export async function runTaskSuite(
  suiteName: string,
  tasks: SuiteTask[],
  options: RunSuiteOptions = {},
) {
  const runTask = options.runTask ?? defaultRunTask
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
      label: task.label,
      exitCode,
      durationMs,
    })

    const status = exitCode === 0 ? 'pass' : 'fail'
    console.log(`[${suiteName}] ${status} ${task.label} (${formatDuration(durationMs)})`)
  }

  await options.afterAll?.()
  console.log(formatSuiteSummary(suiteName, results))

  if (results.some(result => result.exitCode !== 0)) {
    process.exitCode = 1
    return 1
  }

  return 0
}
