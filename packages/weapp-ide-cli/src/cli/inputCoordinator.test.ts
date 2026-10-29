import { beforeEach, expect, it, vi } from 'vitest'

const input = vi.hoisted(() => ({
  isTTY: false,
  readableFlowing: null as boolean | null,
  pause: vi.fn(),
  resume: vi.fn(),
}))

vi.mock('node:process', () => ({ default: { stdin: input } }))

const { runWithSuspendedSharedInput } = await import('./inputCoordinator')

beforeEach(() => {
  input.pause.mockReset().mockImplementation(() => {
    input.readableFlowing = false
  })
  input.resume.mockReset().mockImplementation(() => {
    input.readableFlowing = true
  })
})

it.each([true, false, null])('preserves non-interactive stdin owned by its consumer with flowing=%s', async (flowing) => {
  input.readableFlowing = flowing
  const operation = Promise.withResolvers<string>()
  const runner = vi.fn(() => {
    expect(input.readableFlowing).toBe(flowing)
    return operation.promise
  })
  const pending = runWithSuspendedSharedInput(runner)
  operation.resolve('completed')
  await expect(pending).resolves.toBe('completed')
  expect(runner).toHaveBeenCalledOnce()
  expect(input.pause).not.toHaveBeenCalled()
  expect(input.resume).not.toHaveBeenCalled()
  expect(input.readableFlowing).toBe(flowing)
})

it('preserves non-interactive EOF consumption when the CLI operation fails', async () => {
  input.readableFlowing = true
  const failure = new Error('CLI failed')
  await expect(runWithSuspendedSharedInput(async () => {
    throw failure
  })).rejects.toBe(failure)
  expect(input.pause).not.toHaveBeenCalled()
  expect(input.resume).not.toHaveBeenCalled()
  expect(input.readableFlowing).toBe(true)
})
