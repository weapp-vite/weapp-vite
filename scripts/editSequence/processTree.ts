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

export async function observeProcessTree(rootPid: number) {
  const started = performance.now()
  const windows = process.platform === 'win32'
  try {
    // 在 CIM 查询阶段就投影所需字段，避免先读取所有进程的完整属性再丢弃。
    const result = await exec(windows ? 'powershell.exe' : 'ps', windows
      ? ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance -Query "SELECT ProcessId, ParentProcessId, WorkingSetSize FROM Win32_Process" | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Json -Compress']
      : ['-axo', 'pid=,ppid=,rss='], { timeout: 10_000, throwOnError: true })
    return { ...summarizeProcessTree(parseProcessMemory(result.stdout, process.platform), rootPid), observationMs: performance.now() - started }
  }
  catch (cause) {
    throw new Error(`Process-tree memory observation failed on ${process.platform} after ${Math.round(performance.now() - started)}ms`, { cause })
  }
}
