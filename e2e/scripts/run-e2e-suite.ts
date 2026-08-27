import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { cleanDevtoolsCacheAndStop, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { getSuiteTasks, listE2ESuites, partitionE2ETasks } from './e2e-suite-manifest'
import { runTaskSuite } from './suiteRunner'

const TASK_FILTER_ENV = 'WEAPP_VITE_E2E_TASK_FILTER'
const TASK_FROM_ENV = 'WEAPP_VITE_E2E_TASK_FROM'
const TASK_ROLL_FROM_ENV = 'WEAPP_VITE_E2E_TASK_ROLL_FROM'
const TASK_SHARD_INDEX_ENV = 'WEAPP_VITE_E2E_SHARD_INDEX'
const TASK_SHARD_TOTAL_ENV = 'WEAPP_VITE_E2E_SHARD_TOTAL'

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

export function createIdeSuiteCleanupHooks(
  mode: string,
  cleanup: () => Promise<void> = cleanupResidualIdeProcesses,
  cleanCompileCache: () => Promise<void> = () => cleanDevtoolsCacheAndStop('compile'),
) {
  if (!shouldCleanupIdeBeforeEachTask(mode)) {
    return {}
  }

  return {
    beforeEachTask: async () => {
      await cleanup()
      await cleanCompileCache()
    },
    afterAll: cleanup,
  }
}

function readOption(args: string[], name: string, envName: string) {
  const prefix = `--${name}=`
  const option = args.find(arg => arg.startsWith(prefix))
  return option?.slice(prefix.length) || process.env[envName] || ''
}

function resolveTaskStartIndex(
  tasks: Awaited<ReturnType<typeof getSuiteTasks>>,
  value: string,
  optionName: string,
) {
  const numericValue = Number(value)
  if (Number.isInteger(numericValue)) {
    const index = numericValue <= 0 ? 0 : numericValue - 1
    if (index >= 0 && index < tasks.length) {
      return index
    }
    throw new Error(`No e2e task matched --${optionName}=${value}`)
  }

  const startIndex = tasks.findIndex(task => task.label.includes(value))
  if (startIndex === -1) {
    throw new Error(`No e2e task matched --${optionName}=${value}`)
  }
  return startIndex
}

export function orderSuiteTasks(
  tasks: Awaited<ReturnType<typeof getSuiteTasks>>,
  options: {
    filter: string
    from: string
    rollFrom: string
  },
) {
  let selectedTasks = tasks
  if (options.from) {
    const startIndex = resolveTaskStartIndex(selectedTasks, options.from, 'from')
    selectedTasks = selectedTasks.slice(startIndex)
  }
  if (options.filter) {
    selectedTasks = selectedTasks.filter(task => task.label.includes(options.filter))
  }
  if (options.rollFrom) {
    const startIndex = resolveTaskStartIndex(selectedTasks, options.rollFrom, 'roll-from')
    selectedTasks = [
      ...selectedTasks.slice(startIndex),
      ...selectedTasks.slice(0, startIndex),
    ]
  }
  return selectedTasks
}

export async function runE2ESuiteCli(args = process.argv.slice(2)) {
  const allowFailures = args.includes('--allow-failures')
  const filter = readOption(args, 'filter', TASK_FILTER_ENV)
  const from = readOption(args, 'from', TASK_FROM_ENV)
  const rollFrom = readOption(args, 'roll-from', TASK_ROLL_FROM_ENV)
  const shardIndex = readOption(args, 'shard-index', TASK_SHARD_INDEX_ENV)
  const shardTotal = readOption(args, 'shard-total', TASK_SHARD_TOTAL_ENV)
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
    tasks = orderSuiteTasks(tasks, { filter, from, rollFrom })
    if (shardIndex || shardTotal) {
      const oneBasedIndex = Number(shardIndex)
      const total = Number(shardTotal)
      if (!Number.isInteger(oneBasedIndex) || !Number.isInteger(total) || oneBasedIndex < 1 || oneBasedIndex > total) {
        throw new Error(`Invalid e2e shard: expected --shard-index=1..${total}, --shard-total=<positive integer>`)
      }
      tasks = partitionE2ETasks(tasks, { index: oneBasedIndex - 1, total })
    }
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
  const shardLabel = shardIndex && shardTotal ? ` shard=${shardIndex}/${shardTotal}` : ''
  if (filter || from || rollFrom || shardLabel) {
    console.log(`[e2e:${mode}] selected ${tasks.length} task(s)${shardLabel}${from ? ` from=${from}` : ''}${rollFrom ? ` roll-from=${rollFrom}` : ''}${filter ? ` filter=${filter}` : ''}`)
  }

  const cleanupHooks = createIdeSuiteCleanupHooks(mode)
  await runTaskSuite(`e2e:${mode}${shardLabel.replace('/', '-')}`, tasks, {
    ...cleanupHooks,
    failOnTaskFailure: !allowFailures,
    stopOnTaskFailure: !allowFailures && shouldStopIdeSuiteAfterTaskFailure(mode),
  })
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await runE2ESuiteCli()
}
