import type { ManagedWechatHostIdentity } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 仅查询已登记监听进程的父链，不授予关闭权。
import { execa } from 'execa'
import { errorText, isRecord } from './context'

interface ProcessRow {
  pid: number
  parentPid: number
  executable: string
}

async function readProcessRow(pid: number): Promise<ProcessRow | undefined> {
  const options = { timeout: 3_000, reject: false, windowsHide: true } as const
  if (process.platform === 'win32') {
    const result = await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object ProcessId,ParentProcessId,ExecutablePath | ConvertTo-Json -Compress`], options)
    if (result.exitCode !== 0) {
      throw new Error(`Process inspection failed: ${result.stderr}`)
    }
    const value: unknown = JSON.parse(result.stdout.trim() || 'null')
    if (value === null) {
      return undefined
    }
    if (!isRecord(value) || value.ProcessId !== pid || typeof value.ParentProcessId !== 'number' || typeof value.ExecutablePath !== 'string') {
      throw new Error('Process inspection returned an invalid identity')
    }
    return { pid, parentPid: value.ParentProcessId, executable: value.ExecutablePath }
  }
  const result = await execa('ps', ['-p', String(pid), '-o', 'pid=', '-o', 'ppid=', '-o', 'comm='], options)
  if (result.exitCode === 1 && !result.stdout.trim()) {
    return undefined
  }
  const match = /^(\d+)\s+(\d+)\s+(\S[^\r\n]*)$/.exec(result.stdout.trim())
  if (result.exitCode !== 0 || !match || Number(match[1]) !== pid) {
    throw new Error('Process inspection returned an invalid identity')
  }
  return { pid, parentPid: Number(match[2]), executable: match[3]!.trim() }
}

/** 端口监听者可能是 backend；父链仅为诊断证据，不能冒充项目窗口身份。 */
export async function inspectListenerAncestors(identity: ManagedWechatHostIdentity | undefined) {
  const ancestors: ProcessRow[] = []
  const seen = new Set<number>()
  let pid = identity?.pid
  try {
    while (pid && pid > 0 && !seen.has(pid) && ancestors.length < 16) {
      seen.add(pid)
      const row = await readProcessRow(pid)
      if (!row) {
        break
      }
      ancestors.push(row)
      pid = row.parentPid
    }
    return { listener: identity, ancestors, windowIdentityVerified: false }
  }
  catch (error) {
    return { listener: identity, ancestors, windowIdentityVerified: false, diagnosticError: errorText(error) }
  }
}
