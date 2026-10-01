import type { ChildProcess } from 'node:child_process'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'

const disposals = new WeakMap<ChildProcess, Promise<void>>()

export function resolveLiveCliPid(child: Pick<ChildProcess, 'pid' | 'exitCode' | 'signalCode'>) {
  return child.exitCode === null && child.signalCode === null ? child.pid : undefined
}

function signalOwnedGroup(child: ChildProcess, signal: NodeJS.Signals) {
  const pid = resolveLiveCliPid(child)
  if (!pid || pid <= 0) {
    return
  }
  try {
    process.kill(-pid, signal)
  }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
      throw error
    }
  }
}

async function waitForOwnedExit(child: ChildProcess) {
  const deadline = Date.now() + 1_500
  while (resolveLiveCliPid(child) && Date.now() < deadline) {
    await new Promise<void>(resolve => setTimeout(resolve, 120))
  }
}

async function terminate(child: ChildProcess) {
  const pid = resolveLiveCliPid(child)
  if (!pid || pid <= 0) {
    return
  }
  if (process.platform === 'win32') {
    // Windows 的 cmd 启动器需要按仍持有的子进程清理整棵 CLI 子树。
    const result = await execa('taskkill', ['/PID', String(pid), '/T', '/F'], {
      reject: false,
      timeout: 5_000,
      windowsHide: true,
    })
    if (result.exitCode !== 0 && result.exitCode !== 128) {
      throw new Error(`Failed to terminate automator CLI process tree: exit=${result.exitCode}`)
    }
    return
  }
  signalOwnedGroup(child, 'SIGTERM')
  await waitForOwnedExit(child)
  if (resolveLiveCliPid(child)) {
    signalOwnedGroup(child, 'SIGKILL')
    await waitForOwnedExit(child)
  }
  if (resolveLiveCliPid(child)) {
    throw new Error('Owned automator CLI did not exit after termination')
  }
}

/** 仅启动方可用其持有的子进程对象释放 CLI，不接受跨进程传回的 PID 快照。 */
export function terminateOwnedCliProcess(child: ChildProcess): Promise<void> {
  let disposal = disposals.get(child)
  if (!disposal) {
    disposal = terminate(child)
    disposals.set(child, disposal)
  }
  return disposal
}
