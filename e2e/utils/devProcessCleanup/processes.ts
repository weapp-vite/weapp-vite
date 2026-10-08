import type { ManagedWechatHostIdentity } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/types'
import type { ProcessEntry } from './windowsProcessTree'
import fs from 'node:fs/promises'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 受管进程发现和 Windows 精确终止复用跨平台子进程封装。
import { execa } from 'execa'
import { readManagedProcessIdentity, sameManagedProcess } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host'
import { resolveWechatInspectionTimeout } from '../../../packages/weapp-ide-cli/src/devtoolsTarget/inspection'
import { traceCleanupStage } from '../cleanupTrace'
import { collectWindowsProcessTree, UnconfirmedDevProcessTreeError } from './windowsProcessTree'
import { createWindowsProcessQueryCommand, reportWindowsQueryTrace } from './windowsQueryTrace'

export { type DevProcessCandidate, UnconfirmedDevProcessTreeError } from './windowsProcessTree'

export type DevProcessIdentity = ManagedWechatHostIdentity

function inspectionError() {
  return new Error('Dev process identity could not be verified; no unverified process was signalled.')
}

async function readWindowsProcesses(pids?: number[]): Promise<ProcessEntry[]> {
  if (pids?.length === 0) {
    return []
  }
  const filter = ` -Filter '${pids ? pids.map(pid => `ProcessId=${pid}`).join(' OR ') : 'ProcessId > 0'}'`
  const timeoutMs = resolveWechatInspectionTimeout('win32')
  const trace = process.env.WEAPP_VITE_E2E_CLEANUP_TRACE === '1'
  const diagnosticStdin = process.env.WEAPP_VITE_E2E_CLEANUP_QUERY_STDIN
  if (diagnosticStdin !== undefined && (!trace || (diagnosticStdin !== 'pipe' && diagnosticStdin !== 'ignore'))) {
    throw new Error('Windows query stdin diagnosis requires tracing and pipe or ignore.')
  }
  const result = await traceCleanupStage(pids ? 'dev-cim-identities' : 'dev-cim-snapshot', () => execa('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    createWindowsProcessQueryCommand(filter, trace),
  ], { stdin: diagnosticStdin, timeout: timeoutMs, reject: false, windowsHide: true }), { processCount: pids?.length, timeoutMs })
  if (trace) {
    reportWindowsQueryTrace(pids ? 'identities' : 'snapshot', result, diagnosticStdin ?? 'pipe')
  }
  if (result.exitCode !== 0) {
    throw new Error(`Dev process inspection failed: exitCode=${result.exitCode ?? 'none'}, signal=${result.signal ?? 'none'}, timedOut=${result.timedOut ?? false}.`)
  }
  const value: unknown = JSON.parse(result.stdout.trim() || '[]')
  const entries: unknown[] = Array.isArray(value) ? value : [value]
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object'
      || !('ProcessId' in entry) || typeof entry.ProcessId !== 'number' || !Number.isSafeInteger(entry.ProcessId) || entry.ProcessId <= 0
      || !('ParentProcessId' in entry) || typeof entry.ParentProcessId !== 'number' || !Number.isSafeInteger(entry.ParentProcessId) || entry.ParentProcessId < 0) {
      throw inspectionError()
    }
    const identity = 'ExecutablePath' in entry && typeof entry.ExecutablePath === 'string' && entry.ExecutablePath
      && 'Started' in entry && typeof entry.Started === 'string' && entry.Started
      ? { pid: entry.ProcessId, executable: entry.ExecutablePath, started: entry.Started }
      : undefined
    return { pid: entry.ProcessId, ppid: entry.ParentProcessId, identity, started: 'Started' in entry && typeof entry.Started === 'string' ? entry.Started : undefined }
  })
}

async function readMacProcesses(): Promise<ProcessEntry[]> {
  const result = await execa('ps', ['-Ao', 'pid=,ppid=,lstart=,comm='], { stdin: 'ignore', timeout: 3_000, env: { LC_ALL: 'C' } })
  return result.stdout.split(/\r?\n/).filter(line => line.trim()).map((line) => {
    const match = /^(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(\S[^\r\n]*)$/.exec(line.trim())
    if (!match) {
      throw inspectionError()
    }
    const pid = Number(match[1])
    const ppid = Number(match[2])
    if (!Number.isSafeInteger(pid) || pid < 0 || !Number.isSafeInteger(ppid)) {
      throw inspectionError()
    }
    return { pid, ppid, identity: { pid, started: match[3]!.replace(/\s+/g, ' '), executable: match[4]!.trim() } }
  }).filter(entry => entry.pid > 0)
}

/** 同一份 stat 同时绑定父 PID 与启动 tick，防止发现树后把复用 PID 的外部进程登记进来。 */
async function readLinuxProcesses(): Promise<ProcessEntry[]> {
  const boot = (await fs.readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim()
  if (!boot) {
    throw inspectionError()
  }
  const names = (await fs.readdir('/proc')).filter(name => /^\d+$/.test(name))
  const entries = await Promise.all(names.map(async (name): Promise<ProcessEntry | undefined> => {
    try {
      const stat = await fs.readFile(`/proc/${name}/stat`, 'utf8')
      const pid = Number(stat.slice(0, stat.indexOf('(')).trim())
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/)
      const ppid = fields[1]
      const started = fields[19]
      if (pid !== Number(name) || !Number.isSafeInteger(pid) || pid <= 0 || !ppid || !/^\d+$/.test(ppid) || !started || !/^\d+$/.test(started)) {
        throw inspectionError()
      }
      return { pid, ppid: Number(ppid), started: `${boot}:${started}` }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'ESRCH') {
        return undefined
      }
      throw error
    }
  }))
  return entries.filter((entry): entry is ProcessEntry => entry != null)
}

