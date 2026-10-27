import type { PlannedTaskCaseReader } from '../domAcceptanceReport/taskCases'
import type { SuiteTask } from '../suiteRunner'
import type { DurationHistory, VerificationPlan, VerificationProfile } from './types'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { excludedE2EProjects, isExcludedE2EProject } from '../../../scripts/e2eProjectScope'
import { resolveVerificationTopology } from '../../../scripts/verification/topology.ts'
import { ACCEPTANCE_DIRTY_ENV, ACCEPTANCE_ROOT, createAcceptanceIdentity, isStrictDomAcceptanceSuite, sanitizeAcceptanceValue } from '../domAcceptanceReport/helpers'
import { collectInventorySources } from '../domAcceptanceReport/inventorySources'
import { createPlannedTaskCaseReader } from '../domAcceptanceReport/taskCases'
import { getSuiteTasks } from '../e2e-suite-manifest'
import { HMR_ACCEPTANCE_CAPABILITIES } from '../hmr-acceptance-manifest'
import { assertVerificationPlanContract, verificationHash } from './planContract'
import { assertVerificationProfile } from './profile'
import { VERIFICATION_TOOL_VERSION } from './types'

export { verificationHash } from './planContract'

interface VerificationGitDiagnostics {
  trackedStatus?: { count: number, entries: string[] }
  untrackedFiles?: { count: number, entries: string[] }
  failedOperations: string[]
}

const identityGitDiagnostics = new WeakMap<ReturnType<typeof createAcceptanceIdentity>, VerificationGitDiagnostics>()

function summarizeGitEntries(entries: string[]) {
  return { count: entries.length, entries: entries.slice(0, 50) }
}

/** 冻结与执行时重新读取 Git 状态，不信任父进程传入的 clean 标记。 */
export function createVerificationIdentity(env = process.env, readGit?: Parameters<typeof createAcceptanceIdentity>[1]) {
  const diagnostics: VerificationGitDiagnostics = { failedOperations: [] }
  const identity = createAcceptanceIdentity({ ...env, [ACCEPTANCE_DIRTY_ENV]: undefined }, (args) => {
    try {
      const output = readGit
        ? readGit(args)
        : execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: ACCEPTANCE_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      if (args[0] === 'status') {
        diagnostics.trackedStatus = summarizeGitEntries(output.replaceAll('\r\n', '\n').split('\n').filter(Boolean))
      }
      if (args[0] === 'ls-files') {
        diagnostics.untrackedFiles = summarizeGitEntries(output.split('\0').filter(Boolean))
      }
      return output
    }
    catch (error) {
      diagnostics.failedOperations.push(args[0]!)
      throw error
    }
  })
  identityGitDiagnostics.set(identity, diagnostics)
  return identity
}

function normalizeTaskValue(value: string) {
  return value.replaceAll('\\', '/').replaceAll(ACCEPTANCE_ROOT.replaceAll('\\', '/'), '<repo>')
}

export function taskDefinitionHash(task: SuiteTask) {
  return verificationHash({
    label: task.label,
    command: task.command,
    args: task.args.map(normalizeTaskValue),
    env: Object.fromEntries(Object.entries(task.env ?? {}).map(([key, value]) => [key, normalizeTaskValue(value)])),
    outOfScopeReason: task.outOfScopeReason,
    acceptanceTemplates: task.acceptanceTemplates,
  })
}

export function verificationSourceDigest(tasks: SuiteTask[]) {
  const files = ['e2e/scripts/e2e-suite-manifest.ts', ...tasks.flatMap(task => [
    ...(fs.existsSync(path.join(ACCEPTANCE_ROOT, 'e2e', task.label)) ? [`e2e/${task.label}`] : []),
    ...task.args.filter(arg => arg.endsWith('.ts') && arg.startsWith(`${ACCEPTANCE_ROOT}${path.sep}e2e${path.sep}`)).map(arg => path.relative(ACCEPTANCE_ROOT, arg).replaceAll('\\', '/')),
  ])]
  return verificationHash({ sources: collectInventorySources(ACCEPTANCE_ROOT, files), hmrCapabilities: HMR_ACCEPTANCE_CAPABILITIES })
}

export async function resolveVerificationTasks(suite: string, topology?: string) {
  const excluded = excludedE2EProjects()
  const tasks = (await getSuiteTasks(suite, { topology })).map(task => isExcludedE2EProject(task.label, excluded)
    ? { ...task, outOfScopeReason: 'Excluded by WEAPP_VITE_E2E_EXCLUDE_PROJECTS' }
    : task)
  if (!tasks.length || new Set(tasks.map(task => task.label)).size !== tasks.length) {
    throw new Error('Verification suite must contain a non-empty unique task inventory')
  }
  return tasks
}

export function fallbackTaskDuration(label: string) {
  if (label.startsWith('hmr-guard:')) {
    return 80_000
  }
  if (label.includes('.e2e.') || label.includes('.integration.')) {
    return 50_000
  }
  return label.includes('platform') || label.includes('template') ? 40_000 : 20_000
}

