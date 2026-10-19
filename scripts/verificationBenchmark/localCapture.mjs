import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 真实完整入口使用跨平台进程启动与实际退出状态。
import { execa } from 'execa'
import { validateSample } from './compare.mjs'
import { collectLocalEvidence } from './localEvidence.mjs'
import { localIdentity } from './localFiles.mjs'
import { localFrameworkInputs } from './localFramework.mjs'
import { localDigest, localDocument, localRelative, localSave } from './localIo.mjs'
import { freezeLocalSuites } from './localRuntime.mjs'

const keys = ['schemaVersion', 'id', 'variant', 'mode', 'base', 'selection', 'jobs', 'cachePolicy', 'inputPolicy']
const filters = ['TASK_FILTER', 'TASK_FROM', 'TASK_ROLL_FROM', 'SHARD_INDEX', 'SHARD_TOTAL', 'TEMPLATE', 'TARGET_FILE', 'EXCLUDE_PROJECTS', 'ACCEPTANCE_CASES', 'CI_SKIP_HMR_GUARD']

function configuration(config) {
  assert(config?.schemaVersion === 1 && Object.keys(config).every(key => keys.includes(key))
    && ['baseline', 'candidate'].includes(config.variant) && typeof config.id === 'string' && config.id
    && ['quick', 'review', 'full'].includes(config.mode) && config.inputPolicy === 'framework-tree-v2'
    && typeof config.cachePolicy === 'string' && config.cachePolicy.trim()
    && (!config.selection || ['shadow', 'affected'].includes(config.selection)), 'Invalid complete local verification configuration')
  assert(!filters.some(key => process.env[`WEAPP_VITE_E2E_${key}`]?.trim()) && !process.env.WEAPP_VITE_E2E_DOM_ACCEPTANCE
    && !process.env.WEAPP_VITE_VERIFICATION_LOCAL_DIR, 'Local full benchmark cannot inherit partial filters, strict overrides or another capture')
  assert(!process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER || process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER === 'devtools', 'Local full benchmark requires the original DevTools provider policy')
}

