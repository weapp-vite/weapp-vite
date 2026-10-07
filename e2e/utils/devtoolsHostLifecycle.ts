import type { ManagedWechatHostIdentity } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/types'
import type { ResolvedWechatDevtoolsTarget } from '../../packages/weapp-ide-cli/src/devtoolsTarget'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
// eslint-disable-next-line e18e/ban-dependencies -- Windows 宿主身份只能通过 PowerShell 的 CIM 进程清单核验。
import { execa } from 'execa'
import { runWechatCliCommand } from '../../packages/weapp-ide-cli/src/cli/run-wechat-cli'
import { readManagedProcessIdentity, sameManagedProcess } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host'
import { resolveWechatDevtoolsTarget } from '../../packages/weapp-ide-cli/src/devtoolsTarget'
import { resolveWechatDevtoolsInstallationRoot } from '../../packages/weapp-ide-cli/src/devtoolsTarget/host'

const HOST_WAIT_TIMEOUT_MS = 30_000
const HOST_POLL_INTERVAL_MS = 100
const DEVTOOLS_CLI_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH'

export type DevtoolsHostState = 'cold' | 'selected' | 'foreign' | 'unknown'

export interface DevtoolsHostSnapshot {
  state: DevtoolsHostState
  identities: ManagedWechatHostIdentity[]
}

export interface DevtoolsHostLease {
  target: ResolvedWechatDevtoolsTarget
  claimedAt: string
  initial: DevtoolsHostSnapshot
}

export interface QuitClaimedDevtoolsHostOptions {
  pollIntervalMs?: number
  timeoutMs?: number
}

function lockDirectories(target: ResolvedWechatDevtoolsTarget) {
  return new Set([target.profileDir, path.dirname(target.profileDir)])
}

function parseLockPid(link: string) {
  const match = /-(\d+)$/.exec(link)
  return match ? Number(match[1]) : undefined
}

function belongsToTarget(target: ResolvedWechatDevtoolsTarget, identity: ManagedWechatHostIdentity) {
  const root = resolveWechatDevtoolsInstallationRoot(target, process.platform)
  const executable = identity.executable.replaceAll('\\', '/').replace(/\/$/, '')
  const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/, '')
  return executable === normalizedRoot || executable.startsWith(`${normalizedRoot}/`)
}

async function inspectWindowsDevtoolsHost(target: ResolvedWechatDevtoolsTarget): Promise<DevtoolsHostSnapshot> {
  let result
  try {
    result = await execa('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$ErrorActionPreference=\'Stop\'; @(Get-CimInstance Win32_Process -Filter "Name=\'wechatdevtools.exe\' OR Name=\'wechatwebdevtools.exe\'" | Select-Object ProcessId,ExecutablePath,@{Name=\'Started\';Expression={if ($_.CreationDate) {$_.CreationDate.ToUniversalTime().ToString(\'o\')} else {\'\'}}}) | ConvertTo-Json -Compress',
    ], { reject: false, windowsHide: true })
  }
  catch {
    return { state: 'unknown', identities: [] }
  }
  if (result.exitCode !== 0) {
    return { state: 'unknown', identities: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(result.stdout.trim() || '[]')
  }
  catch {
    return { state: 'unknown', identities: [] }
  }
  const entries = Array.isArray(parsed) ? parsed : [parsed]
  const identities: ManagedWechatHostIdentity[] = []
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      return { state: 'unknown', identities }
    }
    const value = entry as { ProcessId?: unknown, ExecutablePath?: unknown, Started?: unknown }
    if (typeof value.ProcessId !== 'number' || !Number.isSafeInteger(value.ProcessId) || value.ProcessId <= 0
      || typeof value.ExecutablePath !== 'string' || !value.ExecutablePath
      || typeof value.Started !== 'string' || !value.Started) {
      return { state: 'unknown', identities }
    }
    const identity = { pid: value.ProcessId, executable: value.ExecutablePath, started: value.Started }
    identities.push(identity)
    if (!belongsToTarget(target, identity)) {
      return { state: 'foreign', identities }
    }
  }
  return { state: identities.length ? 'selected' : 'cold', identities }
}

