import type { MachineE2EChildScope } from '../packages/devtools-runtime/src/lease/machine'
import process from 'node:process'
import { acquireMachineE2ELease } from '../packages/devtools-runtime/src/lease/machine'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { createDevtoolsProjectJournal } from './utils/devtoolsProcessOwnership'
import { cleanupDevtoolsCommandScope } from './utils/devtoolsScopeCleanup'

/** 预检与 worker 共用已绑定窗口日志的命令作用域，资源未清理时保留机器租约。 */
export default async function setup() {
  const lease = await acquireMachineE2ELease()
  const keys = [...new Set([...Object.keys(lease.environment), MANAGED_PROJECT_JOURNAL_ENV])]
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  const restoreEnvironment = () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      }
      else {
        process.env[key] = value
      }
    }
  }
  let journalPath: string
  let childScope: MachineE2EChildScope
  try {
    journalPath = await createDevtoolsProjectJournal()
    childScope = await lease.createChildScope({ cleanupKey: journalPath })
    Object.assign(process.env, childScope.environment, { [MANAGED_PROJECT_JOURNAL_ENV]: journalPath })
  }
  catch (error) {
    restoreEnvironment()
    try {
      await lease.release()
    }
    catch (releaseError) {
      throw new AggregateError([error, releaseError], 'E2E global setup failed and machine lease cleanup did not complete.', { cause: error })
    }
    throw error
  }

  let teardown: Promise<void> | undefined
  return () => {
    teardown ??= (async () => {
      const errors: unknown[] = []
      // 子 scope 封存后不能再借用；显式发布仍持有的父凭证，兼容源码与 dist 的独立上下文。
      Object.assign(process.env, lease.environment)
      try {
        await cleanupDevtoolsCommandScope(childScope, journalPath)
      }
      catch (error) {
        errors.push(error)
      }
      finally {
        restoreEnvironment()
        try {
          await lease.release()
        }
        catch (error) {
          errors.push(error)
        }
      }
      if (errors.length === 1) {
        throw errors[0]
      }
      if (errors.length > 1) {
        throw new AggregateError(errors, 'E2E global teardown failed and machine lease cleanup did not complete.', { cause: errors[0] })
      }
    })()
    return teardown
  }
}
