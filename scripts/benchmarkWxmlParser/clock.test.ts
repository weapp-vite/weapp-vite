import { describe, expect, it, vi } from 'vitest'
import { probeClock } from './clock'

describe('actual benchmark clock evidence', () => {
  it('reports the observed minimum positive delta without inventing precision', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0.005).mockReturnValueOnce(0.005).mockReturnValueOnce(0.01)
    try {
      expect(probeClock(4)).toMatchObject({ reads: 4, positiveChanges: 2, minimumPositiveDeltaMs: 0.005, maximumPositiveDeltaMs: 0.005 })
    }
    finally {
      now.mockRestore()
    }
  })

  it('reports null when no positive clock step was observed', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(5)
    try {
      expect(probeClock(8)).toMatchObject({ positiveChanges: 0, minimumPositiveDeltaMs: null, maximumPositiveDeltaMs: null })
    }
    finally {
      now.mockRestore()
    }
  })
})
