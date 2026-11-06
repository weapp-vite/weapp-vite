import type { SuiteReportPayload } from './suiteReport'
import type { SuiteTask } from './suiteRunner'
import type { TaskLaunchHook } from './suiteRunner/launchBudget'
import type { VerificationPlan } from './verification/types'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { excludedE2EProjects, isExcludedE2EProject } from '../../scripts/e2eProjectScope'
import { resolveVerificationTopology } from '../../scripts/verification/topology.ts'
import { withWechatE2ESelectionEnvironment } from '../utils/devtoolsCli'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { createAcceptanceIdentity, isStrictDomAcceptanceSuite } from './domAcceptanceReport/helpers'
import { getSuiteTasks, listE2ESuites, partitionE2ETasks } from './e2e-suite-manifest'
import { parseE2ESuiteArguments } from './run-e2e-suite/arguments'
import { loadBaselineSuiteExecution } from './run-e2e-suite/baselineTelemetry'
import { isDevtoolsVitestTask, runTaskSuite } from './suiteRunner'
import { createSuiteSignalScope } from './suiteRunner/signals'
import { assertVerificationPlan, createVerificationIdentity, taskDefinitionHash } from './verification/plan'
import { currentVerificationProfile } from './verification/profile'
import { verificationPlanSchema } from './verification/validation'

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
  signal?: AbortSignal
  beforeTaskLaunch?: TaskLaunchHook
  nonInteractive?: boolean
  onUnsafeRuntime?: (reason: string) => void
  onReport?: (report: SuiteReportPayload) => void
}

