import { expect, it, vi } from 'vitest'
import { readMemoryAvailability } from './memory.ts'

const GIB = 1024 ** 3
const input = { totalMemoryBytes: 128 * GIB, freeMemoryBytes: GIB }

it('uses a bounded C-locale Darwin probe and conservatively includes reclaimable memory', () => {
  const run = vi.fn(() => 'System-wide memory free percentage: 54%\n')
  expect(readMemoryAvailability({ ...input, platform: 'darwin', run })).toEqual({
    availableMemoryBytes: Math.floor(128 * GIB * 0.54 * 0.5),
    availableMemorySource: 'darwin-memory-pressure',
  })
  expect(run).toHaveBeenCalledWith('/usr/bin/memory_pressure', ['-Q'], expect.objectContaining({
    encoding: 'utf8',
    timeout: 1_000,
    maxBuffer: 8_192,
    env: expect.objectContaining({ LC_ALL: 'C', LANG: 'C' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  }))
})

it.each(['linux', 'win32'] as const)('keeps the OS fallback on %s without launching a probe', (platform) => {
  const run = vi.fn()
  expect(readMemoryAvailability({ ...input, platform, run })).toEqual({ availableMemoryBytes: GIB, availableMemorySource: 'os-freemem' })
  expect(run).not.toHaveBeenCalled()
})

it.each([
  'unrecognized output',
  'System-wide memory free percentage: -1%\n',
  'System-wide memory free percentage: 101%\n',
  'System-wide memory free percentage: NaN%\n',
  'System-wide memory free percentage: Infinity%\n',
  'System-wide memory free percentage: 54%\nSystem-wide memory free percentage: 55%\n',
])('falls back for unknown, ambiguous or invalid probe output: %s', (output) => {
  expect(readMemoryAvailability({ ...input, platform: 'darwin', run: () => output })).toEqual({ availableMemoryBytes: GIB, availableMemorySource: 'os-freemem' })
})

it.each(['ENOENT', 'ETIMEDOUT'])('falls back after a failed or timed-out Darwin probe: %s', (code) => {
  expect(readMemoryAvailability({
    ...input,
    platform: 'darwin',
    run: () => { throw Object.assign(new Error('probe unavailable'), { code }) },
  })).toEqual({ availableMemoryBytes: GIB, availableMemorySource: 'os-freemem' })
})

it('accepts CRLF and fractional percentages while preserving a larger raw free-memory lower bound', () => {
  expect(readMemoryAvailability({ ...input, platform: 'darwin', run: () => 'System-wide memory free percentage: 54.5%\r\n' })).toEqual({
    availableMemoryBytes: Math.floor(128 * GIB * 0.545 * 0.5),
    availableMemorySource: 'darwin-memory-pressure',
  })
  expect(readMemoryAvailability({ ...input, freeMemoryBytes: 100 * GIB, platform: 'darwin', run: () => 'System-wide memory free percentage: 54%\n' })).toEqual({
    availableMemoryBytes: 100 * GIB,
    availableMemorySource: 'os-freemem',
  })
})
