import type { ProjectResult } from './types'
import { describe, expect, it } from 'vitest'
import { evaluateWorkspaceHmrThresholds } from './baseline'
import { renderThresholdMarkdown, summarizeWorkspaceHmrExecution } from './report'

describe('workspace HMR execution reporting', () => {
  it('separates successful stateful observations, failures and unexecuted scenarios from timing samples', () => {
    const results: ProjectResult[] = [{
      id: 'apps/example',
      kind: 'apps',
      platform: 'weapp',
      source: 'apps/example',
      scenarios: [
        ...Array.from({ length: 6 }, (_, index) => ({
          id: `success-${index}`,
          label: 'stateful scenario',
          source: 'src/page.ts',
          output: 'dist/page.js',
          marker: `current-${index}`,
          observedMs: index + 1,
        })),
        { id: 'failed', label: 'failed', source: 'src/page.ts', output: 'dist/page.js', marker: 'failed-current', error: 'Transport failed' },
        { id: 'pending', label: 'pending', source: 'src/page.ts', output: 'dist/page.js', error: 'Not executed: previous scenario did not restore its baseline.' },
      ],
    }]
    const execution = summarizeWorkspaceHmrExecution(results)
    expect(execution).toEqual({
      executedScenarioCount: 7,
      successfulScenarioCount: 6,
      failedScenarioCount: 1,
      notExecutedScenarioCount: 1,
      compilerProfileSampleCount: 0,
    })
    const evaluation = evaluateWorkspaceHmrThresholds(results)
    expect(evaluation.measuredScenarioCount).toBe(0)
    const markdown = renderThresholdMarkdown(evaluation, execution)
    expect(markdown).toContain('- executed scenarios: 7/8')
    expect(markdown).toContain('- successful scenarios: 6')
    expect(markdown).toContain('- compiler profile samples: 0/8')
    expect(markdown).toContain('- timing threshold samples: 0/8')
    expect(markdown).not.toContain('measured scenarios:')
  })

  it('counts compiler profiles separately from observed-time fallbacks and startup-blocked cases', () => {
    const results: ProjectResult[] = [{
      id: 'apps/example',
      kind: 'apps',
      platform: 'weapp',
      source: 'apps/example',
      scenarios: [
        { id: 'profile', label: 'profile', source: 'page.ts', output: 'page.js', totalMs: 2, profile: { totalMs: 2 } },
        { id: 'fallback', label: 'fallback', source: 'page.ts', output: 'page.js', totalMs: 3, observedMs: 3 },
        { id: 'blocked', label: 'blocked', source: 'page.ts', output: 'page.js' },
      ],
    }]
    const execution = summarizeWorkspaceHmrExecution(results)
    expect(execution.executedScenarioCount).toBe(2)
    expect(execution.compilerProfileSampleCount).toBe(1)
    expect(execution.notExecutedScenarioCount).toBe(1)
    expect(evaluateWorkspaceHmrThresholds(results).measuredScenarioCount).toBe(2)
  })
})