export function assertVerificationPlan(plan: VerificationPlan, options?: { suite: string, profile: VerificationProfile, tasks: SuiteTask[], identity: ReturnType<typeof createAcceptanceIdentity>, topology?: string }) {
  assertVerificationPlanContract(plan)
  if (!options) {
    return
  }
  assertVerificationProfile(plan.profile, options.profile)
  if (verificationHash(plan.executionTopology) !== verificationHash(resolveVerificationTopology(options.topology))) {
    throw new Error('Frozen verification plan topology mismatch')
  }
  const definitions = options.tasks.map(task => [task.label, taskDefinitionHash(task)] as const)
  const expected = {
    suite: plan.suite,
    commitSha: plan.commitSha,
    workingTreeDirty: plan.workingTreeDirty,
    sourceDigest: plan.sourceDigest,
    taskInventoryHash: verificationHash(plan.tasks.map(task => [task.label, task.definitionHash])),
  }
  let sourceDigest: string | null = null
  let sourceDigestErrorCode: string | undefined
  try {
    sourceDigest = verificationSourceDigest(options.tasks)
  }
  catch (error) {
    sourceDigestErrorCode = (error as NodeJS.ErrnoException).code ?? 'unavailable'
  }
  const actual = {
    suite: options.suite,
    commitSha: options.identity.commitSha,
    workingTreeDirty: options.identity.workingTreeDirty,
    sourceDigest,
    taskInventoryHash: verificationHash(definitions),
  }
  const mismatches = (Object.keys(expected) as (keyof typeof expected)[]).filter(key => expected[key] !== actual[key])
  if (options.identity.workingTreeDirty !== false || mismatches.length) {
    const expectedDefinitions = new Map(plan.tasks.map(task => [task.label, task.definitionHash]))
    const actualDefinitions = new Map(definitions)
    const taskDefinitionChanges = [...new Set([...expectedDefinitions.keys(), ...actualDefinitions.keys()])]
      .filter(label => expectedDefinitions.get(label) !== actualDefinitions.get(label))
      .map(label => ({ label, expected: expectedDefinitions.get(label) ?? null, actual: actualDefinitions.get(label) ?? null }))
    throw new Error(`Frozen verification plan does not match the current checkout, suite or task inventory: ${JSON.stringify(sanitizeAcceptanceValue({
      mismatches,
      expected,
      actual,
      taskDefinitionChanges,
      sourceDigestErrorCode,
      git: identityGitDiagnostics.get(options.identity),
    }))}`)
  }
}

export async function createVerificationPlan(options: {
  suite: string
  topology?: string
  shards: number
  profile: VerificationProfile
  history?: DurationHistory
  tasks?: SuiteTask[]
  identity?: ReturnType<typeof createAcceptanceIdentity>
  sourceDigest?: string
  now?: Date
  readCases?: PlannedTaskCaseReader
}): Promise<VerificationPlan> {
  if (!Number.isInteger(options.shards) || options.shards < 1) {
    throw new Error('Shard total must be a positive integer')
  }
  if (!options.profile.arch) {
    throw new Error('Frozen verification profiles require an explicit architecture')
  }
  if (options.history) {
    assertVerificationProfile(options.profile, options.history.profile)
    if (options.history.toolVersion !== VERIFICATION_TOOL_VERSION) {
      throw new Error('Duration history tool version mismatch')
    }
    const historyAge = (options.now ?? new Date()).getTime() - Date.parse(options.history.generatedAt)
    if (options.history.schemaVersion !== 1 || !Number.isFinite(historyAge) || historyAge < 0 || historyAge > 30 * 86_400_000) {
      throw new Error('Duration history is expired or has an invalid timestamp')
    }
  }
  const executionTopology = resolveVerificationTopology(options.topology)
  const tasks = options.tasks ?? await resolveVerificationTasks(options.suite, executionTopology.id)
  if (!tasks.length || new Set(tasks.map(task => task.label)).size !== tasks.length) {
    throw new Error('Cannot freeze an empty or duplicate task inventory')
  }
  if (options.shards > tasks.filter(task => !task.outOfScopeReason).length) {
    throw new Error('Shard total exceeds the executable task inventory')
  }
  const strict = isStrictDomAcceptanceSuite(options.suite)
  const readCases = options.readCases ?? createPlannedTaskCaseReader()
  const planned = await Promise.all(tasks.map(async task => ({
    label: task.label,
    definitionHash: taskDefinitionHash(task),
    estimatedDurationMs: options.history?.tasks[task.label]?.durationMs ?? fallbackTaskDuration(task.label),
    shardIndex: 0,
    ...(task.outOfScopeReason ? { outOfScopeReason: task.outOfScopeReason } : {}),
    ...(strict && !task.outOfScopeReason ? { cases: await readCases(task, options.profile.provider === 'headless' ? 'headless' : 'devtools') } : {}),
    ...(task.acceptanceTemplates ? { acceptanceTemplates: task.acceptanceTemplates } : {}),
  })))
  const loads = Array.from<number>({ length: options.shards }).fill(0)
  for (const task of planned.filter(task => !task.outOfScopeReason).sort((left, right) => right.estimatedDurationMs - left.estimatedDurationMs || left.label.localeCompare(right.label))) {
    const target = loads.indexOf(Math.min(...loads))
    task.shardIndex = target + 1
    loads[target] += task.estimatedDurationMs
  }
  const identity = options.identity ?? createVerificationIdentity()
  if (identity.workingTreeDirty !== false) {
    throw new Error('Frozen verification plans require a clean, known checkout')
  }
  const plan = {
    schemaVersion: 1 as const,
    toolVersion: VERIFICATION_TOOL_VERSION,
    ...identity,
    workingTreeDirty: identity.workingTreeDirty ?? null,
    createdAt: (options.now ?? new Date()).toISOString(),
    suite: options.suite,
    strict,
    profile: options.profile,
    executionTopology,
    sourceDigest: options.sourceDigest ?? verificationSourceDigest(tasks),
    shardTotal: options.shards,
    tasks: planned,
    historySources: [...new Set(planned.flatMap(task => options.history?.tasks[task.label]?.sources ?? []))].sort(),
  }
  const frozen = { ...plan, planHash: verificationHash(plan) }
  assertVerificationPlan(frozen)
  return frozen
}
