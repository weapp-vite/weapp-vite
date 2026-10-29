import type { ManagedWechatHostIdentity } from './types'
// eslint-disable-next-line e18e/ban-dependencies -- 身份核验使用系统只读进程查询，不启动或关闭 IDE。
import { execa } from 'execa'
import { readDarwinKernelPaths } from './installationExit/darwinKernelPaths'

const inspectionTimeoutMs = 3_000

type InspectionStage = 'request' | 'before' | 'kernel' | 'after' | 'complete'

function invalidIdentity(stage: InspectionStage, reason: string, details: Record<string, boolean | number | string> = {}, cause?: unknown) {
  return new Error(`Managed DevTools process identity could not be verified; no project was closed. ${JSON.stringify({ stage, reason, ...details })}`, { cause })
}

async function readStarted(pids: number[], remaining: () => number, stage: 'before' | 'after') {
  const result = await execa('/bin/ps', ['-p', pids.join(','), '-o', 'pid=,stat=,lstart='], {
    timeout: remaining(),
    reject: false,
    env: { LC_ALL: 'C' },
  })
  remaining()
  if (result.timedOut || result.signal || result.stderr?.trim() || (result.exitCode === 0 && !result.stdout.trim())
    || (result.exitCode !== 0 && !(result.exitCode === 1 && !result.stdout.trim()))) {
    throw invalidIdentity(stage, 'birth-query-failed', { requestedCount: pids.length })
  }
  const started = new Map<number, { started: string, zombie: boolean }>()
  for (const line of result.stdout.split(/\r?\n/).filter(line => line.trim())) {
    const match = /^\s*(\d+)\s+(\S+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s*$/.exec(line)
    const pid = Number(match?.[1])
    if (!match || !pids.includes(pid) || started.has(pid)) {
      throw invalidIdentity(stage, 'invalid-birth-inventory', { requestedCount: pids.length })
    }
    started.set(pid, { started: match[3]!.replace(/\s+/g, ' '), zombie: match[2]!.startsWith('Z') })
  }
  return started
}

/** 批量读取内核路径，并以前后启动时间绑定 PID；进程标题变化不改变身份。 */
export async function readDarwinManagedProcessIdentities(pids: number[]): Promise<Map<number, ManagedWechatHostIdentity | undefined>> {
  if (pids.some(pid => !Number.isSafeInteger(pid) || pid <= 0)) {
    throw invalidIdentity('request', 'invalid-pid')
  }
  const requested = [...new Set(pids)]
  const identities = new Map<number, ManagedWechatHostIdentity | undefined>(requested.map(pid => [pid, undefined]))
  if (!requested.length) {
    return identities
  }
  const deadline = performance.now() + inspectionTimeoutMs
  let stage: InspectionStage = 'before'
  const remaining = () => {
    const timeout = Math.floor(deadline - performance.now())
    if (timeout <= 0) {
      throw invalidIdentity(stage, 'deadline-exceeded', { requestedCount: requested.length })
    }
    return timeout
  }
  const before = await readStarted(requested, remaining, 'before')
  if (!before.size) {
    return identities
  }
  stage = 'kernel'
  const paths = await readDarwinKernelPaths([...before.keys()], remaining()).catch((cause: unknown) => {
    throw invalidIdentity('kernel', 'kernel-query-failed', { requestedCount: before.size }, cause)
  })
  stage = 'after'
  const after = await readStarted(requested, remaining, 'after')
  for (const pid of requested) {
    const current = after.get(pid)
    if (!current) {
      continue
    }
    const executable = paths.get(pid)
    const previous = before.get(pid)
    if (previous?.started !== current.started) {
      throw invalidIdentity('after', 'birth-changed', { pid, beforePresent: before.has(pid), afterPresent: true })
    }
    // 终态进程已无可执行映像；仅两次同身份终态证据允许撤权，不能向它发信号。
    if (previous.zombie && current.zombie) {
      continue
    }
    if (previous.zombie !== current.zombie) {
      throw invalidIdentity('after', 'terminal-state-changed', { pid, beforeZombie: previous.zombie, afterZombie: current.zombie })
    }
    if (!executable?.startsWith('/')) {
      throw invalidIdentity('after', 'kernel-path-unavailable', { pid, beforePresent: true, afterPresent: true, kernelPath: executable ? 'non-absolute' : 'empty' })
    }
    identities.set(pid, { pid, started: current.started, executable })
  }
  stage = 'complete'
  remaining()
  return identities
}