/** 读取共享 SingletonLock；锁缺失才代表可以认领，异常或未知 PID 都必须保守阻断。 */
export async function inspectDevtoolsHost(target: ResolvedWechatDevtoolsTarget): Promise<DevtoolsHostSnapshot> {
  if (process.platform === 'win32') {
    return await inspectWindowsDevtoolsHost(target)
  }
  const identities: ManagedWechatHostIdentity[] = []
  let unknown = false
  for (const directory of lockDirectories(target)) {
    let link: string
    try {
      link = await fs.readlink(`${directory}/SingletonLock`)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }
      unknown = true
      continue
    }
    const pid = parseLockPid(link)
    if (!pid) {
      unknown = true
      continue
    }
    try {
      const identity = await readManagedProcessIdentity(pid)
      if (!identity) {
        unknown = true
      }
      else {
        identities.push(identity)
        if (!belongsToTarget(target, identity)) {
          return { state: 'foreign', identities }
        }
      }
    }
    catch {
      unknown = true
    }
  }
  if (unknown) {
    return { state: 'unknown', identities }
  }
  return { state: identities.length ? 'selected' : 'cold', identities }
}

/** 只有启动前明确没有宿主时才取得本轮关闭权；手动或未知宿主直接停止当前 lane。 */
export async function claimDevtoolsHost(cliPath = process.env[DEVTOOLS_CLI_ENV]?.trim()) {
  if (!cliPath) {
    return undefined
  }
  const target = await resolveWechatDevtoolsTarget({ cliPath })
  const initial = await inspectDevtoolsHost(target)
  if (initial.state !== 'cold') {
    throw new Error(`Cannot claim WeChat DevTools host before task start: ${initial.state}. Preserve the existing host and stop the IDE lane.`)
  }
  return { target, initial, claimedAt: new Date().toISOString() } satisfies DevtoolsHostLease
}

async function assertClaimedHostGone(lease: DevtoolsHostLease, identities: ManagedWechatHostIdentity[]) {
  const current = await inspectDevtoolsHost(lease.target)
  if (current.state !== 'cold') {
    throw new Error(`WeChat DevTools quit returned but the host is still ${current.state}; preserve it and stop the IDE lane.`)
  }
  for (const identity of identities) {
    const live = await readManagedProcessIdentity(identity.pid)
    if (live && sameManagedProcess(live, identity)) {
      throw new Error('WeChat DevTools quit returned but a claimed host process is still alive.')
    }
  }
}

/** 调用官方 quit，并等待锁、宿主 PID 与 macOS 安装进程清单全部消失。 */
export async function quitClaimedDevtoolsHost(lease: DevtoolsHostLease, options: QuitClaimedDevtoolsHostOptions = {}) {
  const timeoutMs = options.timeoutMs ?? HOST_WAIT_TIMEOUT_MS
  const pollIntervalMs = options.pollIntervalMs ?? HOST_POLL_INTERVAL_MS
  const before = await inspectDevtoolsHost(lease.target)
  if (before.state === 'cold') {
    return
  }
  if (before.state !== 'selected') {
    throw new Error(`Cannot quit a WeChat DevTools host that is ${before.state}; ownership is not proven.`)
  }
  await runWechatCliCommand(['quit'], { target: lease.target, timeout: HOST_WAIT_TIMEOUT_MS })
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      await assertClaimedHostGone(lease, before.identities)
      if (process.platform === 'darwin' && lease.target.appPath.includes('/Contents/')) {
        const { inspectExitedWechatInstallation } = await import('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/processes')
        await inspectExitedWechatInstallation(lease.target)
      }
      return
    }
    catch (error) {
      lastError = error
      await sleep(pollIntervalMs)
    }
  }
  throw new Error(`WeChat DevTools host did not fully exit after quit: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}
