import assert from 'node:assert/strict'
import process from 'node:process'
import { withMachineE2ELease } from '../../../packages/devtools-runtime/src/lease/machine'
import { INHERITED_LEASE_ENV } from '../../../packages/devtools-runtime/src/lease/machineScope'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { runOwnedE2ECommand } from '../ownedE2ECommand'
import { REPO_ROOT } from './context'
import { runNestedLifecycleWorker } from './nestedRunner/worker'
import { runLifecycleChecks } from './run'
import { runLifecycleWorker } from './worker'

/** 独立入口也由父任务持有资源；内部模式必须继承机器租约和精确项目日志。 */
export async function runLifecycleEntry(scriptPath: string, args: string[], signal: AbortSignal) {
  if (!args.length) {
    return await runOwnedE2ECommand(process.execPath, ['--import', 'tsx', scriptPath, '--run'], { cwd: REPO_ROOT, signal })
  }

  assert((args[0] === '--run' && args.length === 1) || (['--worker', '--nested-runner'].includes(args[0]!) && args.length === 2), 'Only internal lifecycle modes are supported')
  assert(process.env[INHERITED_LEASE_ENV]?.trim(), 'Internal lifecycle mode requires its inherited machine lease')
  assert(process.env[MANAGED_PROJECT_JOURNAL_ENV]?.trim(), 'Internal lifecycle mode requires its explicit task journal')
  return await withMachineE2ELease(async () => {
    if (args[0] === '--worker') {
      await runLifecycleWorker(args[1])
    }
    else if (args[0] === '--nested-runner') {
      await runNestedLifecycleWorker(args[1])
    }
    else {
      await runLifecycleChecks(signal, scriptPath)
    }
    return 0
  })
}
