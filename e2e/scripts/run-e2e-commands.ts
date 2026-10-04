/* eslint-disable e18e/ban-dependencies -- E2E 聚合入口使用 execa 保留跨平台参数边界并解析 pnpm.cmd。 */
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { execa } from 'execa'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'

/** 多个入口命令共享完整租约，任何子命令失败后都停止后续执行。 */
export async function runE2ECommands(args: string[], signal?: AbortSignal) {
  const commands: string[][] = [[]]
  for (const arg of args) {
    if (arg === '--next') {
      commands.push([])
    }
    else {
      commands.at(-1)!.push(arg)
    }
  }
  if (commands.some(command => command.length === 0)) {
    throw new Error('E2E command sequence contains an empty command.')
  }
  return await withMachineE2ELease(async (lease) => {
    for (const [command, ...argv] of commands) {
      if (signal?.aborted) {
        return 1
      }
      const result = await execa(command!, argv, {
        cwd: path.resolve(import.meta.dirname, '../..'),
        env: lease.environment,
        stdio: 'inherit',
        reject: false,
        cancelSignal: signal,
        killDescendants: true,
        forceKillAfterDelay: 5_000,
      })
      if (signal?.aborted) {
        return 1
      }
      if (result.exitCode !== 0) {
        return result.exitCode ?? 1
      }
    }
    return 0
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const controller = new AbortController()
  let interrupted: number | undefined
  const onInterrupt = () => {
    interrupted = 130
    controller.abort()
  }
  const onTerminate = () => {
    interrupted = 143
    controller.abort()
  }
  process.once('SIGINT', onInterrupt)
  process.once('SIGTERM', onTerminate)
  try {
    const code = await runE2ECommands(process.argv.slice(2), controller.signal)
    process.exitCode = interrupted ?? code
  }
  finally {
    process.off('SIGINT', onInterrupt)
    process.off('SIGTERM', onTerminate)
  }
}
