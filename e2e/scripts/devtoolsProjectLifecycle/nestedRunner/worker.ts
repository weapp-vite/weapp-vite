import assert from 'node:assert/strict'
import process from 'node:process'
import { acquireMachineE2ELease } from '../../../../packages/devtools-runtime/src/lease/machine'
import { withMachineLeaseContext } from '../../../../packages/devtools-runtime/src/lease/machineContext'
import { INHERITED_LEASE_ENV } from '../../../../packages/devtools-runtime/src/lease/machineScope'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { resolveWechatDevtoolsTarget } from '../../../../packages/weapp-ide-cli/src/devtoolsTarget'
import { runTaskSuite } from '../../suiteRunner'
import { openLifecycleSession, sessionEvidence } from '../context'
import { parseWorkerOptions } from '../worker'
import { NESTED_READY_PREFIX, readNestedRunnerScopes } from './evidence'

function holdUntilCancelled(signal: AbortSignal): Promise<never> {
  signal.throwIfAborted()
  return new Promise((_, reject) => {
    const timer = setInterval(() => {}, 1000)
    signal.addEventListener('abort', () => {
      clearInterval(timer)
      reject(signal.reason)
    }, { once: true })
  })
}

/** 真实 suite runner 建立子 scope；任务与 runner 同进程，强退后不留下未经父句柄持有的孙进程。 */
export async function runNestedLifecycleWorker(raw: string | undefined) {
  const options = parseWorkerOptions(raw)
  assert(process.env[MANAGED_PROJECT_JOURNAL_ENV]?.trim(), 'Nested runner requires its explicit task journal')
  const code = await runTaskSuite('devtools-lifecycle-nested-runner', [{
    label: 'owned-IDE-window-until-runner-SIGKILL',
    command: process.execPath,
    args: [],
  }], {
    writeReport: false,
    runTask: async (task, signal) => {
      assert(task.env, 'Real suite runner must provide its child scope environment')
      const journalPath = task.env[MANAGED_PROJECT_JOURNAL_ENV]
      assert(journalPath, 'Real suite runner must provide its child journal')
      const borrowed = await acquireMachineE2ELease({ env: task.env })
      const previousEnvironment = {
        [MANAGED_PROJECT_JOURNAL_ENV]: process.env[MANAGED_PROJECT_JOURNAL_ENV],
        [INHERITED_LEASE_ENV]: process.env[INHERITED_LEASE_ENV],
      }
      const errors: unknown[] = []
      process.env[MANAGED_PROJECT_JOURNAL_ENV] = journalPath
      // CLI 的 dist 入口有独立上下文；子凭证也显式传给该入口和其子进程。
      process.env[INHERITED_LEASE_ENV] = borrowed.environment[INHERITED_LEASE_ENV]
      try {
        await withMachineLeaseContext(borrowed, async () => {
          const target = await resolveWechatDevtoolsTarget({ cliPath: options.cliPath })
          assert.equal(target.version, options.selectedVersion)
          const session = await openLifecycleSession(target, options.projectPath, options.sdkVersion, signal)
          const state = await readNestedRunnerScopes(task.env!)
          assert.equal(session.journalPath, journalPath)
          const scope = state.scopes.find(value => value.id === state.scopeId)
          assert(scope && !scope.sealed && !scope.completed && scope.cleanupKey === journalPath)
          process.stdout.write(`${NESTED_READY_PREFIX}${JSON.stringify({ pid: process.pid, ...sessionEvidence(session), scope })}\n`)
          await holdUntilCancelled(signal)
        }, { env: task.env })
      }
      catch (error) {
        errors.push(error)
      }
      finally {
        for (const [key, value] of Object.entries(previousEnvironment)) {
          if (value === undefined) {
            delete process.env[key]
          }
          else {
            process.env[key] = value
          }
        }
        try {
          await borrowed.release()
        }
        catch (error) {
          errors.push(error)
        }
      }
      if (errors.length) {
        throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Nested lifecycle task and borrower cleanup failed')
      }
      throw new Error('Nested lifecycle runner must remain alive until its parent terminates it')
    },
  })
  throw new Error(`Nested lifecycle suite returned before parent SIGKILL: ${code}`)
}
