import type { SuiteTask } from '../suiteRunner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareTaskLaunch, remainingTaskTimeoutMs } from './launchBudget'

const task: SuiteTask = { label: 'launch-budget', command: 'original-command', args: ['original-argument'] }

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('task launch budget', () => {
  it('returns the original deadline after the hook consumes part of its budget', async () => {
    const startedAt = Date.now()
    const preparing = prepareTaskLaunch(task, new AbortController().signal, 1000, async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 400))
    })
    await vi.advanceTimersByTimeAsync(400)
    const budget = await preparing
    expect(budget).toEqual({ taskLabel: task.label, timeoutMs: 1000, deadlineAt: startedAt + 1000 })
    expect(remainingTaskTimeoutMs(budget!)).toBe(600)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts an expired hook and rejects a late completion instead of resetting the deadline', async () => {
    const finish = Promise.withResolvers<void>()
    let hookSignal: AbortSignal | undefined
    const preparing = prepareTaskLaunch(task, new AbortController().signal, 1000, async (_task, signal) => {
      hookSignal = signal
      await finish.promise
    })
    const rejected = expect(preparing).rejects.toThrow('task timeout after 1.0s before command launch')
    await vi.advanceTimersByTimeAsync(1000)
    expect(hookSignal?.aborted).toBe(true)
    finish.resolve()
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects an exhausted deadline even when the timer callback has not executed', async () => {
    await expect(prepareTaskLaunch(task, new AbortController().signal, 1000, () => {
      vi.setSystemTime(Date.now() + 1000)
    })).rejects.toThrow('before command launch')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not invoke a hook after cancellation', async () => {
    const cancellation = new AbortController()
    const reason = new Error('suite cancelled')
    cancellation.abort(reason)
    const hook = vi.fn()
    await expect(prepareTaskLaunch(task, cancellation.signal, 1000, hook)).rejects.toBe(reason)
    expect(hook).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves a hook error and clears its task deadline timer', async () => {
    const reason = new Error('gate failed')
    await expect(prepareTaskLaunch(task, new AbortController().signal, 1000, () => {
      throw reason
    })).rejects.toBe(reason)
    expect(vi.getTimerCount()).toBe(0)
  })
})
