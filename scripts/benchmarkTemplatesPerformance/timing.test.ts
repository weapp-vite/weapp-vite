import type { TemplatesHmrReport } from '../templates-performance-integrity'
import { describe, expect, it } from 'vitest'
import { renderHmrTimingSources, summarizeHmrTimingSources } from './timing'

function report(timingSources: Array<'compiler-profile' | 'output-observation' | undefined>): TemplatesHmrReport {
  return {
    templates: [{ id: 'example', scenarios: [{ id: 'script', group: 'script', label: 'index.ts', samples: timingSources.map(timingSource => ({ timingSource, totalMs: 20 })) }] }],
  }
}

describe('performance comparison timing provenance', () => {
  it('does not infer compiler profiles from totalMs or merge the two checkout sources', () => {
    const baseline = report(['output-observation', undefined])
    const optimized = report(['compiler-profile', 'output-observation'])
    expect(summarizeHmrTimingSources(baseline)).toEqual({ compilerProfile: 0, outputObservation: 1, unspecified: 1 })
    expect(summarizeHmrTimingSources(optimized)).toEqual({ compilerProfile: 1, outputObservation: 1, unspecified: 0 })
    const markdown = renderHmrTimingSources(baseline, optimized).join('\n')
    expect(markdown).toContain('baseline 计时样本来源：compiler-profile 0，output-observation 1，未声明 1')
    expect(markdown).toContain('optimized 计时样本来源：compiler-profile 1，output-observation 1，未声明 0')
    expect(markdown).toContain('缺失的 core 分段显示为不可用')
  })
})
