import { describe, expect, it } from 'vitest'
import { formatBytes } from './bytes'

describe('formatBytes', () => {
  it('returns 0 B for non-finite and non-positive values', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B')
  })

  it('formats bytes in B/KB/MB/GB units', () => {
    expect(formatBytes(1)).toBe('1 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
  })

  it('applies precision strategy by value range', () => {
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(10.5 * 1024)).toBe('10.5 KB')
    expect(formatBytes(100 * 1024)).toBe('100 KB')
  })
})
