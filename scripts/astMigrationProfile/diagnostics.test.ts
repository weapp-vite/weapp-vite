import { describe, expect, it } from 'vitest'
import { summarizeCompileGc } from './diagnostics'

describe('actual compiler GC interval', () => {
  it('excludes preparation and later events regardless of asynchronous delivery order', () => {
    expect(summarizeCompileGc([
      { startTime: 11, duration: 2 },
      { startTime: 9, duration: 8 },
      { startTime: 20, duration: 3 },
      { startTime: 10, duration: 1 },
    ], 10, 20)).toEqual({ count: 2, durationMs: 3 })
  })
})
