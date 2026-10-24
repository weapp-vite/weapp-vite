import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'
import net from 'node:net'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
// eslint-disable-next-line e18e/ban-dependencies -- 项目关闭与身份检查复用跨平台子进程封装。
import { execa } from 'execa'
import { assertWechatDevtoolsPort } from '../devtoolsTarget'
import { resolveWechatInspectionTimeout } from '../devtoolsTarget/inspection'
import { inspectWechatDevtoolsInstallation } from '../devtoolsTarget/installation'
import { withPowerShellUtf8Output } from '../utils/powershell'
import { readManagedProcessIdentity } from './processIdentity'

export { readManagedProcessIdentity, sameManagedProcess } from './processIdentity'

const inspectionOptions = { timeout: 3_000, reject: false, windowsHide: true } as const
const windowsInspectionOptions = { ...inspectionOptions, timeout: resolveWechatInspectionTimeout('win32') }

function invalidIdentity(result?: { exitCode?: number, signal?: string, timedOut?: boolean }, timeout?: number) {
  const details = result
    ? ` Inspection: exitCode=${result.exitCode ?? 'none'}, signal=${result.signal ?? 'none'}, timedOut=${result.timedOut ?? false}, timeoutMs=${timeout}.`
    : ''
  return new Error(`Managed DevTools process identity could not be verified; no project was closed.${details}`)
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
  // 官方选版在入口完成；本地所有权复核必须重读磁盘，不能依赖网络或活动选择缓存。
  const current = await inspectWechatDevtoolsInstallation(target.cliPath)
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
