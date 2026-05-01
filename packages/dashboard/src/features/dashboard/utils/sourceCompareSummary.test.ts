import { describe, expect, it } from 'vitest'
import { createSourceCompareReport, createSourceCompareStats, formatSignedBytes } from './sourceCompareSummary'

describe('sourceCompareSummary', () => {
  it('estimates added and removed lines with repeated lines', () => {
    expect(createSourceCompareStats('a\nb\nb\nc', 'a\nb\nd\nd')).toMatchObject({
      sourceLines: 4,
      artifactLines: 4,
      addedLines: 2,
      removedLines: 2,
    })
  })

  it('formats signed byte deltas', () => {
    expect(formatSignedBytes(0)).toBe('无变化')
    expect(formatSignedBytes(2048)).toBe('+2.00 KB')
    expect(formatSignedBytes(-1024)).toBe('-1.00 KB')
  })

  it('creates a markdown compare report', () => {
    const stats = createSourceCompareStats('const a = 1\n', 'const a = 1\nconsole.log(a)\n')
    expect(createSourceCompareReport({
      sourcePath: 'src/index.ts',
      artifactPath: 'dist/index.js',
      stats,
    })).toContain('源码：src/index.ts')
  })
})
