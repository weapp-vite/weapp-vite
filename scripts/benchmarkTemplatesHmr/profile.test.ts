import { describe, expect, it, vi } from 'vitest'
import { collectBenchmarkHmrPhaseProfile, collectBenchmarkHmrProfile, findBenchmarkHmrProfileSample, matchesHmrProfileSource } from './profile'

describe('benchmark compiler profile capability', () => {
  it('does not read a disabled profile during overhead comparisons', async () => {
    const reader = vi.fn(() => new Promise<{ totalMs?: number }>(() => {}))
    expect(await collectBenchmarkHmrProfile('standard', reader, false)).toEqual({ profile: {}, status: 'disabled' })
    expect(reader).not.toHaveBeenCalled()
  })
  it('accepts stateful timing only from its actual producer', async () => {
    const profile = { schemaVersion: 1, status: 'complete', pipeline: 'stateful', totalMs: 12 }
    expect(await collectBenchmarkHmrProfile('stateful', async () => profile)).toEqual({ profile, status: 'available' })
    expect(await collectBenchmarkHmrProfile('stateful', async () => ({ totalMs: 12 }))).toEqual({ profile: {}, status: 'incompatible' })
  })

  it('retains real standard compiler timing', async () => {
    const profile = { totalMs: 18, transformMs: 9 }
    expect(await collectBenchmarkHmrProfile('standard', async () => profile)).toEqual({ profile, status: 'available' })
  })

  it('reads the published runtime separately for the edit and restore phases after fallback', async () => {
    const readRuntime = vi.fn().mockResolvedValue('standard')
    const profile = { schemaVersion: 1, status: 'complete', pipeline: 'standard', totalMs: 18 }
    const reader = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce(profile)
    const edit = await collectBenchmarkHmrPhaseProfile('stateful', readRuntime, reader)
    const restore = await collectBenchmarkHmrPhaseProfile(edit.runtimeAfter, readRuntime, reader)
    expect(edit).toEqual({ profile: {}, status: 'missing', runtimeBefore: 'stateful', runtimeAfter: 'standard' })
    expect(restore).toEqual({ profile, status: 'available', runtimeBefore: 'standard', runtimeAfter: 'standard' })
    expect(reader.mock.calls).toEqual([['standard'], ['standard']])
    expect(readRuntime).toHaveBeenCalledTimes(2)
  })

  it('rejects complete stateful timing after the published runtime falls back to standard', async () => {
    const profile = { schemaVersion: 1, status: 'complete', pipeline: 'stateful', totalMs: 18 }
    expect(await collectBenchmarkHmrPhaseProfile('stateful', async () => 'standard', async () => profile)).toEqual({
      profile: {},
      status: 'incompatible',
      runtimeBefore: 'stateful',
      runtimeAfter: 'standard',
    })
  })

  it('does not relabel a failed stateful fallback profile or accept standard timing before fallback', async () => {
    const failed = { schemaVersion: 1, status: 'failed', pipeline: 'stateful', totalMs: undefined, elapsedMs: 12 }
    expect(await collectBenchmarkHmrPhaseProfile('stateful', async () => 'standard', async () => failed)).toEqual({
      profile: {},
      status: 'incomplete',
      runtimeBefore: 'stateful',
      runtimeAfter: 'standard',
    })
    const standard = { schemaVersion: 1, status: 'complete', pipeline: 'standard', totalMs: 18 }
    expect(await collectBenchmarkHmrPhaseProfile('stateful', async () => 'stateful', async () => standard)).toEqual({
      profile: {},
      status: 'incompatible',
      runtimeBefore: 'stateful',
      runtimeAfter: 'stateful',
    })
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

  it('selects the latest profile from the actual runtime and exact source amid interleaved records', () => {
    const source = 'src/pages/home/index.vue'
    const standard = { pipeline: 'standard', file: source, totalMs: 18 } as const
    const stateful = { pipeline: 'stateful', file: source, totalMs: 8 } as const
    const unrelated = { pipeline: 'standard', file: `other/${source}`, totalMs: 2 } as const
    const legacy = { file: 'src\\pages\\home\\index.vue', totalMs: 20 }
    expect(findBenchmarkHmrProfileSample([legacy, standard, stateful, unrelated], 'standard', [source])).toBe(standard)
    expect(findBenchmarkHmrProfileSample([legacy, stateful, standard, unrelated], 'stateful', [source])).toBe(stateful)
    expect(findBenchmarkHmrProfileSample([standard, legacy, stateful], 'standard', [source])).toBe(legacy)
    expect(findBenchmarkHmrProfileSample([legacy, standard], 'stateful', [source])).toBeUndefined()
    expect(findBenchmarkHmrProfileSample([stateful, unrelated], 'standard', [source])).toBeUndefined()
  })

  it('distinguishes an absent profile from a query failure', async () => {
    expect(await collectBenchmarkHmrProfile('standard', async () => ({}))).toEqual({ profile: {}, status: 'missing' })
    expect(await collectBenchmarkHmrProfile('standard', async () => {
      throw new Error('unreadable')
    }))
      .toEqual({ profile: {}, status: 'read-error' })
  })
})
