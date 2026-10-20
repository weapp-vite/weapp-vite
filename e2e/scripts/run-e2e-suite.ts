import type { SuiteReportPayload } from './suiteReport'
import type { SuiteTask } from './suiteRunner'
import type { TaskLaunchHook } from './suiteRunner/launchBudget'
import type { VerificationPlan } from './verification/types'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { splitWechatDevtoolsSelectionArgs } from 'weapp-ide-cli'
import { excludedE2EProjects, isExcludedE2EProject } from '../../scripts/e2eProjectScope'
import { loadBaselineSuitePlan, writeBaselineSuiteTelemetry } from '../../scripts/verificationTelemetry/suite'
import { withWechatE2ESelectionEnvironment } from '../utils/devtoolsCli'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { createAcceptanceIdentity, isStrictDomAcceptanceSuite } from './domAcceptanceReport/helpers'
import { getSuiteTasks, listE2ESuites, partitionE2ETasks } from './e2e-suite-manifest'
import { isDevtoolsVitestTask, runTaskSuite } from './suiteRunner'
import { assertVerificationPlan, createVerificationIdentity } from './verification/plan'
import { currentVerificationProfile } from './verification/profile'
import { verificationPlanSchema } from './verification/validation'

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

export function shouldStopIdeSuiteAfterTaskFailure(tasks: SuiteTask[]) {
  return tasks.some(isDevtoolsVitestTask)
}

