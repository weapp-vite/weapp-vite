import type { ChildProcess } from 'node:child_process'
import type { EventEmitter } from 'node:events'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { exec } from 'tinyexec'

export interface ProcessMemory {
  pid: number
  parentPid: number
  rssBytes: number
}

/** 只读取进程编号、父子关系与 RSS；不采集命令行、环境变量或其他任务内容。 */
export function parseProcessMemory(output: string, platform: string): ProcessMemory[] {
  if (platform === 'win32') {
    const parsed: unknown = JSON.parse(output)
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows.map((row: Record<string, unknown>) => ({ pid: Number(row.ProcessId), parentPid: Number(row.ParentProcessId), rssBytes: Number(row.WorkingSetSize) }))
  }
  return output.trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const [pid, parentPid, rssKiB] = line.trim().split(/\s+/).map(Number)
    return { pid: pid!, parentPid: parentPid!, rssBytes: rssKiB! * 1024 }
  })
}

/** 保留各进程原始样本；只有从登记根 PID 可达的子进程计入总量。 */
export function summarizeProcessTree(rows: ProcessMemory[], rootPid: number) {
  if (rows.some(row => !Number.isInteger(row.pid) || !Number.isInteger(row.parentPid) || !Number.isFinite(row.rssBytes) || row.rssBytes < 0)) {
    throw new Error('Invalid process memory observation')
  }
  const pids = new Set([rootPid])
  let size = 0
  while (size !== pids.size) {
    size = pids.size
    for (const row of rows) {
      if (pids.has(row.parentPid)) {
        pids.add(row.pid)
      }
    }
  }
  const members = rows.filter(row => pids.has(row.pid))
  if (!members.some(row => row.pid === rootPid)) {
    throw new Error('Observed worker exited before process-tree measurement')
  }
  return { rssBytes: members.reduce((sum, row) => sum + row.rssBytes, 0), processCount: members.length, members }
}

// Windows PowerShell 每次启动都会重新编译内嵌的 Toolhelp helper；在模块加载阶段预热并
// 缓存临时 assembly，避免首次真实采样把编译冷启动计入既有 10 秒查询期限。
// eslint-disable-next-line node/prefer-global/process -- 使用真实宿主平台，避免平台模拟测试触发 PowerShell 预热。
const windowsRuntimeReady = globalThis.process.platform === 'win32'
  ? (async () => {
      const script = await readFile(new URL('./windowsProcessTree.ps1', import.meta.url), 'utf8')
      const encoded = Buffer.from(`& {\n${script}\n} -Warm`, 'utf16le').toString('base64')
      await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { timeout: 30_000, throwOnError: true })
    })()
  : Promise.resolve()

interface ProcessDiagnostics {
  phases: { phase: string, elapsedMs?: number, receivedMs?: number }[]
  execStartedMs?: number
  execReturnedMs?: number
  spawnMs?: number
  stdoutEndMs?: number
  stdoutCloseMs?: number
  errorMs?: number
  exit?: { receivedMs?: number, code?: number | null, signal?: string | null }
  close?: { receivedMs?: number, code?: number | null, signal?: string | null }
}

function safeMilliseconds(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : undefined
}