function collectProcessTree(rootPid: number, entries: ProcessEntry[]) {
  const seen = new Set<number>()
  const result: ProcessEntry[] = []
  const visit = (pid: number) => {
    if (seen.has(pid)) {
      throw inspectionError()
    }
    seen.add(pid)
    for (const entry of entries.filter(entry => entry.ppid === pid)) {
      visit(entry.pid)
    }
    const entry = entries.find(entry => entry.pid === pid)
    if (entry) {
      result.push(entry)
    }
  }
  visit(rootPid)
  return result
}

/** 只在直接子进程句柄仍存活时登记后代；根退出后不能从相同 PID 重新发现树。 */
export async function captureDevProcessTree(rootPid: number, isRootHeld: () => boolean): Promise<DevProcessIdentity[]> {
  const windows = process.platform === 'win32'
  const entries = windows ? await readWindowsProcesses() : process.platform === 'linux' ? await readLinuxProcesses() : await readMacProcesses()
  const tree = windows ? await collectWindowsProcessTree(rootPid, entries, readWindowsProcesses) : collectProcessTree(rootPid, entries)
  const descendants = tree.filter(entry => entry.pid !== rootPid).map(entry => ({
    pid: entry.pid,
    started: entry.identity?.started ?? entry.started,
    executable: entry.identity?.executable,
  }))
  if (!isRootHeld()) {
    if (descendants.length) {
      throw new UnconfirmedDevProcessTreeError(descendants)
    }
    return []
  }
  let identities: (DevProcessIdentity | undefined)[]
  try {
    identities = await Promise.all(tree.map(async (entry) => {
      if (!windows) {
        const identity = await readManagedProcessIdentity(entry.pid)
        if (identity && (entry.identity ? !sameManagedProcess(entry.identity, identity) : entry.started !== identity.started)) {
          throw inspectionError()
        }
        return identity
      }
      if (!entry.identity) {
        throw inspectionError()
      }
      return entry.identity
    }))
  }
  catch (error) {
    if (descendants.length) {
      throw new UnconfirmedDevProcessTreeError(descendants, { cause: error })
    }
    throw error
  }
  if (!isRootHeld()) {
    if (descendants.length) {
      throw new UnconfirmedDevProcessTreeError(descendants)
    }
    return []
  }
  if (!identities.some(identity => identity?.pid === rootPid)) {
    const error = inspectionError()
    if (descendants.length) {
      throw new UnconfirmedDevProcessTreeError(descendants, { cause: error })
    }
    throw error
  }
  return identities.filter((identity): identity is DevProcessIdentity => identity != null)
}

/** Windows 每轮只启动一次 CIM 查询；空结果代表退出，缺少身份字段代表检查失败。 */
export async function readDevProcessIdentities(pids: number[]): Promise<Map<number, DevProcessIdentity | undefined>> {
  if (process.platform !== 'win32') {
    return new Map(await Promise.all(pids.map(async pid => [pid, await readManagedProcessIdentity(pid)] as const)))
  }
  const entries = await readWindowsProcesses(pids)
  return new Map(pids.map((pid) => {
    const entry = entries.find(entry => entry.pid === pid)
    if (entry && !entry.identity) {
      throw inspectionError()
    }
    return [pid, entry?.identity]
  }))
}

/** ESRCH 才证明进程消失；权限或其他检查错误不能转换成退出成功。 */
export function isDevProcessAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
      return false
    }
    throw error
  }
}

/** 只终止本轮已核验的 PID；不用 /T 在派发时扩大到未登记的后代。 */
export async function killWindowsDevProcesses(pids: number[]) {
  if (!pids.length) {
    return
  }
  const timeoutMs = resolveWechatInspectionTimeout('win32')
  const result = await traceCleanupStage('dev-taskkill', () => execa('taskkill', [...pids.flatMap(pid => ['/PID', String(pid)]), '/F'], {
    reject: false,
    stdin: 'ignore',
    timeout: timeoutMs,
    windowsHide: true,
  }), { processCount: pids.length, timeoutMs })
  if (result.exitCode !== 0) {
    throw new Error(`Dev process termination failed: exitCode=${result.exitCode ?? 'none'}.`)
  }
}