async function runSelectedE2ESuiteCli(args: string[], callbacks: SuiteCallbacks) {
  callbacks.signal?.throwIfAborted()
  const parsed = parseE2ESuiteArguments(args)
  const { selection } = parsed
  const selectionEnv = { cliPath: 'WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', devtoolsChannel: 'WEAPP_VITE_E2E_DEVTOOLS_CHANNEL', devtoolsVersion: 'WEAPP_VITE_E2E_DEVTOOLS_VERSION', requireOfficialLatest: 'WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST' }
  if (selection.cliPath || selection.devtoolsChannel || selection.devtoolsVersion) {
    for (const key of ['WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', 'WEAPP_VITE_E2E_DEVTOOLS_CHANNEL', 'WEAPP_VITE_E2E_DEVTOOLS_VERSION', 'WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_CHANNEL', 'WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION', 'WEAPP_IDE_CLI_PATH', 'WEAPP_IDE_DEVTOOLS_CHANNEL', 'WEAPP_IDE_DEVTOOLS_VERSION']) {
      delete process.env[key]
    }
  }
  for (const [key, value] of Object.entries(selection)) {
    process.env[selectionEnv[key as keyof typeof selectionEnv]] = typeof value === 'boolean' ? value ? '1' : '0' : value
  }
  if (selection.requireOfficialLatest !== undefined) {
    process.env.WEAPP_IDE_REQUIRE_OFFICIAL_LATEST = selection.requireOfficialLatest ? '1' : '0'
  }
  const { allowFailures, filter, from, rollFrom, planFile, expectedPlanHash, mode } = parsed
  let { shardIndex, shardTotal } = parsed
  const executionTopology = resolveVerificationTopology(parsed.topology)
  let frozenPlan: VerificationPlan | undefined
  let baseline: Awaited<ReturnType<typeof loadBaselineSuiteExecution>>

  if (mode === 'list') {
    const suites = await listE2ESuites()
    for (const suite of suites) {
      console.log(`${suite.name} (${suite.taskCount})`)
      console.log(`  ${suite.description}`)
    }
    return 0
  }

  let tasks = await getSuiteTasks(mode, { topology: executionTopology.id })
  callbacks.signal?.throwIfAborted()
  const excludedProjects = excludedE2EProjects()
  tasks = tasks.map(task => isExcludedE2EProject(task.label, excludedProjects)
    ? { ...task, outOfScopeReason: 'Excluded by WEAPP_VITE_E2E_EXCLUDE_PROJECTS' }
    : task)
  if (excludedProjects.length) {
    console.log(`[e2e:${mode}] excluded projects: ${excludedProjects.join(', ')}`)
  }
  const plannedTasks = [...tasks]

  if (tasks.length === 0) {
    console.error(`Unknown e2e suite: ${mode}`)
    console.error(`Available suites: ${(await listE2ESuites()).map(suite => suite.name).join(', ')}, list`)
    process.exitCode = 1
    return
  }
  try {
    baseline = await loadBaselineSuiteExecution({ suite: mode, tasks, topology: executionTopology.id, filtered: Boolean(filter || from || rollFrom || process.env.WEAPP_VITE_E2E_TEMPLATE), frozenPlan: Boolean(planFile) })
    if (planFile) {
      if (filter || from || rollFrom || process.env.WEAPP_VITE_E2E_TEMPLATE || shardTotal) {
        throw new Error('Frozen shard plans cannot be combined with ad-hoc filters or a separate shard total')
      }
      frozenPlan = verificationPlanSchema.parse(JSON.parse(await fs.readFile(planFile, 'utf8')))
      assertVerificationPlan(frozenPlan, { suite: mode, profile: currentVerificationProfile(mode), tasks, identity: createVerificationIdentity(), topology: executionTopology.id })
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
  callbacks.signal?.throwIfAborted()
  const reportPlan = frozenPlan ?? baseline?.plan
  const execute = (onReport = callbacks.onReport) => runTaskSuite(`e2e:${mode}${shardLabel.replace('/', '-')}`, tasks, {
    ...cleanupHooks,
    ...callbacks,
    onReport,
    failOnTaskFailure: !allowFailures,
    stopOnTaskFailure: !allowFailures && shouldStopIdeSuiteAfterTaskFailure(tasks),
    reportContext: {
      ...(reportPlan ? { runId: reportPlan.runId, commitSha: reportPlan.commitSha, workingTreeDirty: reportPlan.workingTreeDirty } : createAcceptanceIdentity()),
      executionTopology,
      taskDefinitions: Object.fromEntries(plannedTasks.map(task => [task.label, taskDefinitionHash(task)])),
      strict: isStrictDomAcceptanceSuite(mode),
      partial: Boolean(filter || from || shardIndex || shardTotal || process.env.WEAPP_VITE_E2E_TEMPLATE),
      plannedTasks: frozenPlan ? tasks : plannedTasks,
      ...(baseline ? { plannedCases: Object.fromEntries(baseline.plan.tasks.filter(task => task.cases).map(task => [task.label, task.cases!])) } : {}),
      ...(frozenPlan
        ? {
            taskDefinitions: Object.fromEntries(frozenPlan.tasks.map(task => [task.label, task.definitionHash])),
            plannedCases: Object.fromEntries(frozenPlan.tasks.filter(task => task.cases).map(task => [task.label, task.cases!])),
            execution: { scope: 'shard' as const, status: 'incomplete' as const, profile: frozenPlan.profile, executionTopology: frozenPlan.executionTopology, planHash: frozenPlan.planHash, shardIndex: Number(shardIndex), shardTotal: frozenPlan.shardTotal, assignedTasks: tasks.map(task => task.label), startedAt: new Date().toISOString(), finishedAt: '' },
          }
        : {}),
    },
  })
  return baseline
    ? await baseline.run(tasks, Number(shardIndex || '1'), Number(shardTotal || '1'), execute, callbacks.onReport)
    : await execute()
}

/** 选择仅在本轮 suite 生效，失败与取消同样恢复调用方环境。 */
export async function runE2ESuiteCli(args = process.argv.slice(2), callbacks: SuiteCallbacks = {}) {
  const scope = createSuiteSignalScope(callbacks.signal)
  try {
    return await withWechatE2ESelectionEnvironment(() => runSelectedE2ESuiteCli(args, { ...callbacks, signal: scope.signal }))
  }
  catch (error) {
    if (scope.signal.aborted && error === scope.signal.reason) {
      return scope.exitCode ?? 1
    }
    throw error
  }
  finally {
    if (scope.exitCode !== undefined) {
      process.exitCode = scope.exitCode
    }
    scope.dispose()
  }
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await runE2ESuiteCli()
}
