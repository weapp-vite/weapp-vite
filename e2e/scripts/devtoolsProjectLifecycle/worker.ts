import type { Buffer } from 'node:buffer'
import type { SessionEvidence } from './context'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
// eslint-disable-next-line e18e/ban-dependencies -- 仅终止本验证创建的 worker，跨平台且不终止其子孙或共享 IDE。
import { execa } from 'execa'
import { cleanupManagedWechatProjects, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { resolveWechatDevtoolsTarget } from '../../../packages/weapp-ide-cli/src/devtoolsTarget'
import { createDevtoolsProjectJournal } from '../../utils/devtoolsProcessOwnership'
import { assertJournalReleased, assertSessionReleased, isRecord, openLifecycleSession, REPO_ROOT, sessionEvidence, START_TIMEOUT } from './context'

const READY_PREFIX = 'DEVTOOLS_LIFECYCLE_WORKER_READY:'

export interface WorkerOptions {
  projectPath: string
  cliPath: string
  sdkVersion: string
  selectedVersion: string
}

interface WorkerRecoveryEvidence {
  worker: SessionEvidence & { pid: number }
  killed: { signal?: string, exitCode?: number }
  cleanup: Awaited<ReturnType<typeof assertSessionReleased>>
  journal: Awaited<ReturnType<typeof assertJournalReleased>>
}

export function parseWorkerOptions(raw: string | undefined): WorkerOptions {
  const value: unknown = JSON.parse(raw || 'null')
  assert(isRecord(value), 'Lifecycle worker requires a JSON payload')
  for (const key of ['projectPath', 'cliPath', 'sdkVersion', 'selectedVersion']) {
    assert(typeof value[key] === 'string' && value[key], `Missing worker ${key}`)
  }
  return value as unknown as WorkerOptions
}

/** 仅父进程明确创建的 worker 会进入此入口；就绪后保持存活，等待父进程模拟意外退出。 */
export async function runLifecycleWorker(raw: string | undefined) {
  const options = parseWorkerOptions(raw)
  assert(process.env[MANAGED_PROJECT_JOURNAL_ENV]?.trim(), 'Worker requires its explicit task journal')
  await withMachineE2ELease(async () => {
    const target = await resolveWechatDevtoolsTarget({ cliPath: options.cliPath })
    assert.equal(target.version, options.selectedVersion)
    const session = await openLifecycleSession(target, options.projectPath, options.sdkVersion)
    process.stdout.write(`${READY_PREFIX}${JSON.stringify({ pid: process.pid, ...sessionEvidence(session) })}\n`)
    await new Promise<never>(() => {
      // 不注册退出清理，明确验证 worker 被 SIGKILL 后父进程的恢复路径。
      setInterval(() => {}, 1000)
    })
  })
}

function parseReadyLine(line: string): SessionEvidence & { pid: number } {
  const value: unknown = JSON.parse(line.slice(READY_PREFIX.length))
  assert(isRecord(value) && typeof value.pid === 'number' && typeof value.port === 'number' && Number.isInteger(value.port), 'Worker returned an invalid process or port')
  assert(typeof value.id === 'string' && typeof value.journalPath === 'string' && typeof value.projectPath === 'string', 'Worker returned incomplete ownership evidence')
  assert(isRecord(value.info) && typeof value.info.version === 'string' && typeof value.info.SDKVersion === 'string', 'Worker returned incomplete runtime evidence')
  return value as unknown as SessionEvidence & { pid: number }
}

/** 只 kill 当前创建的子进程句柄，随后由独立日志回收其确认拥有的窗口。 */
export async function checkKilledWorker(options: WorkerOptions & {
  scriptPath: string
  journalPath: string
  runDirectory: string
  signal: AbortSignal
}) {
  options.signal.throwIfAborted()
  const workerJournal = await createDevtoolsProjectJournal(options.journalPath)
  options.signal.throwIfAborted()
  const ready = Promise.withResolvers<SessionEvidence & { pid: number }>()
  const child = execa(process.execPath, ['--import', 'tsx', options.scriptPath, '--worker', JSON.stringify({
    projectPath: options.projectPath,
    cliPath: options.cliPath,
    sdkVersion: options.sdkVersion,
    selectedVersion: options.selectedVersion,
  })], {
    cwd: REPO_ROOT,
    env: { ...process.env, [MANAGED_PROJECT_JOURNAL_ENV]: workerJournal },
    reject: false,
    killDescendants: false,
  })
  let exited = false
  const completion = child.then((result) => {
    exited = true
    return result
  }, (error: unknown) => {
    exited = true
    throw error
  })
  void completion.catch(() => {})
  let pendingOutput = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    pendingOutput += chunk.toString('utf8')
    const lines = pendingOutput.split(/\r?\n/)
    pendingOutput = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith(READY_PREFIX)) {
        try {
          ready.resolve(parseReadyLine(line))
        }
        catch (error) {
          ready.reject(error)
        }
      }
    }
  })
  const onAbort = () => ready.reject(options.signal.reason)
  options.signal.addEventListener('abort', onAbort, { once: true })
  if (options.signal.aborted) {
    onAbort()
  }
  const timer = setTimeout(() => ready.reject(new Error('Lifecycle worker did not report ready before its deadline')), START_TIMEOUT + 30_000)
  const errors: unknown[] = []
  let recovered: WorkerRecoveryEvidence | undefined
  try {
    const evidence = await Promise.race([
      ready.promise,
      completion.then(result => Promise.reject(new Error(`Lifecycle worker exited before ready: ${result.exitCode ?? result.signal}`))),
    ])
    assert.equal(evidence.pid, child.pid, 'Ready message must belong to the created worker')
    assert.equal(evidence.journalPath, workerJournal)
    const record = (await readManagedWechatProjectRecords(workerJournal)).find(value => value.id === evidence.id)
    assert.equal(record?.ownerPid, child.pid, 'Worker must own the recorded launch')
    assert.equal(record?.state, 'owned')
    assert.equal(evidence.info.version, options.selectedVersion)
    assert.equal(evidence.info.SDKVersion, options.sdkVersion)
    assert(child.kill('SIGKILL'), 'Created worker must accept SIGKILL while it is alive')
    const killed = await completion
    assert.equal(killed.signal, 'SIGKILL', 'Worker recovery must follow an actual SIGKILL exit')
    await cleanupManagedWechatProjects({ journalPath: workerJournal, scope: 'journal' })
    recovered = { worker: evidence, killed: { signal: killed.signal, exitCode: killed.exitCode }, cleanup: await assertSessionReleased(evidence), journal: await assertJournalReleased(workerJournal) }
  }
  catch (error) {
    errors.push(error)
  }
  finally {
    clearTimeout(timer)
    options.signal.removeEventListener('abort', onAbort)
    if (!exited) {
      child.kill('SIGKILL')
    }
    const result = await completion.catch(() => undefined)
    try {
      await fs.writeFile(path.join(options.runDirectory, 'worker.log'), result ? `STDOUT\n${result.stdout}\nSTDERR\n${result.stderr}\n` : 'Worker process failed before output could be collected.\n')
    }
    catch (error) {
      errors.push(error)
    }
    try {
      await cleanupManagedWechatProjects({ journalPath: workerJournal, scope: 'journal' })
    }
    catch (error) {
      errors.push(error)
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Worker recovery or evidence persistence did not complete')
  }
  assert(recovered, 'Worker must complete journal recovery')
  return recovered
}
