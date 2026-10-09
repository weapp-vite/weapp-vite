/* eslint-disable e18e/ban-dependencies -- 关停需要跨平台命令调用与 execa 子进程类型。 */
import type { Subprocess } from 'execa'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { execa } from 'execa'

// 内层 suiteRunner 需要 5 秒终止独立任务组，外层多留 5 秒用于退出和日志收尾。
const COMMAND_SHUTDOWN_GRACE_MS = 10_000
const COMMAND_KILL_VERIFY_MS = 2_000

export class OwnedCommandShutdownError extends Error {}

function hasProcessGroup(pid: number) {
  try {
    process.kill(-pid, 0)
    return true
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
      return false
    }
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      return undefined
    }
    throw error
  }
}

async function hasRunningProcessGroup(pid: number, leaderExited: boolean) {
  const present = hasProcessGroup(pid)
  if (present === false) {
    return false
  }
  if (present && !leaderExited) {
    return true
  }
  // Linux 容器的 init 可能延迟回收孤儿僵尸；它们已无法执行任务或登记窗口。
  const { stdout } = await execa('ps', ['-axo', 'pgid=,stat='], { stdin: 'ignore' })
  return stdout.split(/\r?\n/).some((line) => {
    const [group, state] = line.trim().split(/\s+/)
    return Number(group) === pid && state && !state.startsWith('Z')
  })
}

export async function stopOwnedCommand(child: Subprocess, platform: NodeJS.Platform) {
  const pid = child.pid
  if (pid === undefined) {
    return
  }
  if (platform === 'win32') {
    // Windows 必须在父子关系仍存在时枚举树；退出后的 PID 不能证明后代已经消失。
    if (child.nodeChildProcess.exitCode !== null || child.nodeChildProcess.signalCode !== null) {
      throw new Error('E2E command exited before its Windows process tree could be verified; preserve the journal and stop the acceptance lane.')
    }
    const result = await execa('taskkill', ['/PID', String(pid), '/T', '/F'], { reject: false, stdio: 'ignore' })
    if (result.exitCode !== 0) {
      throw new Error('E2E command process tree termination was not confirmed; preserve the journal and stop the acceptance lane.')
    }
    return
  }

  child.kill('SIGTERM')
  const deadline = Date.now() + COMMAND_SHUTDOWN_GRACE_MS
  const running = () => hasRunningProcessGroup(pid, child.nodeChildProcess.exitCode !== null || child.nodeChildProcess.signalCode !== null)
  while (await running()) {
    if (Date.now() >= deadline) {
      // 直接子进程提前退出也不能取消该组的强杀；只操作本次 execa 创建的 PGID。
      child.kill('SIGKILL')
      const verificationDeadline = Date.now() + COMMAND_KILL_VERIFY_MS
      while (await running()) {
        if (Date.now() >= verificationDeadline) {
          throw new Error('E2E command process group is still running; preserve the journal and stop the acceptance lane.')
        }
        await setTimeout(25)
      }
      return
    }
    await setTimeout(25)
  }
}

/** 只核验本次创建的 Unix 进程组；未证明停止时不能进入父日志清理。 */
export async function assertOwnedCommandStopped(child: Subprocess, platform = process.platform) {
  if (platform === 'win32' || child.pid === undefined) {
    return
  }
  try {
    const deadline = Date.now() + COMMAND_KILL_VERIFY_MS
    while (await hasRunningProcessGroup(child.pid, child.nodeChildProcess.exitCode !== null || child.nodeChildProcess.signalCode !== null)) {
      if (Date.now() >= deadline) {
        throw new Error('E2E command has live process group members.')
      }
      await setTimeout(25)
    }
  }
  catch (error) {
    throw new OwnedCommandShutdownError('E2E command stop could not be confirmed; preserve the journal and stop the acceptance lane.', { cause: error })
  }
}

/** 直接子进程退出与所持进程组关停分别等待，不能由 execa 的内部计时器代替。 */
export async function waitForOwnedCommand(child: Subprocess, signal?: AbortSignal, platform = process.platform) {
  let shutdown: Promise<void> | undefined
  let shutdownError: unknown
  const cancel = () => {
    shutdown ??= stopOwnedCommand(child, platform).catch((error: unknown) => {
      shutdownError = new OwnedCommandShutdownError('E2E command shutdown is unconfirmed; preserve the journal and stop the acceptance lane.', { cause: error })
    })
  }
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) {
    cancel()
  }
  try {
    let commandError: unknown
    const result = await child.catch((error: unknown) => {
      commandError = error
    })
    await shutdown
    if (shutdownError) {
      throw shutdownError
    }
    await assertOwnedCommandStopped(child, platform)
    if (commandError) {
      throw commandError
    }
    if (!result) {
      throw new Error('E2E command did not return its exit status.')
    }
    return result
  }
  finally {
    signal?.removeEventListener('abort', cancel)
  }
}
