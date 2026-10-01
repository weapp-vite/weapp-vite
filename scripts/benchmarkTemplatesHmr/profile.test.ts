import { describe, expect, it, vi } from 'vitest'
import { collectBenchmarkHmrProfile, matchesHmrProfileSource } from './profile'

describe('benchmark compiler profile capability', () => {
  it('does not read a disabled profile during overhead comparisons', async () => {
    const reader = vi.fn(() => new Promise<{ totalMs?: number }>(() => {}))
    expect(await collectBenchmarkHmrProfile('standard', reader, false)).toEqual({ profile: {}, status: 'disabled' })
    expect(reader).not.toHaveBeenCalled()
  })
  it('does not start a profile timeout for a stateful runtime', async () => {
    const reader = vi.fn(() => new Promise<{ totalMs?: number }>(() => {}))
    expect(await collectBenchmarkHmrProfile('stateful', reader)).toEqual({ profile: {}, status: 'unavailable-stateful' })
    expect(reader).not.toHaveBeenCalled()
  })

  it('retains real standard compiler timing', async () => {
    const profile = { totalMs: 18, transformMs: 9 }
    expect(await collectBenchmarkHmrProfile('standard', async () => profile)).toEqual({ profile, status: 'available' })
  })

  it.each([
    { totalMs: Number.NaN },
    { totalMs: -1 },
    { totalMs: 20, schemaVersion: 99, status: 'complete' },
    { totalMs: 20, schemaVersion: 1, status: 'failed' },
  ])('does not accept incompatible or unfinished timing: %j', async (profile) => {
    const result = await collectBenchmarkHmrProfile('standard', async () => profile)
    expect(result.status).not.toBe('available')
    expect(result.profile).toEqual({})
  })

  it('matches batch source events exactly and does not invent attribution', () => {
    const expected = ['src/pages/home/index.vue']
    expect(matchesHmrProfileSource({ totalMs: 1 }, expected)).toBe(false)
    expect(matchesHmrProfileSource({ file: 'other/src/pages/home/index.vue' }, expected)).toBe(false)
    expect(matchesHmrProfileSource({ sourceEvents: [{ eventId: 'edit', file: expected[0], receivedAtMs: 10 }] }, expected)).toBe(true)
    expect(matchesHmrProfileSource({ file: 'src\\pages\\home\\index.vue' }, expected)).toBe(true)
  })

  it('distinguishes an absent profile from a query failure', async () => {
    expect(await collectBenchmarkHmrProfile('standard', async () => ({}))).toEqual({ profile: {}, status: 'missing' })
    expect(await collectBenchmarkHmrProfile('standard', async () => {
      throw new Error('unreadable')
    }))
      .toEqual({ profile: {}, status: 'read-error' })
  })
})
