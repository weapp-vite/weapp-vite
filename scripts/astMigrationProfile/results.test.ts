import { describe, expect, it } from 'vitest'
import { retainedHeapSlope } from './results'

describe('retained heap trend', () => {
  it('measures the post-GC slope across repeated compiles', () => {
    expect(retainedHeapSlope([
      { iteration: 1, compileMs: 1, heapUsedAfterGc: 101, retainedHeapDeltaBytes: 1, rssAfterGc: 101 },
      { iteration: 2, compileMs: 1, heapUsedAfterGc: 105, retainedHeapDeltaBytes: 5, rssAfterGc: 105 },
      { iteration: 3, compileMs: 1, heapUsedAfterGc: 109, retainedHeapDeltaBytes: 9, rssAfterGc: 109 },
    ])).toBe(4)
  })
})
