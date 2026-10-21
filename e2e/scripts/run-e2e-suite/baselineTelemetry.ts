import type { SuiteReportPayload } from '../suiteReport'
import type { SuiteTask } from '../suiteRunner'
import process from 'node:process'

type ReportCallback = (report: SuiteReportPayload) => void

/** 只为显式启用的原 suite 接上共同证据实现，不改变普通入口或旧分片算法。 */
export async function loadBaselineSuiteExecution(options: {
  suite: string
  tasks: SuiteTask[]
  topology: string
  filtered: boolean
  frozenPlan: boolean
}) {
  if (process.env.WEAPP_VITE_VERIFICATION_TELEMETRY !== '1') {
    return undefined
  }
  const { loadBaselineSuitePlan, writeBaselineSuiteTelemetry } = await import('../../../scripts/verificationTelemetry/suite')
  const plan = await loadBaselineSuitePlan(options.suite, options.tasks, options)
  if (!plan) {
    return undefined
  }
  if (options.frozenPlan) {
    throw new Error('Formal baseline telemetry cannot use a separate optimized shard plan')
  }
  return {
    plan,
    async run<Code extends number>(tasks: SuiteTask[], shardIndex: number, shardTotal: number, execute: (onReport: ReportCallback) => Promise<Code>, onReport?: ReportCallback) {
      const assigned = tasks.filter(task => !task.outOfScopeReason).map(task => task.label)
      const planned = plan.tasks.filter(task => !task.outOfScopeReason && task.shardIndex === shardIndex).map(task => task.label)
      if (shardTotal !== plan.shardTotal || !Number.isInteger(shardIndex) || shardIndex < 1 || shardIndex > plan.shardTotal
        || JSON.stringify(assigned) !== JSON.stringify(planned)) {
        throw new Error('Baseline suite selection differs from its frozen legacy assignment')
      }
      let report: SuiteReportPayload | undefined
      const code = await execute((value) => {
        report = value
        onReport?.(value)
      })
      // 等待原 runner 完成取消处理、资源清理和租约释放；失败不再写成功证据。
      if (code === 0) {
        if (!report) {
          throw new Error('Successful baseline suite did not produce its original report')
        }
        await writeBaselineSuiteTelemetry(plan, report, shardIndex, assigned)
      }
      return code
    },
  }
}
