import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { getSuiteTasks, listE2ESuites } from './e2e-suite-manifest'
import { runTaskSuite } from './suiteRunner'

const TASK_FILTER_ENV = 'WEAPP_VITE_E2E_TASK_FILTER'
const TASK_FROM_ENV = 'WEAPP_VITE_E2E_TASK_FROM'

function isCurrentModuleEntry(entryArg: string | undefined, moduleUrl: string) {
  if (!entryArg) {
    return false
  }

  const resolvedEntryPath = path.isAbsolute(entryArg)
    ? entryArg
    : path.resolve(entryArg)

  try {
    return moduleUrl === pathToFileURL(resolvedEntryPath).href
  }
  catch {
    return false
  }
}

export function shouldCleanupIdeBeforeEachTask(mode: string) {
  return mode === 'hmr-regression' || /^ide(?:$|-|:)(?!headless)/.test(mode)
}

export function shouldStopIdeSuiteAfterTaskFailure(mode: string) {
  return shouldCleanupIdeBeforeEachTask(mode)
}

function readOption(args: string[], name: string, envName: string) {
  const prefix = `--${name}=`
  const option = args.find(arg => arg.startsWith(prefix))
  return option?.slice(prefix.length) || process.env[envName] || ''
}

function filterTasks(
  tasks: Awaited<ReturnType<typeof getSuiteTasks>>,
  options: {
    filter: string
    from: string
  },
) {
  let selectedTasks = tasks
  if (options.from) {
    const startIndex = selectedTasks.findIndex(task => task.label.includes(options.from))
    if (startIndex === -1) {
      throw new Error(`No e2e task matched --from=${options.from}`)
    }
    selectedTasks = selectedTasks.slice(startIndex)
  }
  if (options.filter) {
    selectedTasks = selectedTasks.filter(task => task.label.includes(options.filter))
  }
  return selectedTasks
}

export async function runE2ESuiteCli(args = process.argv.slice(2)) {
  const allowFailures = args.includes('--allow-failures')
  const filter = readOption(args, 'filter', TASK_FILTER_ENV)
  const from = readOption(args, 'from', TASK_FROM_ENV)
  const mode = args.find(arg => !arg.startsWith('--')) ?? 'full'

  if (mode === 'list') {
    const suites = await listE2ESuites()
    for (const suite of suites) {
      console.log(`${suite.name} (${suite.taskCount})`)
      console.log(`  ${suite.description}`)
    }
    process.exit(0)
  }

  let tasks = await getSuiteTasks(mode)

  if (tasks.length === 0) {
    console.error(`Unknown e2e suite: ${mode}`)
    console.error(`Available suites: ${(await listE2ESuites()).map(suite => suite.name).join(', ')}, list`)
    process.exitCode = 1
    return
  }
  try {
    tasks = filterTasks(tasks, { filter, from })
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
    return
  }
  if (tasks.length === 0) {
    console.error(`No e2e tasks matched filter: ${filter || '<empty>'}`)
    process.exitCode = 1
    return
  }
  if (filter || from) {
    console.log(`[e2e:${mode}] selected ${tasks.length} task(s)${from ? ` from=${from}` : ''}${filter ? ` filter=${filter}` : ''}`)
  }

  await runTaskSuite(`e2e:${mode}`, tasks, {
    beforeEachTask: shouldCleanupIdeBeforeEachTask(mode)
      ? async () => {
        await cleanupResidualIdeProcesses()
      }
      : undefined,
    afterAll: shouldCleanupIdeBeforeEachTask(mode)
      ? async () => {
        await cleanupResidualIdeProcesses()
      }
      : undefined,
    failOnTaskFailure: !allowFailures,
    stopOnTaskFailure: !allowFailures && shouldStopIdeSuiteAfterTaskFailure(mode),
  })
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await runE2ESuiteCli()
}
