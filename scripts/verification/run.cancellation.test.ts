import type { VerificationTask } from './types.ts'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createTaskExecutor } from './run.ts'

const mocks = vi.hoisted(() => ({ command: vi.fn(), observed: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.command }))
vi.mock('../verificationBenchmark/localTask.mjs', () => ({ executeLocalTask: mocks.observed }))

beforeEach(() => vi.resetAllMocks())
afterEach(() => vi.unstubAllEnvs())

const task: VerificationTask = {
  id: 'cancelled-task',
  kind: 'test',
  command: 'never-launch',
  args: [],
  directory: '.',
  dependencies: [],
  reason: 'cancellation regression',
}

it.each([false, true])('does not launch after cancellation while probing Git variables (observed: %s)', async (observed) => {
  let release!: (value: { stdout: string }) => void
  mocks.command.mockReturnValueOnce(new Promise<{ stdout: string }>(resolve => release = resolve))
  vi.stubEnv('WEAPP_VITE_VERIFICATION_LOCAL_DIR', observed ? '.tmp/observed' : undefined)
  const controller = new AbortController()
  const reason = new Error('verification cancelled')
  const running = createTaskExecutor('.')(task, controller.signal)
  expect(mocks.command).toHaveBeenCalledOnce()
  controller.abort(reason)
  release({ stdout: 'GIT_DIR\r\nGIT_INDEX_FILE\r\n' })
  await expect(running).rejects.toBe(reason)
  expect(mocks.command).toHaveBeenCalledOnce()
  expect(mocks.observed).not.toHaveBeenCalled()
})

it('does not probe Git or launch a task after cancellation', async () => {
  const controller = new AbortController()
  const reason = new Error('already cancelled')
  controller.abort(reason)
  await expect(createTaskExecutor('.')(task, controller.signal)).rejects.toBe(reason)
  expect(mocks.command).not.toHaveBeenCalled()
  expect(mocks.observed).not.toHaveBeenCalled()
})
