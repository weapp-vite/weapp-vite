import type { ProcessEntry } from './windowsProcessTree'
import process from 'node:process'

interface WindowsGenerationRow {
  pid: number
  ppid: number
  started: string | null
  identityStarted: string | null
  identityPresent: boolean
  executablePresent: boolean
}

export interface WindowsProcessQueryObservation {
  query: 'snapshot' | 'identities'
  requestedPids: number[] | null
  startedAt: string
  completedAt: string
  status: 'returned' | 'failed'
  exitCode: number | null
  signal: string | null
  timedOut: boolean | null
}

interface WindowsProcessReinspectionObservation {
  requestedPids: number[]
  startedAt: string
  completedAt: string | null
  status: 'pending' | 'returned' | 'failed'
  rows: WindowsGenerationRow[] | null
}

interface WindowsProcessGenerationGuard {
  stage: string
  subjectPid: number
  entry: WindowsGenerationRow | null
  ancestorPath: WindowsGenerationRow[]
  parentGeneration100ns: string | null
  childrenPids: number[]
}

export interface WindowsProcessGenerationDiagnostics {
  schemaVersion: 1
  capturedAt: string
  rootPid: number
  nativeErrorCodeAvailable: false
  guard: WindowsProcessGenerationGuard
  initialRows: WindowsGenerationRow[]
  resolvedRows: WindowsGenerationRow[]
  reinspections: WindowsProcessReinspectionObservation[]
  queries: WindowsProcessQueryObservation[]
}

/** 诊断输出失败不能覆盖原始树核验错误。 */
export function reportWindowsGenerationDiagnostic(diagnostic: WindowsProcessGenerationDiagnostics) {
  try {
    process.stdout.write(`[e2e-cleanup-windows-generation] ${JSON.stringify(diagnostic)}\n`)
  }
  catch {
    // 保留原始树核验错误；输出不参与授权或重试。
  }
}

function describeEntry(entry: ProcessEntry): WindowsGenerationRow {
  return {
    pid: entry.pid,
    ppid: entry.ppid,
    // 原始七位小数保留 100ns；恢复身份仍由原 candidates 契约规整。
    started: entry.started ?? null,
    identityStarted: entry.identity?.started ?? null,
    identityPresent: entry.identity != null,
    executablePresent: Boolean(entry.identity?.executable),
  }
}

/** 只保留调用方已知的查询回执，不记录全机 stdout、stderr 或任意错误文本。 */
export async function observeWindowsProcessQuery<T extends { exitCode?: number, signal?: string, timedOut?: boolean }>(
  pids: number[] | undefined,
  observations: WindowsProcessQueryObservation[] | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  if (!observations) {
    return operation()
  }
  const startedAt = new Date().toISOString()
  const requestedPids = pids ? [...pids] : null
  try {
    const result = await operation()
    observations.push({
      query: pids ? 'identities' : 'snapshot',
      requestedPids,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'returned',
      exitCode: result.exitCode ?? null,
      signal: result.signal ?? null,
      timedOut: result.timedOut ?? null,
    })
    return result
  }
  catch (error) {
    observations.push({
      query: pids ? 'identities' : 'snapshot',
      requestedPids,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'failed',
      exitCode: null,
      signal: null,
      timedOut: null,
    })
    throw error
  }
}

/** 诊断仅观察原有遍历和复核，不增加查询，不参与进程授权。 */
export function createWindowsGenerationDiagnosticCapture(
  rootPid: number,
  entries: readonly ProcessEntry[],
  queries: readonly WindowsProcessQueryObservation[] = [],
) {
  const capturedAt = new Date().toISOString()
  const reinspections: WindowsProcessReinspectionObservation[] = []
  let guard: WindowsProcessGenerationGuard = {
    stage: 'root-generation',
    subjectPid: rootPid,
    entry: null,
    ancestorPath: [],
    parentGeneration100ns: null,
    childrenPids: entries.filter(entry => entry.ppid === rootPid).map(entry => entry.pid),
  }
  return {
    guard(stage: string, entry: ProcessEntry, ancestors: readonly ProcessEntry[], parentStarted?: bigint) {
      guard = {
        stage,
        subjectPid: entry.pid,
        entry: describeEntry(entry),
        ancestorPath: [...ancestors, entry].map(describeEntry),
        parentGeneration100ns: parentStarted?.toString() ?? null,
        childrenPids: entries.filter(candidate => candidate.ppid === entry.pid).map(candidate => candidate.pid),
      }
    },
    async reinspect(pids: number[], operation: (pids: number[]) => Promise<ProcessEntry[]>) {
      const observation: WindowsProcessReinspectionObservation = {
        requestedPids: [...pids],
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: 'pending',
        rows: null,
      }
      reinspections.push(observation)
      try {
        const current = await operation(pids)
        observation.status = 'returned'
        observation.rows = current.map(describeEntry)
        return current
      }
      catch (error) {
        observation.status = 'failed'
        throw error
      }
      finally {
        observation.completedAt = new Date().toISOString()
      }
    },
    finish(candidates: readonly ProcessEntry[], resolved: readonly ProcessEntry[]): WindowsProcessGenerationDiagnostics {
      const relevantPids = new Set([rootPid, ...candidates.map(entry => entry.pid), ...guard.ancestorPath.map(entry => entry.pid)])
      return {
        schemaVersion: 1,
        capturedAt,
        rootPid,
        // 当前 native protocol 未提供逐行 Win32 错误码，不能把缺失值当作成功。
        nativeErrorCodeAvailable: false,
        guard,
        initialRows: entries.filter(entry => relevantPids.has(entry.pid)).map(describeEntry),
        resolvedRows: resolved.filter(entry => relevantPids.has(entry.pid)).map(describeEntry),
        reinspections,
        queries: queries.map(query => ({ ...query, requestedPids: query.requestedPids && [...query.requestedPids] })),
      }
    },
  }
}
