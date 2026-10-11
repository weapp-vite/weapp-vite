import type { ManagedWechatHostIdentity } from './types'
import fs from 'node:fs/promises'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 身份检查只依赖 Node 与跨平台进程封装，准备构建前也可加载。
import { execa } from 'execa'
import { resolveWechatInspectionTimeout } from '../devtoolsTarget/inspection'
import { withPowerShellUtf8Output } from '../utils/powershell'

const inspectionOptions = { timeout: 3_000, reject: false, windowsHide: true } as const
const windowsInspectionOptions = { ...inspectionOptions, timeout: resolveWechatInspectionTimeout('win32') }

function invalidIdentity(result?: { exitCode?: number, signal?: string, timedOut?: boolean }, timeout?: number) {
  const details = result
    ? ` Inspection: exitCode=${result.exitCode ?? 'none'}, signal=${result.signal ?? 'none'}, timedOut=${result.timedOut ?? false}, timeoutMs=${timeout}.`
    : ''
  return new Error(`Managed DevTools process identity could not be verified; no project was closed.${details}`)
}

/** PID 必须连同启动时间和可执行文件核验；进程号复用不继承所有权。 */
export async function readManagedProcessIdentity(pid: number, platform = process.platform): Promise<ManagedWechatHostIdentity | undefined> {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw invalidIdentity()
  }
  if (platform === 'win32') {
    const result = await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', withPowerShellUtf8Output(`$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object ProcessId,ExecutablePath,@{Name='Started';Expression={$_.CreationDate.ToUniversalTime().ToString('o')}} | ConvertTo-Json -Compress`)], windowsInspectionOptions)
    if (result.exitCode !== 0) {
      throw invalidIdentity(result, windowsInspectionOptions.timeout)
    }
    if (!result.stdout.trim()) {
      return undefined
    }
    const value: unknown = JSON.parse(result.stdout)
    if (!value || typeof value !== 'object' || !('ProcessId' in value) || value.ProcessId !== pid
      || !('ExecutablePath' in value) || typeof value.ExecutablePath !== 'string' || !value.ExecutablePath
      || !('Started' in value) || typeof value.Started !== 'string' || !value.Started) {
      throw invalidIdentity()
    }
    return { pid, executable: value.ExecutablePath, started: value.Started }
  }
  if (platform === 'linux') {
    try {
      const [executable, stat] = await Promise.all([
        fs.readlink(`/proc/${pid}/exe`),
        fs.readFile(`/proc/${pid}/stat`, 'utf8'),
      ])
      const boot = await fs.readFile('/proc/sys/kernel/random/boot_id', 'utf8').catch(() => {
        throw invalidIdentity()
      })
      const started = stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/)[19]
      if (!started || !/^\d+$/.test(started) || !boot.trim()) {
        throw invalidIdentity()
      }
      return { pid, executable, started: `${boot.trim()}:${started}` }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined
      }
      throw error
    }
  }
  const result = await execa('ps', ['-p', String(pid), '-o', 'lstart=', '-o', 'comm='], { ...inspectionOptions, env: { LC_ALL: 'C' } })
  if (result.exitCode === 1 && !result.stdout.trim()) {
    return undefined
  }
  const match = /^(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(\S[^\r\n]*)$/.exec(result.stdout.trim())
  if (result.exitCode !== 0 || !match) {
    throw invalidIdentity()
  }
  return { pid, started: match[1]!.replace(/\s+/g, ' '), executable: match[2]!.trim() }
}

export function sameManagedProcess(first: ManagedWechatHostIdentity, second: ManagedWechatHostIdentity) {
  return first.pid === second.pid && first.started === second.started && first.executable === second.executable
}
