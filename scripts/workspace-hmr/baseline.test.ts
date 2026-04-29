import type { ProjectResult } from './baseline'
import { describe, expect, it } from 'vitest'
import {
  createWorkspaceHmrBaseline,
  evaluateWorkspaceHmrThresholds,
  parseThresholdOverrides,
  renderThresholdMarkdown,
} from './baseline'

const templateResult: ProjectResult = {
  id: 'templates/weapp-vite-template',
  kind: 'templates',
  platform: 'weapp',
  source: 'templates/weapp-vite-template',
  startupMs: 1_000,
  scenarios: [
    {
      id: 'native-template',
      label: 'native template',
      source: 'templates/weapp-vite-template/src/pages/index/index.wxml',
      output: 'templates/weapp-vite-template/dist/pages/index/index.wxml',
      totalMs: 400,
      profile: {
        dirtyCount: 1,
        pendingCount: 1,
        emittedCount: 1,
      },
      impact: [
        {
          path: 'pages/index/index.wxml',
          status: 'modified',
        },
      ],
    },
  ],
}

describe('workspace HMR baseline thresholds', () => {
  it('creates a template baseline from measured results', () => {
    const baseline = createWorkspaceHmrBaseline([templateResult], {
      generatedAt: '2026-04-29T00:00:00.000Z',
      mode: 'templates-baseline',
    })

    expect(baseline.projects['templates/weapp-vite-template']?.startupMs).toBe(1_000)
    expect(baseline.projects['templates/weapp-vite-template']?.scenarios['native-template']).toMatchObject({
      totalMs: 400,
      dirtyCount: 1,
      pendingCount: 1,
      emittedCount: 1,
      impactFiles: 1,
    })
  })

  it('reports impact and timing regressions against baseline deltas', () => {
    const baseline = createWorkspaceHmrBaseline([templateResult], {
      generatedAt: '2026-04-29T00:00:00.000Z',
      mode: 'templates-baseline',
      thresholds: {
        maxRegressionMs: 100,
        maxRegressionRatio: 0,
        maxImpactFileDelta: 0,
      },
    })
    const current: ProjectResult = {
      ...templateResult,
      scenarios: [
        {
          ...templateResult.scenarios[0]!,
          totalMs: 650,
          impact: [
            { path: 'pages/index/index.wxml', status: 'modified' },
            { path: 'pages/index/index.js', status: 'modified' },
          ],
        },
      ],
    }

    const evaluation = evaluateWorkspaceHmrThresholds([current], { baseline })

    expect(evaluation.issues.map(issue => issue.metric)).toEqual(['totalMs', 'impactFiles'])
    expect(renderThresholdMarkdown(evaluation)).toContain('templates/weapp-vite-template')
  })

  it('allows known high baseline counts while still guarding deltas', () => {
    const baseline = createWorkspaceHmrBaseline([
      {
        ...templateResult,
        scenarios: [
          {
            ...templateResult.scenarios[0]!,
            profile: {
              dirtyCount: 1,
              pendingCount: 74,
              emittedCount: 74,
            },
          },
        ],
      },
    ], {
      generatedAt: '2026-04-29T00:00:00.000Z',
      mode: 'templates-baseline',
      thresholds: {
        maxPendingCount: 12,
        maxEmittedCount: 12,
        maxPendingDelta: 2,
        maxEmittedDelta: 2,
      },
    })

    expect(evaluateWorkspaceHmrThresholds([
      {
        ...templateResult,
        scenarios: [
          {
            ...templateResult.scenarios[0]!,
            profile: {
              dirtyCount: 1,
              pendingCount: 74,
              emittedCount: 74,
            },
          },
        ],
      },
    ], { baseline }).issues).toHaveLength(0)
  })

  it('parses environment threshold overrides', () => {
    expect(parseThresholdOverrides({
      WORKSPACE_HMR_MAX_SCENARIO_MS: '1234',
      WORKSPACE_HMR_MAX_PENDING_COUNT: '3',
    })).toEqual({
      maxScenarioMs: 1234,
      maxPendingCount: 3,
    })
  })
})
