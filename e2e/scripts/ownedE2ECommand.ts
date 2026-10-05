/* eslint-disable e18e/ban-dependencies -- 聚合入口需要 execa 的跨平台取消和进程组回收。 */
import type { Options } from 'execa'
import { execa } from 'execa'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { cleanupManagedWechatProjects, MANAGED_PROJECT_JOURNAL_ENV } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { createDevtoolsProjectJournal } from '../utils/devtoolsProcessOwnership'
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
    const childScope = await lease.createChildScope()
    const journalPath = await createDevtoolsProjectJournal()
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
    // 先封存后核查，避免进程组退出但独立子任务仍活着，或快照之后才登记借用。
    await childScope.seal()
    const shutdownError = commandErrors.find(error => error instanceof OwnedCommandShutdownError)
    if (shutdownError) {
      throw shutdownError
    }
    try {
      await cleanupManagedWechatProjects({ journalPath, scope: 'journal' })
      await childScope.complete()
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
