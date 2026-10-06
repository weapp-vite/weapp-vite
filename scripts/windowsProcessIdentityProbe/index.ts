import type { ProbeIdentity } from './identity'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 诊断须保留生产身份查询使用的真实 execa 启动与超时行为。
import { execa } from 'execa'
import { resolveWechatInspectionTimeout } from '../../packages/weapp-ide-cli/src/devtoolsTarget/inspection'
import { candidateCommand, cimCommand, measuredCimCommand } from './commands'
import { compareIdentities, hash, readIdentity, redact, summarizeIdentity } from './identity'
import { observeProbePhases } from './phases'

const timeoutMs = resolveWechatInspectionTimeout('win32')
const outputDirectory = '.tmp/windows-process-identity-probe'
const samples: Record<string, unknown>[] = []
const comparisons: Record<string, unknown>[] = []
const owned = new Set<{ kill: () => boolean }>()
const requestedFirstProvider = process.env.WEAPP_IDENTITY_PROBE_FIRST_PROVIDER ?? 'cim'
const firstProvider = requestedFirstProvider === 'cim' || requestedFirstProvider === 'candidate' ? requestedFirstProvider : undefined
const providerOrder: ('cim' | 'candidate')[] = firstProvider === 'candidate' ? ['candidate', 'cim'] : ['cim', 'candidate']
const report = {
  kind: 'diagnostic-only-not-acceptance',
  acceptance: 'not-evaluated',
  workflowCommit: process.env.GITHUB_SHA,
  observedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  osRelease: os.release(),
  runnerImage: process.env.ImageOS,
  runnerImageVersion: process.env.ImageVersion,
  timeoutMs,
  firstProvider,
  firstProbe: 'First PowerShell query issued by this script uses firstProvider; prior OS or setup-step provider usage is unknown.',
  sampleOrder: [...providerOrder.flatMap(provider => [`${provider}-1`, `${provider}-2-if-first-present`]), 'production-identity-if-cim-samples-present', 'powershell-startup-only'],
  timeoutPolicy: 'All identity queries retain the production 10000ms budget. A separate bounded supervisor aborts incomplete collection; it never retries or accepts a wider query budget.',
  privacy: 'No raw stdout, executable paths, commands or environment dumps are persisted. Stderr retains marker metadata and redacted errors. Paths are compared in memory and represented by hashes.',
  limitations: ['Owned Node processes only; access-denied and arbitrary-process exit races are not covered.', 'Candidate is diagnostic only; no ownership or cleanup decision uses its result.', 'Fresh runner jobs do not prove that the OS provider has never been used. Only the first script-issued PowerShell query is labelled first.', 'One first sample per runner is diagnostic evidence, not a cold-start distribution. Entry-marker receipt includes process launch and pipe delivery.'],
  samples,
  comparisons,
  state: 'started',
  fatalError: undefined as string | undefined,
  finishedAt: undefined as string | undefined,
}
mkdirSync(outputDirectory, { recursive: true })
const save = () => writeFileSync(`${outputDirectory}/report.json`, `${JSON.stringify(report, null, 2)}\n`)
save()

function abortCollection(reason: string): never {
  report.state = 'collection-aborted'
  report.fatalError = reason
  report.finishedAt = new Date().toISOString()
  for (const child of owned) {
    try {
      child.kill()
    }
    catch {
      samples.push({ label: 'supervisor-owned-child-termination', state: 'kill-error' })
    }
  }
  save()
  process.stderr.write(`${reason}\n`)
  process.exit(1)
}

async function bounded<T>(label: string, operation: PromiseLike<T>, budgetMs: number): Promise<T> {
  const timer = setTimeout(abortCollection, budgetMs, `Supervisor deadline exceeded: ${label}; pending collection is not accepted.`)
  try {
    return await operation
  }
  finally {
    clearTimeout(timer)
  }
}

