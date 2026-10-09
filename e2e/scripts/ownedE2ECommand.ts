/* eslint-disable e18e/ban-dependencies -- 聚合入口需要 execa 的跨平台取消和进程组回收。 */
import type { Options } from 'execa'
import { execa } from 'execa'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { createDevtoolsProjectJournal } from '../utils/devtoolsProcessOwnership'
import { cleanupDevtoolsCommandScope } from '../utils/devtoolsScopeCleanup'
import { OwnedCommandShutdownError, waitForOwnedCommand } from './ownedE2ECommand/shutdown'

interface OwnedE2ECommandOptions {
  cwd?: string
  env?: Options['env']
  signal?: AbortSignal
}

/** 最外层入口也持有子任务日志；子任务被强制终止后仍须完成窗口回收再退出。 */
export async function runOwnedE2ECommand(command: string, args: string[], options: OwnedE2ECommandOptions = {}) {
  return await withMachineE2ELease(async (lease) => {
    if (options.signal?.aborted) {
      return 1
    }
    const journalPath = await createDevtoolsProjectJournal()
    const childScope = await lease.createChildScope({ cleanupKey: journalPath })
    const commandErrors: unknown[] = []
    let exitCode = 1
    try {
      if (!options.signal?.aborted) {
        const child = execa(command, args, {
          cwd: options.cwd,
          env: { ...options.env, ...childScope.environment, [MANAGED_PROJECT_JOURNAL_ENV]: journalPath },
          stdio: 'inherit',
          reject: false,
          killDescendants: true,
          killSignal: 'SIGKILL',
          forceKillAfterDelay: false,
        })
        const result = await waitForOwnedCommand(child, options.signal)
        exitCode = result.exitCode ?? 1
      }
    }
    catch (error) {
      commandErrors.push(error)
    }
    const shutdownError = commandErrors.find(error => error instanceof OwnedCommandShutdownError)
    if (shutdownError) {
      try {
        await childScope.seal()
      }
      catch (error) {
        throw new AggregateError([...commandErrors, error], 'E2E command shutdown and scope sealing are incomplete.')
      }
      throw shutdownError
    }
    try {
      await cleanupDevtoolsCommandScope(childScope, journalPath)
    }
    catch (error) {
      throw new AggregateError([...commandErrors, error], 'E2E command project cleanup is incomplete; stop the acceptance lane.')
    }
    if (commandErrors.length) {
      throw commandErrors[0]
    }
    return options.signal?.aborted ? 1 : exitCode
  })
}
