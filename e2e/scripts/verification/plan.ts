import type { SuiteTask } from '../suiteRunner'
import type { DurationHistory, VerificationPlan, VerificationProfile } from './types'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { excludedE2EProjects, isExcludedE2EProject } from '../../../scripts/e2eProjectScope'
import { assertVerificationTopology, resolveVerificationTopology } from '../../../scripts/verification/topology.ts'
import { ACCEPTANCE_DIRTY_ENV, ACCEPTANCE_ROOT, createAcceptanceIdentity, isStrictDomAcceptanceSuite } from '../domAcceptanceReport/helpers'
import { collectInventorySources } from '../domAcceptanceReport/inventorySources'
import { readPlannedTaskCases } from '../domAcceptanceReport/taskCases'
import { getSuiteTasks } from '../e2e-suite-manifest'
import { assertVerificationProfile } from './profile'
import { VERIFICATION_TOOL_VERSION } from './types'

export function verificationHash(value: unknown): string {
  const canonical = (entry: unknown): unknown => Array.isArray(entry)
    ? entry.map(canonical)
    : entry && typeof entry === 'object'
      ? Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [key, canonical(value)]))
      : entry
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

/** 冻结与执行时重新读取 Git 状态，不信任父进程传入的 clean 标记。 */
export function createVerificationIdentity(env = process.env, readGit?: Parameters<typeof createAcceptanceIdentity>[1]) {
  return createAcceptanceIdentity({ ...env, [ACCEPTANCE_DIRTY_ENV]: undefined }, readGit)
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
  return verificationHash(collectInventorySources(ACCEPTANCE_ROOT, files))
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
  assertVerificationTopology(plan.executionTopology)
  const { planHash, ...content } = plan
  if (plan.schemaVersion !== 1 || plan.toolVersion !== VERIFICATION_TOOL_VERSION || planHash !== verificationHash(content)
    || plan.workingTreeDirty !== false || !plan.profile.arch
    || !plan.tasks.length || new Set(plan.tasks.map(task => task.label)).size !== plan.tasks.length
    || plan.strict !== isStrictDomAcceptanceSuite(plan.suite)
    || !Number.isInteger(plan.shardTotal) || plan.shardTotal < 1
    || new Set(plan.tasks.filter(task => !task.outOfScopeReason).map(task => task.shardIndex)).size !== plan.shardTotal
    || plan.tasks.some(task => !Number.isFinite(task.estimatedDurationMs) || task.estimatedDurationMs <= 0
      || !Number.isInteger(task.shardIndex) || task.shardIndex < (task.outOfScopeReason ? 0 : 1) || task.shardIndex > plan.shardTotal
      || (task.outOfScopeReason && task.shardIndex !== 0)
      || (plan.strict && !task.outOfScopeReason && (!task.cases?.length
        || new Set(task.cases.map(item => JSON.stringify([item.file, item.name]))).size !== task.cases.length
        || task.cases.some(item => item.file !== `e2e/${task.label}`))))) {
    throw new Error('Invalid or modified frozen verification plan')
  }
  if (!options) {
    return
  }
  assertVerificationProfile(plan.profile, options.profile)
  if (verificationHash(plan.executionTopology) !== verificationHash(resolveVerificationTopology(options.topology))) {
    throw new Error('Frozen verification plan topology mismatch')
  }
  if (options.identity.workingTreeDirty !== false || plan.suite !== options.suite || plan.commitSha !== options.identity.commitSha || plan.workingTreeDirty !== options.identity.workingTreeDirty
    || plan.sourceDigest !== verificationSourceDigest(options.tasks)
    || verificationHash(plan.tasks.map(task => [task.label, task.definitionHash])) !== verificationHash(options.tasks.map(task => [task.label, taskDefinitionHash(task)]))) {
    throw new Error('Frozen verification plan does not match the current checkout, suite or task inventory')
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
  const planned = await Promise.all(tasks.map(async task => ({
    label: task.label,
    definitionHash: taskDefinitionHash(task),
    estimatedDurationMs: options.history?.tasks[task.label]?.durationMs ?? fallbackTaskDuration(task.label),
    shardIndex: 0,
    ...(task.outOfScopeReason ? { outOfScopeReason: task.outOfScopeReason } : {}),
    ...(strict && !task.outOfScopeReason ? { cases: await readPlannedTaskCases(task, options.profile.provider === 'headless' ? 'headless' : 'devtools') } : {}),
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
