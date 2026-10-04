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

export async function observeProcessTree(rootPid: number) {
  if (!Number.isSafeInteger(rootPid) || rootPid <= 0 || rootPid > 0xFFFFFFFF) {
    throw new Error('Invalid process-tree root PID')
  }
  const windows = process.platform === 'win32'
  if (windows) {
    await windowsRuntimeReady
  }
  const started = performance.now()
  try {
    const script = windows ? await readFile(new URL('./windowsProcessTree.ps1', import.meta.url), 'utf8') : undefined
    // 编码整个固定脚本与已校验的 PID，避免路径空格、引号或终端编码参与命令解析。
    const encoded = script ? Buffer.from(`& {\n${script}\n} -RootProcessId ${rootPid}`, 'utf16le').toString('base64') : undefined
    const result = await exec(windows ? 'powershell.exe' : 'ps', windows
      ? ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded!]
      : ['-axo', 'pid=,ppid=,rss='], { timeout: 10_000, throwOnError: true })
    return { ...summarizeProcessTree(parseProcessMemory(result.stdout, process.platform), rootPid), observationMs: performance.now() - started }
  }
  catch (cause) {
    throw new Error(`Process-tree memory observation failed on ${process.platform} after ${Math.round(performance.now() - started)}ms`, { cause })
  }
}
