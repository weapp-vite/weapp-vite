import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { runOwnedE2ECommand } from './ownedE2ECommand'
import { createSuiteSignalScope } from './suiteRunner/signals'

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
      const exitCode = await runOwnedE2ECommand(command!, argv, {
        cwd: path.resolve(import.meta.dirname, '../..'),
        env: lease.environment,
        signal,
      })
      if (signal?.aborted) {
        return 1
      }
      if (exitCode !== 0) {
        return exitCode
      }
    }
    return 0
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const scope = createSuiteSignalScope()
  try {
    const code = await runE2ECommands(process.argv.slice(2), scope.signal)
    process.exitCode = scope.exitCode ?? code
  }
  finally {
    scope.dispose()
  }
}
