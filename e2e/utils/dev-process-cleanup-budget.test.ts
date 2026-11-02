import type { DevProcessStopOptions } from './devProcessCleanup/shutdown'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanupResidualDevProcesses } from './dev-process-cleanup'
import { DEV_PROCESS_CLEANUP_HOOK_TIMEOUT_MS, DEV_PROCESS_CLEANUP_TIMEOUT_MS } from './devProcessCleanup/shutdown'

const cleanup = vi.hoisted(() => vi.fn())
vi.mock('./dev-process', () => ({ cleanupTrackedDevProcesses: cleanup }))

afterEach(() => {
  vi.useRealTimers()
  cleanup.mockReset()
})

it('cancels the registered cleanup before the outer hook deadline and still waits for the owned close', async () => {
  vi.useFakeTimers()
  const closed = Promise.withResolvers<void>()
  let options: DevProcessStopOptions | undefined
  cleanup.mockImplementation(async (_delay: number, value: DevProcessStopOptions) => {
    options = value
    await new Promise<void>(resolve => value.inspectionSignal!.addEventListener('abort', () => resolve(), { once: true }))
    await closed.promise
    throw value.inspectionSignal!.reason
  })
  let finished = false
  const pending = cleanupResidualDevProcesses().catch((error: unknown) => error).finally(() => finished = true)
  expect(DEV_PROCESS_CLEANUP_HOOK_TIMEOUT_MS).toBeGreaterThan(DEV_PROCESS_CLEANUP_TIMEOUT_MS)
  await vi.advanceTimersByTimeAsync(DEV_PROCESS_CLEANUP_TIMEOUT_MS)
  expect(options!.inspectionSignal!.aborted).toBe(true)
  expect(options!.signal).toBe(options!.inspectionSignal)
  expect(finished).toBe(false)
  closed.resolve()
  expect(await pending).toBe(options!.inspectionSignal!.reason)
  expect(vi.getTimerCount()).toBe(0)
})
