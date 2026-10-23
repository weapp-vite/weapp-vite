import { Buffer } from 'node:buffer'
import { performance } from 'node:perf_hooks'

type QueryStage = 'script-enter' | 'parent-query-start' | 'parent-query-end' | 'children-query-start' | 'children-query-end'

interface StageMarker {
  stage: QueryStage
  elapsedMs: number
  utcMs: number
}

interface QueryDiagnostic {
  elapsedMs: number
  stage: QueryStage | 'before-script-entry-or-unobserved'
  code?: string
  signal?: string
  status?: number
  startupMs?: number
  parentQueryMs?: number
  childrenQueryMs?: number
  activeQueryMs?: number
}

const diagnostics = new WeakMap<object, QueryDiagnostic>()
const MARKER_PREFIX = '[weapp-vite:upload-process-tree:v1]'
const MARKER_RE = /^\[weapp-vite:upload-process-tree:v1\] (script-enter|parent-query-start|parent-query-end|children-query-start|children-query-end) (\d{1,9}) (\d{1,16})$/
const ERROR_CODES = new Set(['ETIMEDOUT', 'ENOENT', 'EACCES', 'EPERM', 'ENOBUFS', 'EIO', 'UNKNOWN'])
const SIGNALS = new Set(['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGABRT'])

/** 标记只写入诊断管道，不进入供清理使用的 PID 输出。 */
export const WINDOWS_PROCESS_TREE_DIAGNOSTIC_SETUP = '$wvTreeClock = [Diagnostics.Stopwatch]::StartNew(); '
  + 'function Write-WvTreeStage([string]$stage) { '
  + `[Console]::Error.WriteLine('${MARKER_PREFIX} ' + $stage + ' ' + $wvTreeClock.ElapsedMilliseconds + ' ' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) }; `

export function processTreeStageCommand(stage: QueryStage): string {
  return `Write-WvTreeStage '${stage}'; `
}

function readMarkers(stderr: unknown, elapsedMs: number): StageMarker[] {
  const text = Buffer.isBuffer(stderr)
    ? stderr.subarray(0, 8192).toString('utf8')
    : typeof stderr === 'string'
      ? Buffer.from(stderr.slice(0, 8192)).subarray(0, 8192).toString('utf8')
      : ''
  const markers: StageMarker[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = MARKER_RE.exec(line)
    if (!match) {
      continue
    }
    const elapsed = Number(match[2])
    const utc = Number(match[3])
    if (!Number.isSafeInteger(elapsed) || elapsed > elapsedMs || !Number.isSafeInteger(utc) || markers.length >= 8) {
      return []
    }
    markers.push({ stage: match[1] as QueryStage, elapsedMs: elapsed, utcMs: utc })
  }
  const expected = markers[1]?.stage === 'parent-query-start'
    ? ['script-enter', 'parent-query-start', 'parent-query-end', 'children-query-start', 'children-query-end']
    : ['script-enter', 'children-query-start', 'children-query-end']
  return markers.every((marker, index) => marker.stage === expected[index]
    && marker.elapsedMs >= (markers[index - 1]?.elapsedMs ?? 0))
    ? markers
    : []
}

function describeQuery(error: object, elapsedMs: number, utcStart: number, utcEnd: number): QueryDiagnostic {
  const failure = error as { stderr?: unknown, code?: unknown, signal?: unknown, status?: unknown }
  const markers = readMarkers(failure.stderr, elapsedMs)
  const first = markers[0]
  const last = markers.at(-1)
  const result: QueryDiagnostic = { elapsedMs, stage: last?.stage ?? 'before-script-entry-or-unobserved' }
  if (typeof failure.code === 'string' && ERROR_CODES.has(failure.code)) {
    result.code = failure.code
  }
  if (typeof failure.signal === 'string' && SIGNALS.has(failure.signal)) {
    result.signal = failure.signal
  }
  if (typeof failure.status === 'number' && Number.isSafeInteger(failure.status)) {
    result.status = failure.status
  }
  // 跨时钟只提供有一致性证据的估计；跳变或缺少标记时不把总耗时归咎于启动。
  const startupMs = first && first.utcMs - utcStart
  if (first && startupMs !== undefined && startupMs >= 0 && startupMs <= elapsedMs
    && Math.abs(utcEnd - utcStart - elapsedMs) <= 5
    && markers.every(marker => Math.abs(marker.utcMs - first.utcMs - (marker.elapsedMs - first.elapsedMs)) <= 5)) {
    result.startupMs = startupMs
    if (last?.stage === 'parent-query-start' || last?.stage === 'children-query-start') {
      result.activeQueryMs = Math.max(0, elapsedMs - startupMs - (last.elapsedMs - first.elapsedMs))
    }
  }
  for (const [name, key] of [['parent', 'parentQueryMs'], ['children', 'childrenQueryMs']] as const) {
    const start = markers.find(marker => marker.stage === `${name}-query-start`)
    const end = markers.find(marker => marker.stage === `${name}-query-end`)
    if (start && end) {
      result[key] = end.elapsedMs - start.elapsedMs
    }
  }
  return result
}

/** 只附带标量诊断，保持清理失败的原始异常身份与控制流。 */
export function observeWindowsProcessTreeQuery(run: () => string): string {
  const startedAt = performance.now()
  const utcStart = Date.now()
  try {
    return run()
  }
  catch (error) {
    if (error && typeof error === 'object') {
      const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt))
      diagnostics.set(error, { elapsedMs, stage: 'before-script-entry-or-unobserved' })
      try {
        diagnostics.set(error, describeQuery(error, elapsedMs, utcStart, Date.now()))
      }
      catch {
        // 诊断提取失败不能覆盖原始进程错误。
      }
    }
    throw error
  }
}

/** Windows 查询只展示白名单诊断，不能回显异常中携带的命令或原始 stderr。 */
export function describeUploadProcessTreeError(error: unknown): string {
  const diagnostic = error && typeof error === 'object' ? diagnostics.get(error) : undefined
  return diagnostic ? `PowerShell 进程归属查询失败 ${JSON.stringify(diagnostic)}` : String(error)
}