export function createIdeSuiteCleanupHooks(
  tasks: SuiteTask[],
  cleanup: () => Promise<void> = cleanupResidualIdeProcesses,
) {
  if (!tasks.some(isDevtoolsVitestTask)) {
    return {}
  }

  return {
    beforeEachTask: async (task: SuiteTask) => {
      if (!isDevtoolsVitestTask(task)) {
        return
      }
      await cleanup()
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

interface SuiteCallbacks {
  beforeTaskLaunch?: TaskLaunchHook
  nonInteractive?: boolean
  onUnsafeRuntime?: (reason: string) => void
  onReport?: (report: SuiteReportPayload) => void
}

async function runSelectedE2ESuiteCli(args: string[], callbacks: SuiteCallbacks) {
  const parsedSelection = splitWechatDevtoolsSelectionArgs(args)
  args = parsedSelection.args
  const selectionEnv = { cliPath: 'WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', devtoolsChannel: 'WEAPP_VITE_E2E_DEVTOOLS_CHANNEL', devtoolsVersion: 'WEAPP_VITE_E2E_DEVTOOLS_VERSION', requireOfficialLatest: 'WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST' }
  if (parsedSelection.selection.cliPath || parsedSelection.selection.devtoolsChannel || parsedSelection.selection.devtoolsVersion) {
    for (const key of ['WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', 'WEAPP_VITE_E2E_DEVTOOLS_CHANNEL', 'WEAPP_VITE_E2E_DEVTOOLS_VERSION', 'WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_CHANNEL', 'WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION', 'WEAPP_IDE_CLI_PATH', 'WEAPP_IDE_DEVTOOLS_CHANNEL', 'WEAPP_IDE_DEVTOOLS_VERSION']) {
      delete process.env[key]
    }
  }
  for (const [key, value] of Object.entries(parsedSelection.selection)) {
    process.env[selectionEnv[key as keyof typeof selectionEnv]] = typeof value === 'boolean' ? value ? '1' : '0' : value
  }
  if (parsedSelection.selection.requireOfficialLatest !== undefined) {
    process.env.WEAPP_IDE_REQUIRE_OFFICIAL_LATEST = parsedSelection.selection.requireOfficialLatest ? '1' : '0'
  }
  const allowFailures = args.includes('--allow-failures')
  const filter = readOption(args, 'filter', TASK_FILTER_ENV)
  const from = readOption(args, 'from', TASK_FROM_ENV)
  const rollFrom = readOption(args, 'roll-from', TASK_ROLL_FROM_ENV)
  let shardIndex = readOption(args, 'shard-index', TASK_SHARD_INDEX_ENV)
  let shardTotal = readOption(args, 'shard-total', TASK_SHARD_TOTAL_ENV)
  const planFile = args.find(arg => arg.startsWith('--plan='))?.slice('--plan='.length)
  const expectedPlanHash = args.find(arg => arg.startsWith('--expected-plan-hash='))?.slice('--expected-plan-hash='.length)
  let frozenPlan: VerificationPlan | undefined
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
  const excludedProjects = excludedE2EProjects()
  tasks = tasks.map(task => isExcludedE2EProject(task.label, excludedProjects)
    ? { ...task, outOfScopeReason: 'Excluded by WEAPP_VITE_E2E_EXCLUDE_PROJECTS' }
    : task)
  if (excludedProjects.length) {
    console.log(`[e2e:${mode}] excluded projects: ${excludedProjects.join(', ')}`)
  }
  const plannedTasks = [...tasks]
  const telemetryPlan = await loadBaselineSuitePlan(mode, tasks, { filtered: Boolean(filter || from || rollFrom || process.env.WEAPP_VITE_E2E_TEMPLATE || planFile) })

  if (tasks.length === 0) {
    console.error(`Unknown e2e suite: ${mode}`)
    console.error(`Available suites: ${(await listE2ESuites()).map(suite => suite.name).join(', ')}, list`)
    process.exitCode = 1
    return
  }
  try {
    if (planFile) {
      if (filter || from || rollFrom || process.env.WEAPP_VITE_E2E_TEMPLATE || shardTotal) {
        throw new Error('Frozen shard plans cannot be combined with ad-hoc filters or a separate shard total')
      }
      frozenPlan = verificationPlanSchema.parse(JSON.parse(await fs.readFile(planFile, 'utf8')))
      assertVerificationPlan(frozenPlan, { suite: mode, profile: currentVerificationProfile(mode), tasks, identity: createVerificationIdentity() })
      if (expectedPlanHash && frozenPlan.planHash !== expectedPlanHash) {
        throw new Error('Frozen verification plan hash does not match the expected artifact')
      }
      shardIndex ||= '1'
      const index = Number(shardIndex)
      if (!Number.isInteger(index) || index < 1 || index > frozenPlan.shardTotal) {
        throw new Error('Frozen verification shard index is outside the planned range')
      }
      shardTotal = String(frozenPlan.shardTotal)
      const assigned = new Set(frozenPlan.tasks.filter(task => !task.outOfScopeReason && task.shardIndex === index).map(task => task.label))
      tasks = tasks.filter(task => assigned.has(task.label))
    }
    else {
      tasks = orderSuiteTasks(tasks, { filter, from, rollFrom })
    }
    if (!frozenPlan && (shardIndex || shardTotal)) {
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

  const cleanupHooks = createIdeSuiteCleanupHooks(tasks)
  let actualReport: SuiteReportPayload | undefined
  const result = await runTaskSuite(`e2e:${mode}${shardLabel.replace('/', '-')}`, tasks, {
    ...cleanupHooks,
    ...callbacks,
    onReport(report) {
      actualReport = report
      callbacks.onReport?.(report)
    },
    failOnTaskFailure: !allowFailures,
    stopOnTaskFailure: !allowFailures && shouldStopIdeSuiteAfterTaskFailure(tasks),
    reportContext: {
      ...(frozenPlan || telemetryPlan ? { runId: (frozenPlan ?? telemetryPlan)!.runId, commitSha: (frozenPlan ?? telemetryPlan)!.commitSha, workingTreeDirty: (frozenPlan ?? telemetryPlan)!.workingTreeDirty } : createAcceptanceIdentity()),
      strict: isStrictDomAcceptanceSuite(mode),
      partial: Boolean(filter || from || shardIndex || shardTotal || process.env.WEAPP_VITE_E2E_TEMPLATE),
      plannedTasks: frozenPlan ? tasks : plannedTasks,
      ...(telemetryPlan ? { taskDefinitions: Object.fromEntries(telemetryPlan.tasks.map(task => [task.label, task.definitionHash])), plannedCases: Object.fromEntries(telemetryPlan.tasks.filter(task => task.cases).map(task => [task.label, task.cases!])) } : {}),
      ...(frozenPlan
        ? {
            taskDefinitions: Object.fromEntries(frozenPlan.tasks.map(task => [task.label, task.definitionHash])),
            plannedCases: Object.fromEntries(frozenPlan.tasks.filter(task => task.cases).map(task => [task.label, task.cases!])),
            execution: { scope: 'shard' as const, status: 'incomplete' as const, profile: frozenPlan.profile, planHash: frozenPlan.planHash, shardIndex: Number(shardIndex), shardTotal: frozenPlan.shardTotal, assignedTasks: tasks.map(task => task.label), startedAt: new Date().toISOString(), finishedAt: '' },
          }
        : {}),
    },
  })
  if (telemetryPlan && result === 0 && actualReport) {
    await writeBaselineSuiteTelemetry(telemetryPlan, actualReport, Number(shardIndex || 1), tasks.filter(task => !task.outOfScopeReason).map(task => task.label))
  }
  return result
}

/** 选择仅在本轮 suite 生效，失败与取消同样恢复调用方环境。 */
export async function runE2ESuiteCli(args = process.argv.slice(2), callbacks: SuiteCallbacks = {}) {
  return await withWechatE2ESelectionEnvironment(() => runSelectedE2ESuiteCli(args, callbacks))
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await runE2ESuiteCli()
}
