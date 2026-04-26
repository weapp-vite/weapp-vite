import { describe, expect, it } from 'vitest'
import { calculateSpeedupPercent, createComparisonSummary, parseCliArgs, parseTarget } from './compare-template-hmr'

describe('compare-template-hmr', () => {
  it('treats bare versions as npm targets', () => {
    expect(parseTarget('6.15.14')).toMatchObject({
      kind: 'npm',
      label: 'npm:6.15.14',
      packageSpec: 'weapp-vite@6.15.14',
      packageVersion: '6.15.14',
    })
  })

  it('parses local targets and benchmark options', () => {
    const { targets, options } = parseCliArgs([
      '--',
      '6.15.14',
      'local',
      '--iterations',
      '5',
      '--filter',
      'wevu-runtime-e2e',
      '--debug',
    ])

    expect(targets[0]).toMatchObject({ kind: 'npm', label: 'npm:6.15.14' })
    expect(targets[1]).toMatchObject({ kind: 'local', label: 'local' })
    expect(options).toMatchObject({
      iterations: '5',
      filter: 'wevu-runtime-e2e',
      debug: true,
    })
  })

  it('computes positive speedup when candidate is faster', () => {
    expect(calculateSpeedupPercent(100, 75)).toBe(25)
  })

  it('summarizes project and scenario deltas', () => {
    const summary = createComparisonSummary(
      {
        generatedAt: 'baseline',
        iterations: 2,
        timeoutMs: 1,
        heartbeatMs: 1,
        projects: [
          {
            name: 'fixture',
            source: 'fixture',
            startupMs: 1000,
            averageMs: 100,
            maxMs: 120,
            scenarios: [
              {
                scenario: 'template',
                averageMs: 100,
                maxMs: 120,
              },
            ],
          },
        ],
      },
      {
        generatedAt: 'candidate',
        iterations: 2,
        timeoutMs: 1,
        heartbeatMs: 1,
        projects: [
          {
            name: 'fixture',
            source: 'fixture',
            startupMs: 900,
            averageMs: 80,
            maxMs: 90,
            scenarios: [
              {
                scenario: 'template',
                averageMs: 80,
                maxMs: 90,
              },
            ],
          },
        ],
      },
    )

    expect(summary.speedupPercent).toBe(20)
    expect(summary.startupSpeedupPercent).toBe(10)
    expect(summary.scenarioRows).toEqual([
      {
        project: 'fixture',
        scenario: 'template',
        baselineMs: 100,
        candidateMs: 80,
        deltaMs: -20,
        speedupPercent: 20,
      },
    ])
  })
})
