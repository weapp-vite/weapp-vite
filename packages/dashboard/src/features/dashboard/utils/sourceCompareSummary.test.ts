import { describe, expect, it } from 'vitest'
import { createSourceCompareInsights, createSourceCompareReport, createSourceCompareStats, formatSignedBytes } from './sourceCompareSummary'

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
    })).toContain('## 洞察')
  })

  it('creates warning insights for rewritten and larger artifacts', () => {
    const insights = createSourceCompareInsights(createSourceCompareStats(
      Array.from({ length: 20 }, (_, index) => `source-${index}`).join('\n'),
      Array.from({ length: 500 }, (_, index) => `artifact-${index}-with-extra-runtime-code-and-generated-wrapper`).join('\n'),
    ))

    expect(insights.map(item => [item.id, item.tone])).toContainEqual(['retention', 'warning'])
    expect(insights.map(item => [item.id, item.tone])).toContainEqual(['size', 'warning'])
  })
})
