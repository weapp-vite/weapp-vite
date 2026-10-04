import type { ResolvedWechatDevtoolsTarget } from './index'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// 保留现有 execa 依赖，统一处理 Windows 命令解析、超时和失败输出。
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'

export interface WechatDevtoolsHostInspectionOptions {
  platform?: NodeJS.Platform
  signal?: AbortSignal
  timeout?: number
}

function ownershipError(message: string) {
  return Object.assign(new Error(message), { code: 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH' })
}

function normalize(value: string, platform: NodeJS.Platform) {
  const normalized = value.replaceAll('\\', '/').replace(/\/$/, '')
  return platform === 'win32' ? normalized.toLowerCase() : normalized
}

function assertExecutable(target: ResolvedWechatDevtoolsTarget, executable: string, platform: NodeJS.Platform) {
  const appPath = normalize(target.appPath, platform)
  const root = platform === 'darwin'
    ? appPath.split('/Contents/')[0]
    : appPath.replace(/\/(?:resources\/)?(?:app\.asar|app|package\.nw)$/, '')
  const selected = normalize(executable.trim(), platform)
  if (!root || !selected.startsWith(`${root}/`)) {
    throw ownershipError('The running WeChat DevTools host belongs to a different installation. Keep the selected installation running and retry; no host was stopped.')
  }
}

async function runInspection(file: string, args: string[], options: WechatDevtoolsHostInspectionOptions) {
  options.signal?.throwIfAborted()
  try {
    const result = await execa(file, args, { timeout: Math.min(options.timeout ?? 3_000, 3_000), cancelSignal: options.signal, reject: false, windowsHide: true })
    options.signal?.throwIfAborted()
    return result
  }
  catch (cause) {
    options.signal?.throwIfAborted()
    throw Object.assign(ownershipError('Unable to verify the running WeChat DevTools installation.'), { cause })
  }
}

async function readUnixExecutable(pid: number, options: WechatDevtoolsHostInspectionOptions) {
  if ((options.platform ?? process.platform) === 'linux') {
    options.signal?.throwIfAborted()
    try {
      const executable = await fs.readlink(`/proc/${pid}/exe`)
      options.signal?.throwIfAborted()
      return executable
    }
    catch (cause) {
      options.signal?.throwIfAborted()
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined
      }
      throw Object.assign(ownershipError('The running WeChat DevTools executable could not be verified through procfs.'), { cause })
    }
  }
  const result = await runInspection('ps', ['-p', String(pid), '-o', 'comm='], options)
  if (result.exitCode === 1 && !result.stdout.trim()) {
    return undefined
  }
  if (result.exitCode !== 0 || !result.stdout.trim()) {
    throw ownershipError('The running WeChat DevTools process identity could not be verified.')
  }
  return result.stdout.trim()
}

async function readWindowsProcesses(script: string, options: WechatDevtoolsHostInspectionOptions): Promise<{ pid: number, executable: string }[]> {
  const result = await runInspection('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], options)
  if (result.exitCode !== 0) {
    throw ownershipError('Windows could not verify the WeChat DevTools process identity.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(result.stdout.trim() || '[]')
  }
  catch (cause) {
    throw Object.assign(ownershipError('Windows returned unreadable DevTools process identities.'), { cause })
  }
  const values = Array.isArray(parsed) ? parsed : [parsed]
  return values.map((value: unknown) => {
    if (!value || typeof value !== 'object') {
      throw ownershipError('Windows returned an invalid DevTools process identity.')
    }
    const entry = value as { ProcessId?: unknown, ExecutablePath?: unknown }
    if (typeof entry.ProcessId !== 'number' || !Number.isInteger(entry.ProcessId) || entry.ProcessId <= 0
      || typeof entry.ExecutablePath !== 'string' || !entry.ExecutablePath) {
      throw ownershipError('Windows could not read the DevTools executable path.')
    }
    return { pid: entry.ProcessId, executable: entry.ExecutablePath }
  })
}

/** 启动前验证共享宿主身份；无活跃宿主可以继续，其他安装不得被隐式接管。 */
export async function assertWechatDevtoolsHost(target: ResolvedWechatDevtoolsTarget, options: WechatDevtoolsHostInspectionOptions = {}) {
  options.signal?.throwIfAborted()
  const platform = options.platform ?? process.platform
  if (platform === 'win32') {
    const entries = await readWindowsProcesses('@(Get-CimInstance Win32_Process -Filter "Name=\'wechatdevtools.exe\' OR Name=\'wechatwebdevtools.exe\'" | Select-Object ProcessId,ExecutablePath) | ConvertTo-Json -Compress', options)
    for (const entry of entries) {
      assertExecutable(target, entry.executable, platform)
    }
    return
  }
  for (const directory of new Set([path.dirname(target.profileDir), target.profileDir])) {
    let link: string
    try {
      link = await fs.readlink(path.join(directory, 'SingletonLock'))
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }
      throw ownershipError('The shared DevTools host lock could not be verified.')
    }
    const match = /-(\d+)$/.exec(link)
    if (!match) {
      throw ownershipError('The shared DevTools host lock has an unknown owner.')
    }
    const executable = await readUnixExecutable(Number(match[1]), options)
    if (executable) {
      assertExecutable(target, executable, platform)
    }
  }
}

/** HTTP 与 WebSocket 的显式端口均需由所选安装持有，端口号本身不是宿主身份。 */
export async function assertWechatDevtoolsPort(target: ResolvedWechatDevtoolsTarget, port: number, options: WechatDevtoolsHostInspectionOptions = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid WeChat DevTools port.')
  }
  options.signal?.throwIfAborted()
  const platform = options.platform ?? process.platform
  if (platform === 'win32') {
    const entries = await readWindowsProcesses(`$ErrorActionPreference='Stop'; @(Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId=$_" } | Select-Object ProcessId,ExecutablePath) | ConvertTo-Json -Compress`, options)
    if (!entries.length) {
      throw ownershipError('No verified WeChat DevTools listener owns the selected port.')
    }
    for (const entry of entries) {
      assertExecutable(target, entry.executable, platform)
    }
    return
  }
  const result = await runInspection('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], options)
  const pids = [...new Set(result.stdout.split(/\r?\n/).filter(line => /^p\d+$/.test(line)).map(line => Number(line.slice(1))))]
  if (result.exitCode !== 0 || !pids.length) {
    throw ownershipError('No verified WeChat DevTools listener owns the selected port.')
  }
  for (const pid of pids) {
    const executable = await readUnixExecutable(pid, options)
    if (!executable) {
      throw ownershipError('The selected DevTools listener exited before its identity could be verified.')
    }
    assertExecutable(target, executable, platform)
  }
}
