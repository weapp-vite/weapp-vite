import { describe, expect, it, vi } from 'vitest'
import { collectBenchmarkHmrProfile } from './profile'

describe('benchmark compiler profile capability', () => {
  it('does not start a profile timeout for a stateful runtime', async () => {
    const reader = vi.fn(() => new Promise<{ totalMs?: number }>(() => {}))
    expect(await collectBenchmarkHmrProfile('stateful', reader)).toEqual({ profile: {}, status: 'unavailable-stateful' })
    expect(reader).not.toHaveBeenCalled()
  })

  it('retains real standard compiler timing', async () => {
    const profile = { totalMs: 18, transformMs: 9 }
    expect(await collectBenchmarkHmrProfile('standard', async () => profile)).toEqual({ profile, status: 'available' })
  })

  it('distinguishes an absent profile from a query failure', async () => {
    expect(await collectBenchmarkHmrProfile('standard', async () => ({}))).toEqual({ profile: {}, status: 'missing' })
    expect(await collectBenchmarkHmrProfile('standard', async () => {
      throw new Error('unreadable')
    }))
      .toEqual({ profile: {}, status: 'read-error' })
  })
})
