/* eslint-disable e18e/ban-dependencies -- 睡眠抑制器通过 execa 持有独立的受控进程。 */
import { once } from 'node:events'
import process from 'node:process'
import { execa } from 'execa'

export function createSleepInhibitorCommand(platform: NodeJS.Platform = process.platform, ownerPid = process.pid) {
  return platform === 'darwin' ? { command: 'caffeinate', args: ['-dimsu', '-w', String(ownerPid)] } : undefined
}

/** 抑制器只观察当前 owner；独立进程组避免终端取消提前中断资源收尾。 */
export async function startSleepInhibitor(platform: NodeJS.Platform = process.platform) {
  const invocation = createSleepInhibitorCommand(platform)
  if (!invocation) {
    return
  }
  const child = execa(invocation.command, invocation.args, {
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
    detached: true,
    cleanup: false,
    killDescendants: false,
    forceKillAfterDelay: 1_000,
    reject: false,
  })
  let closing = false
  const failure = child.then((result) => {
    if (!closing || !['SIGTERM', 'SIGKILL'].includes(result.signal ?? '')) {
      return new Error('E2E sleep inhibitor exited before its owned cleanup completed.', { cause: result })
    }
  }, (error: unknown) => new Error('E2E sleep inhibitor process failed.', { cause: error }))
  await once(child.nodeChildProcess, 'spawn')
  console.log('[e2e:sleep-inhibitor] caffeinate -dimsu enabled')
  let cleanup: Promise<void> | undefined
  return {
    failure,
    close() {
      cleanup ??= (async () => {
        closing = child.nodeChildProcess.exitCode === null && child.nodeChildProcess.signalCode === null
        child.kill('SIGTERM')
        const error = await failure
        if (error) {
          throw error
        }
      })()
      return cleanup
    },
  }
}