/** 仅保留有界的白名单阶段和进程事件；不读取 stdout，也不输出原始诊断内容。 */
function captureProcessDiagnostics(child: ChildProcess, started: number, timings: ProcessDiagnostics) {
  const removers: (() => void)[] = []
  const offset = () => safeMilliseconds(Math.round(performance.now() - started))
  let pending = ''
  let discardLine = false
  const recordPhase = (line: string) => {
    const match = /^process-tree:(script-enter|helper-cache-hit|helper-compile|helper-ready|query-complete|json-pipeline-returned)(?: elapsedMs=(\d+(?:\.\d+)?))?$/.exec(line)
    if (!match || timings.phases.length >= 16) {
      return
    }
    const elapsedMs = match[2] === undefined ? undefined : safeMilliseconds(Number(match[2]))
    if (match[2] !== undefined && elapsedMs === undefined) {
      return
    }
    timings.phases.push({ phase: match[1]!, elapsedMs, receivedMs: offset() })
  }
  const capture = (chunk: Buffer | string) => {
    const text = String(chunk)
    let start = 0
    while (start < text.length) {
      const end = text.indexOf('\n', start)
      const part = text.slice(start, end === -1 ? undefined : end)
      if (!discardLine) {
        if (pending.length + part.length > 256) {
          pending = ''
          discardLine = true
        }
        else {
          pending += part
        }
      }
      if (end === -1) {
        break
      }
      if (!discardLine) {
        recordPhase(pending.replace(/\r$/, ''))
      }
      pending = ''
      discardLine = false
      start = end + 1
    }
  }
  const status = (code: unknown, signal: unknown) => ({
    receivedMs: offset(),
    code: code === null ? null : typeof code === 'number' && Number.isInteger(code) && code >= 0 && code <= 0xFFFFFFFF ? code : undefined,
    signal: signal === null ? null : typeof signal === 'string' && ['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGABRT', 'SIGBREAK', 'SIGHUP', 'SIGQUIT'].includes(signal) ? signal : undefined,
  })
  const listen = <T extends unknown[]>(emitter: EventEmitter, event: string, listener: (...args: T) => void) => {
    emitter.on(event, listener)
    removers.push(() => emitter.off(event, listener))
  }
  try {
    if (child.stderr) {
      listen(child.stderr, 'data', capture)
      listen(child.stderr, 'end', () => {
        if (!discardLine) {
          recordPhase(pending.replace(/\r$/, ''))
        }
        pending = ''
      })
    }
    if (child.stdout) {
      listen(child.stdout, 'end', () => {
        timings.stdoutEndMs = offset()
      })
      listen(child.stdout, 'close', () => {
        timings.stdoutCloseMs = offset()
      })
    }
    listen(child, 'spawn', () => {
      timings.spawnMs = offset()
    })
    listen(child, 'error', () => {
      timings.errorMs = offset()
    })
    listen(child, 'exit', (code: unknown, signal: unknown) => {
      timings.exit = status(code, signal)
    })
    listen(child, 'close', (code: unknown, signal: unknown) => {
      timings.close = status(code, signal)
    })
  }
  catch {
    // 被动诊断登记失败不改变采样结果或原始错误。
  }
  return () => {
    for (const remove of removers) {
      try {
        remove()
      }
      catch {
        // 每个订阅独立释放，诊断收尾不能覆盖原始错误。
      }
    }
  }
}

export async function observeProcessTree(rootPid: number) {
  if (!Number.isSafeInteger(rootPid) || rootPid <= 0 || rootPid > 0xFFFFFFFF) {
    throw new Error('Invalid process-tree root PID')
  }
  const windows = process.platform === 'win32'
  if (windows) {
    await windowsRuntimeReady
  }
  const started = performance.now()
  const timings: ProcessDiagnostics = { phases: [] }
  let removeDiagnostics: (() => void) | undefined
  try {
    const script = windows ? await readFile(new URL('./windowsProcessTree.ps1', import.meta.url), 'utf8') : undefined
    // 编码整个固定脚本与已校验的 PID，避免路径空格、引号或终端编码参与命令解析。
    const encoded = script ? Buffer.from(`& {\n${script}\n} -RootProcessId ${rootPid}`, 'utf16le').toString('base64') : undefined
    timings.execStartedMs = safeMilliseconds(Math.round(performance.now() - started))
    const query = exec(windows ? 'powershell.exe' : 'ps', windows
      ? ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded!]
      : ['-axo', 'pid=,ppid=,rss='], { timeout: 10_000, throwOnError: true })
    timings.execReturnedMs = safeMilliseconds(Math.round(performance.now() - started))
    if (windows && query.process) {
      removeDiagnostics = captureProcessDiagnostics(query.process, started, timings)
    }
    const result = await query
    return { ...summarizeProcessTree(parseProcessMemory(result.stdout, process.platform), rootPid), observationMs: performance.now() - started }
  }
  catch (cause) {
    const phases = timings.phases.map(event => event.phase)
    throw new Error(`Process-tree memory observation failed on ${process.platform} after ${Math.round(performance.now() - started)}ms; phases=${JSON.stringify(phases)}${windows ? `; timings=${JSON.stringify(timings)}` : ''}`, { cause })
  }
  finally {
    removeDiagnostics?.()
  }
}
