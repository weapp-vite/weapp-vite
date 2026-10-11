import process from 'node:process'
import { acquireMachineE2ELease } from '../packages/devtools-runtime/src/lease/machine'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal/constants'

/** 纯 mock 基础设施测试只持有机器租约；不取得真实 IDE 项目日志或窗口清理权。 */
export default async function setup() {
  const lease = await acquireMachineE2ELease()
  const keys = [...new Set([...Object.keys(lease.environment), MANAGED_PROJECT_JOURNAL_ENV])]
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  Object.assign(process.env, lease.environment)
  // 外层命令可能带有真实任务日志；仅隔离本 runner/worker 环境，不操作父任务资源。
  delete process.env[MANAGED_PROJECT_JOURNAL_ENV]

  let teardown: Promise<void> | undefined
  return () => {
    teardown ??= (async () => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key]
        }
        else {
          process.env[key] = value
        }
      }
      await lease.release()
    })()
    return teardown
  }
}
