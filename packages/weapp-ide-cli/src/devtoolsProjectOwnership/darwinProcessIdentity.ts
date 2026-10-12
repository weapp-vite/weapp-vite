import type { ManagedWechatHostIdentity } from './types'
// eslint-disable-next-line e18e/ban-dependencies -- 身份核验使用系统只读进程查询，不启动或关闭 IDE。
import { execa } from 'execa'
import { readDarwinKernelPaths } from './installationExit/darwinKernelPaths'

const inspectionTimeoutMs = 3_000

function invalidIdentity() {
  return new Error('Managed DevTools process identity could not be verified; no project was closed.')
}

async function readStarted(pids: number[], remaining: () => number) {
  const result = await execa('/bin/ps', ['-p', pids.join(','), '-o', 'pid=,lstart='], {
    timeout: remaining(),
    reject: false,
    env: { LC_ALL: 'C' },
  })
  remaining()
  if (result.timedOut || result.signal || result.stderr?.trim() || (result.exitCode === 0 && !result.stdout.trim())
    || (result.exitCode !== 0 && !(result.exitCode === 1 && !result.stdout.trim()))) {
    throw invalidIdentity()
  }
  const started = new Map<number, string>()
  for (const line of result.stdout.split(/\r?\n/).filter(line => line.trim())) {
    const match = /^\s*(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s*$/.exec(line)
    const pid = Number(match?.[1])
    if (!match || !pids.includes(pid) || started.has(pid)) {
      throw invalidIdentity()
    }
    started.set(pid, match[2]!.replace(/\s+/g, ' '))
  }
  return started
}

/** 批量读取内核路径，并以前后启动时间绑定 PID；进程标题变化不改变身份。 */
export async function readDarwinManagedProcessIdentities(pids: number[]): Promise<Map<number, ManagedWechatHostIdentity | undefined>> {
  if (pids.some(pid => !Number.isSafeInteger(pid) || pid <= 0)) {
    throw invalidIdentity()
  }
  const requested = [...new Set(pids)]
  const identities = new Map<number, ManagedWechatHostIdentity | undefined>(requested.map(pid => [pid, undefined]))
  if (!requested.length) {
    return identities
  }
  const deadline = performance.now() + inspectionTimeoutMs
  const remaining = () => {
    const timeout = Math.floor(deadline - performance.now())
    if (timeout <= 0) {
      throw invalidIdentity()
    }
    return timeout
  }
  const before = await readStarted(requested, remaining)
  if (!before.size) {
    return identities
  }
  const paths = await readDarwinKernelPaths([...before.keys()], remaining())
  const after = await readStarted(requested, remaining)
  for (const pid of requested) {
    const started = after.get(pid)
    if (!started) {
      continue
    }
    const executable = paths.get(pid)
    if (before.get(pid) !== started || !executable?.startsWith('/')) {
      throw invalidIdentity()
    }
    identities.set(pid, { pid, started, executable })
  }
  remaining()
  return identities
}
