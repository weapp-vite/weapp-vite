import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'
import type { ManagedWechatHostIdentity } from './types'
import fs from 'node:fs/promises'
import net from 'node:net'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
// eslint-disable-next-line e18e/ban-dependencies -- 项目关闭与身份检查复用跨平台子进程封装。
import { execa } from 'execa'
import { assertWechatDevtoolsPort, resolveWechatDevtoolsTarget } from '../devtoolsTarget'
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

async function listenerPid(port: number, platform = process.platform) {
  const result = platform === 'win32'
    ? await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', withPowerShellUtf8Output(`$ErrorActionPreference='Stop'; @(Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess -Unique) | ConvertTo-Json -Compress`)], windowsInspectionOptions)
    : await execa('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], inspectionOptions)
  if (result.exitCode !== 0) {
    throw invalidIdentity(result, resolveWechatInspectionTimeout(platform))
  }
  const parsed: unknown = platform === 'win32' ? JSON.parse(result.stdout.trim() || '[]') : undefined
  const pids: unknown[] = platform === 'win32'
    ? Array.isArray(parsed) ? parsed : [parsed]
    : result.stdout.split(/\r?\n/).filter(line => /^p\d+$/.test(line)).map(line => Number(line.slice(1)))
  const unique = [...new Set(pids)]
  if (unique.length !== 1 || typeof unique[0] !== 'number' || !Number.isSafeInteger(unique[0]) || unique[0] <= 0) {
    throw invalidIdentity()
  }
  return unique[0]
}

/** 所有权来自官方回执；监听身份仅用于约束后续关闭，不能单独授予所有权。 */
export async function inspectManagedProjectHost(target: ResolvedWechatDevtoolsTarget, port: number, platform = process.platform) {
  await assertWechatDevtoolsPort(target, port, { platform })
  const identity = await readManagedProcessIdentity(await listenerPid(port, platform), platform)
  if (!identity) {
    throw invalidIdentity()
  }
  return identity
}

export async function assertManagedInstallation(target: ResolvedWechatDevtoolsTarget) {
  const current = await resolveWechatDevtoolsTarget({ cliPath: target.cliPath })
  if (current.installationId !== target.installationId || current.appPath !== target.appPath
    || current.cliPath !== target.cliPath || current.profileDir !== target.profileDir
    || current.version !== target.version || current.channel !== target.channel) {
    throw new Error('Managed DevTools installation changed; no project was closed.')
  }
}

export function isManagedPortClosed(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    const finish = (error?: Error, closed = false) => {
      socket.destroy()
      if (error) {
        reject(error)
      }
      else {
        resolve(closed)
      }
    }
    socket.once('connect', () => finish())
    socket.once('error', (error: NodeJS.ErrnoException) => error.code === 'ECONNREFUSED' ? finish(undefined, true) : finish(error))
    socket.setTimeout(1_000, () => finish(new Error('Managed DevTools port probe timed out.')))
  })
}

export async function waitForManagedPortClosed(port: number, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  do {
    if (await isManagedPortClosed(port)) {
      return
    }
    await setTimeout(100)
  } while (Date.now() < deadline)
  throw new Error('Managed DevTools project close returned but its automator port remained open.')
}