async function execute(label: string, role: string, command: string, args: string[], budgetMs = timeoutMs, metadata: Record<string, unknown> = {}) {
  const sample: Record<string, unknown> = { ...metadata, label, role, state: 'running', budgetMs, launcher: 'execa', diagnosticOnly: true }
  samples.push(sample)
  save()
  const start = performance.now()
  const child = execa(command, args, { timeout: budgetMs, reject: false, windowsHide: true, maxBuffer: 128 * 1024 })
  const phases = label.startsWith('cim-') || label.startsWith('candidate-')
    ? observeProbePhases(child.stderr, () => performance.now() - start, (fields) => {
        Object.assign(sample, fields)
        save()
      })
    : undefined
  owned.add(child)
  try {
    const result = await bounded(label, child, budgetMs + 8_000)
    Object.assign(sample, {
      state: 'completed',
      elapsedMs: performance.now() - start,
      exitCode: result.exitCode ?? null,
      signal: result.signal ?? null,
      timedOut: result.timedOut,
      failed: result.failed,
      killed: child.nodeChildProcess.killed,
      isTerminated: result.isTerminated,
      isForcefullyTerminated: result.isForcefullyTerminated,
      stdoutSha256: hash(result.stdout),
      stderrSha256: hash(result.stderr),
      stderr: redact(result.stderr),
      stdoutLength: result.stdout.length,
      stderrLength: result.stderr.length,
      code: 'code' in result ? result.code : undefined,
    })
    return { sample, result }
  }
  catch (error) {
    Object.assign(sample, { state: 'launch-error', elapsedMs: performance.now() - start, message: redact(error instanceof Error ? error.message : String(error)) })
    throw error
  }
  finally {
    if (phases) {
      Object.assign(sample, phases.finish())
    }
    owned.delete(child)
    save()
    process.stdout.write(`${JSON.stringify({ label, role, state: sample.state, elapsedMs: sample.elapsedMs })}\n`)
  }
}

async function production(role: string, pid: number) {
  // 外层预算只约束 tsx 加载和失败收尾；库内 PowerShell 仍严格使用 10 秒。
  const { sample, result } = await execute('production-identity', role, process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./production.ts', import.meta.url)), String(pid)], timeoutMs + 8_000)
  if (result.timedOut) {
    throw new Error('Production worker did not settle after its original inspection budget; collection stopped.')
  }
  try {
    const value: unknown = JSON.parse(result.stdout)
    if (!value || typeof value !== 'object' || !('outcome' in value)) {
      throw new Error('Production worker returned an invalid diagnostic envelope.')
    }
    sample.outcome = value.outcome
    sample.libraryElapsedMs = 'elapsedMs' in value ? value.elapsedMs : undefined
    sample.libraryQueryElapsedMs = 'queryElapsedMs' in value ? value.queryElapsedMs : undefined
    sample.libraryFailurePhase = 'phase' in value ? value.phase : undefined
    sample.libraryError = 'message' in value && typeof value.message === 'string' ? redact(value.message) : undefined
    const identity = readIdentity('identity' in value ? value.identity : undefined, pid)
    sample.identity = identity && summarizeIdentity(identity, process.execPath)
    return identity
  }
  finally {
    save()
  }
}

async function powerShell(role: string, pid: number, provider: 'cim' | 'candidate', iteration: number) {
  const command = provider === 'cim' ? measuredCimCommand(pid) : candidateCommand(pid)
  const { sample, result } = await execute(`${provider}-${iteration}`, role, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], timeoutMs, {
    provider,
    observation: role === 'self' && provider === firstProvider && iteration === 1 ? 'first-script-powershell-query' : 'after-earlier-probe-queries',
  })
  if (result.failed || result.exitCode !== 0) {
    sample.outcome = 'query-error'
    if (result.stdout.trim()) {
      try {
        const error: unknown = JSON.parse(result.stdout)
        if (error && typeof error === 'object' && 'ErrorType' in error && typeof error.ErrorType === 'string') {
          sample.errorType = redact(error.ErrorType)
          sample.hResult = 'HResult' in error ? error.HResult : undefined
          sample.nativeErrorCode = 'NativeErrorCode' in error ? error.NativeErrorCode : undefined
        }
      }
      catch { sample.errorEnvelopeValid = false }
    }
    save()
    return undefined
  }
  if (!result.stdout.trim()) {
    sample.outcome = 'missing'
    save()
    return undefined
  }
  try {
    const value: unknown = JSON.parse(result.stdout)
    const identity = readIdentity(value, pid)
    sample.outcome = identity ? 'present' : 'invalid-identity'
    sample.identity = identity && summarizeIdentity(identity, process.execPath)
    return identity
  }
  catch {
    sample.outcome = 'invalid-json'
    return undefined
  }
  finally {
    save()
  }
}

