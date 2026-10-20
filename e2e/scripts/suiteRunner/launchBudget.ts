import type { SuiteTask } from '../suiteRunner'

export type TaskLaunchHook = (task: SuiteTask, signal: AbortSignal) => Promise<void> | void

export interface TaskLaunchBudget {
  taskLabel: string
  timeoutMs: number
  deadlineAt: number
}

function timeoutError(budget: TaskLaunchBudget) {
  return new Error(`E2E task timeout after ${(budget.timeoutMs / 1000).toFixed(1)}s before command launch: ${budget.taskLabel}`)
}

/** 以同一截止时间覆盖启动钩子和原命令，耗尽时不能将零预算解释为无限等待。 */
export function remainingTaskTimeoutMs(budget: TaskLaunchBudget) {
  const remaining = budget.deadlineAt - Date.now()
  if (remaining <= 0) {
    throw timeoutError(budget)
  }
  return remaining
}

/** 钩子需响应信号并真正结束；不能让后台钩子与后续资源清理并发。 */
export async function prepareTaskLaunch(task: SuiteTask, signal: AbortSignal, timeoutMs: number, hook: TaskLaunchHook): Promise<TaskLaunchBudget | undefined> {
  signal.throwIfAborted()
  const budget = timeoutMs > 0 ? { taskLabel: task.label, timeoutMs, deadlineAt: Date.now() + timeoutMs } : undefined
  const timeout = new AbortController()
  const timer = budget ? setTimeout(() => timeout.abort(timeoutError(budget)), timeoutMs) : undefined
  const launchSignal = budget ? AbortSignal.any([signal, timeout.signal]) : signal
  try {
    await hook(task, launchSignal)
    launchSignal.throwIfAborted()
    if (budget) {
      remainingTaskTimeoutMs(budget)
    }
    return budget
  }
  finally {
    clearTimeout(timer)
  }
}
