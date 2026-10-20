import { expect, it, vi } from 'vitest'
import { createSharedStatGate } from './sharedStatGate.mjs'

it('holds the original shared stat error while a sibling result is delivered, then releases queued work', async () => {
  const file = 'shared-file'
  const gate = createSharedStatGate(file)
  const originalError = Object.assign(new Error('native missing file'), { code: 'ENOENT' })
  const newStats = { dev: 1, ino: 2 }
  const firstOriginal = vi.fn(async () => {
    throw originalError
  })
  const secondOriginal = vi.fn(async () => newStats)
  gate.arm()
  const first = gate.hook({ file, original: firstOriginal })
  const firstRejected = expect(first).rejects.toBe(originalError)
  const second = gate.hook({ file, original: secondOriginal })
  await gate.pair
  await gate.firstWaveClosed
  expect(gate.requests.map(request => request.firstWave)).toEqual([true, true])
  expect(firstOriginal).not.toHaveBeenCalled()
  expect(secondOriginal).not.toHaveBeenCalled()
  gate.run(0)
  await gate.requests[0]!.observed.promise
  expect(gate.requests[0]!.nativeError).toBe(originalError)
  expect(gate.requests[0]!.deliveredError).toBeUndefined()
  gate.run(1)
  await gate.requests[1]!.observed.promise
  gate.deliver(1)
  expect(await second).toBe(newStats)
  expect(gate.requests[0]!.deliveredError).toBeUndefined()
  const thirdOriginal = vi.fn(async () => newStats)
  const third = gate.hook({ file, original: thirdOriginal })
  expect(gate.requests[2]!.firstWave).toBe(false)
  expect(thirdOriginal).not.toHaveBeenCalled()
  gate.deliver(0)
  await firstRejected
  expect(gate.requests[0]!.deliveredError).toBe(originalError)
  gate.releaseAll()
  expect(await third).toBe(newStats)
  expect(await gate.hook({ file, original: async () => newStats })).toBe(newStats)
  expect(gate.requests).toHaveLength(3)
  gate.releaseAll()
})

it('leaves unrelated and unarmed stat calls untouched and releases captured calls before native reads', async () => {
  const gate = createSharedStatGate('shared-file')
  const original = vi.fn(async () => 'real-result')
  expect(await gate.hook({ file: 'shared-file', original })).toBe('real-result')
  gate.arm()
  expect(await gate.hook({ file: 'another-file', original })).toBe('real-result')
  const pending = gate.hook({ file: 'shared-file', original })
  expect(original).toHaveBeenCalledTimes(2)
  gate.releaseAll()
  expect(await pending).toBe('real-result')
  expect(original).toHaveBeenCalledTimes(3)
  expect(() => gate.arm()).toThrow()
})