/** 运行原 verify 命令，只有原 full 的全部实际子证据完成后才产生可比较样本。 */
export async function captureVerificationSample(config, output, root = process.cwd()) {
  configuration(config)
  root = await realpath(root)
  const outputPath = path.join(root, localRelative(root, output))
  await mkdir(path.dirname(outputPath), { recursive: true })
  assert(path.relative(await realpath(path.dirname(outputPath)), path.dirname(outputPath)) === '', 'Local sample output escapes its checkout')
  const runId = `local-${randomUUID()}`
  const directory = path.join(root, '.tmp/verification-benchmark', runId)
  await mkdir(directory, { recursive: true })
  const identity = localIdentity(root, runId)
  const inputs = await localFrameworkInputs(root)
  await localSave(path.join(directory, 'inputs.json'), inputs)
  const inputReceipt = await localDocument(root, path.join(directory, 'inputs.json'))
  const prepare = await import(pathToFileURL(path.join(root, 'scripts/verification/prepare.ts')).href)
  const options = { mode: config.mode, base: config.base, selection: config.selection, jobs: config.jobs }
  const plan = await prepare.prepareVerificationPlan(root, options)
  const inventories = config.mode === 'full' ? await freezeLocalSuites(root) : {}
  await localSave(path.join(directory, 'frozen.json'), { identity, plan, inventories })
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  assert(manifest.scripts?.verify === 'node --import tsx scripts/verification/cli.ts run', 'Local benchmark must use the existing formal verify entry')
  // prepare 已通过隔离临时目录探测真实版本；避免 pnpm 在仓库查询版本时改写锁文件。
  const packageManagers = [...new Set(plan.tasks.map(task => task.env?.REPOCTL_RELEASE_PNPM_VERSION))]
  assert(packageManagers.length === 1 && /^pnpm@\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(packageManagers[0] ?? ''), 'Local benchmark cannot identify the actual prepared pnpm')
  const pnpm = packageManagers[0].slice('pnpm@'.length)
  const env = { ...process.env, WEAPP_VITE_VERIFICATION_LOCAL_ROOT: root, WEAPP_VITE_VERIFICATION_LOCAL_DIR: directory, WEAPP_VITE_VERIFICATION_LOCAL_RUN: runId, WEAPP_VITE_VERIFICATION_LOCAL_MODE: config.mode, WEAPP_VITE_VERIFICATION_LOCAL_PNPM: `pnpm@${pnpm}`, WEAPP_VITE_E2E_ACCEPTANCE_RUN_ID: runId, WEAPP_VITE_E2E_ACCEPTANCE_SHA: identity.commitSha, WEAPP_VITE_E2E_REPORT_MARKERS: '1', WEAPP_VITE_E2E_RUNNER_CLASS: 'local' }
  delete env.WEAPP_VITE_E2E_ACCEPTANCE_DIRTY
  const args = ['run', 'verify', '--mode', config.mode, '--jobs', String(plan.resources.cpuBudget), '--output', path.join(directory, 'verification')]
  if (config.base) {
    args.push('--base', config.base)
  }
  if (config.selection) {
    args.push('--selection', config.selection)
  }
  const start = Date.now()
  const begin = performance.now()
  let result
  let error
  try {
    result = await execa('pnpm', args, { cwd: root, env, stdout: ['pipe', 'inherit'], stderr: ['pipe', 'inherit'], reject: false })
  }
  catch (caught) {
    result = { exitCode: caught.exitCode ?? 1, signal: caught.signal, stdout: caught.stdout ?? '', stderr: caught.stderr ?? '' }
    error = caught.message
  }
  const executionMs = performance.now() - begin
  const end = Date.now()
  const raw = { tasks: [], vitest: [], lint: [], suites: [], acceptance: [] }
  let collected
  try {
    assert(localIdentity(root, runId).fingerprint === identity.fingerprint, 'Local benchmark source changed during verification')
    assert.deepEqual(await localFrameworkInputs(root), inputs, 'Local benchmark framework inputs changed during verification')
    assert(result.exitCode === 0 && !result.signal, 'Local verification process did not complete successfully')
    assert(config.mode === 'full', 'quick/review are raw partial timings and cannot count as complete local samples')
    collected = await collectLocalEvidence(root, directory, plan, inventories, { ...identity, packageManager: `pnpm@${pnpm}` }, start, end, raw)
  }
  catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
  }
  const complete = Boolean(collected && !error)
  const budget = { ...Object.fromEntries(['cpus', 'cpuBudget', 'jobs', 'workersPerTask', 'buildConcurrency'].map(key => [key, plan.resources[key]])), environment: Object.fromEntries(Object.entries(process.env).filter(([key]) => /^WEAPP.*(?:WORKERS|JOBS|CONCURRENCY)/u.test(key)).sort()) }
  await localSave(path.join(directory, 'raw.json'), { runId, identity, command: 'pnpm', args, start, end, executionMs, exitCode: result.exitCode, signal: result.signal, stdout: result.stdout, stderr: result.stderr, raw, collected, error })
  const rawDocument = await localDocument(root, path.join(directory, 'raw.json'))
  const sample = validateSample({
    schemaVersion: 1,
    id: config.id,
    variant: config.variant,
    revision: identity.commitSha,
    sourceFingerprint: identity.fingerprint,
    inputDigest: inputs.inputDigest,
    scopeDigest: localDigest(collected?.scope ?? []),
    profile: { os: process.platform, arch: process.arch, node: process.version, packageManager: `pnpm@${pnpm}`, provider: 'devtools', platform: 'workspace-full', runnerClass: 'local', cachePolicy: `${config.cachePolicy};resources=${localDigest(budget)}`, ...(complete ? { ideVersion: collected.ide.ideVersion, baseLibraryVersion: collected.ide.baseLibraryVersion } : {}) },
    complete,
    outcome: complete ? 'passed' : result.signal || [130, 143].includes(result.exitCode) ? 'cancelled' : result.exitCode !== 0 ? 'failed' : 'partial',
    metrics: { executionMs, approvalWaitMs: 0, schedulingWaitMs: 0, runnerMs: executionMs },
    evidence: { runId, mode: config.mode, cachePolicy: config.cachePolicy, resources: budget, inputReceipt: { path: inputReceipt.path, digest: inputReceipt.digest }, raw: { path: rawDocument.path, digest: rawDocument.digest }, exitCode: result.exitCode, error },
  })
  await localSave(outputPath, sample)
  return sample
}