async function inspectLive(role: string, pid: number) {
  const identities: Record<'cim' | 'candidate', (ProbeIdentity | undefined)[]> = { cim: [], candidate: [] }
  for (const provider of providerOrder) {
    const first = await powerShell(role, pid, provider, 1)
    identities[provider].push(first)
    if (first) {
      identities[provider].push(await powerShell(role, pid, provider, 2))
    }
    else {
      samples.push({ label: `${provider}-2`, role, state: 'not-run', reason: 'First identity was unavailable; no retry was attempted.' })
      save()
    }
  }
  let original: ProbeIdentity | undefined
  if (identities.cim.length === 2 && identities.cim.every(Boolean)) {
    original = await production(role, pid)
  }
  else {
    samples.push({ label: 'production-identity', role, state: 'not-run', reason: 'Measured CIM identity was unavailable; the production CIM query was not repeated.' })
    save()
  }
  let previousCim
  let previousCandidate
  for (const iteration of [1, 2]) {
    const cim = identities.cim[iteration - 1]
    const candidate = identities.candidate[iteration - 1]
    for (const [label, first, second] of [
      ['cim-vs-candidate', cim, candidate],
      ['production-vs-cim', original, cim],
      ['cim-repeat-stability', previousCim, cim],
      ['candidate-repeat-stability', previousCandidate, candidate],
    ] as const) {
      comparisons.push({ role, iteration, label, available: Boolean(first && second), comparison: first && second && compareIdentities(first, second) })
    }
    previousCim = cim
    previousCandidate = candidate
    save()
  }
  await execute('powershell-startup-only', role, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[Console]::Write("startup-only")'])
}

const overallDeadline = setTimeout(abortCollection, 240_000, 'Overall diagnostic collection deadline exceeded.')
let fixture: ReturnType<typeof execa> | undefined
try {
  if (process.platform !== 'win32' || timeoutMs !== 10_000) {
    throw new Error('This diagnostic requires Windows and the unchanged production 10000ms inspection budget.')
  }
  if (!firstProvider) {
    throw new Error('First provider must be cim or candidate.')
  }
  const source = readFileSync(new URL('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host.ts', import.meta.url), 'utf8')
  // eslint-disable-next-line no-template-curly-in-string -- 此处按源码模板字面量校验生产命令，不能替换成当前 PID。
  if (!source.includes(cimCommand(1).replace('ProcessId=1', 'ProcessId=${pid}'))) {
    throw new Error('The production CIM expression changed; review the diagnostic before running it.')
  }
  await inspectLive('self', process.pid)
  fixture = execa(process.execPath, ['-e', 'process.stdin.resume(); process.stdin.on("end", () => process.exit(0)); process.stdout.write("ready");'], { reject: false, stdin: 'pipe', windowsHide: true })
  owned.add(fixture)
  const ready = new Promise<void>((resolve, reject) => {
    let output = ''
    fixture!.stdout!.on('data', (chunk) => {
      output += String(chunk)
      if (output === 'ready') {
        resolve()
      }
      else if (!'ready'.startsWith(output)) {
        reject(new Error('Unexpected fixture readiness output.'))
      }
    })
    fixture!.nodeChildProcess.once('error', reject)
    fixture!.nodeChildProcess.once('exit', () => reject(new Error('Owned fixture exited before readiness.')))
  })
  await bounded('owned-child-readiness', ready, 5_000)
  const fixturePid = fixture.pid
  if (!fixturePid) {
    throw new Error('Owned fixture did not receive a PID.')
  }
  await inspectLive('owned-child-live', fixturePid)
  fixture.stdin!.end()
  const exit = await bounded('owned-child-normal-exit', fixture, 5_000)
  samples.push({ label: 'owned-child-exit', exitCode: exit.exitCode, signal: exit.signal ?? null, failed: exit.failed })
  owned.delete(fixture)
  if (exit.exitCode !== 0) {
    throw new Error('Owned fixture did not exit normally; post-exit identity collection stopped.')
  }
  await production('owned-child-exited', fixturePid)
  await powerShell('owned-child-exited', fixturePid, 'cim', 1)
  await powerShell('owned-child-exited', fixturePid, 'candidate', 1)
  report.state = 'collection-complete'
}
catch (error) {
  report.state = 'collection-failed'
  report.fatalError = redact(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
finally {
  if (fixture && owned.has(fixture)) {
    fixture.kill()
    const exit = await bounded('owned-child-failure-cleanup', fixture, 8_000)
    samples.push({ label: 'owned-child-failure-cleanup', exitCode: exit.exitCode, signal: exit.signal ?? null, failed: exit.failed })
    owned.delete(fixture)
  }
  clearTimeout(overallDeadline)
  report.finishedAt = new Date().toISOString()
  save()
  process.stdout.write(`${JSON.stringify({ state: report.state, acceptance: report.acceptance })}\n`)
}
