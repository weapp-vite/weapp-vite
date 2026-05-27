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

  it('uses a template baseline alias for mirrored e2e apps', () => {
    const baseline = createWorkspaceHmrBaseline([
      {
        ...templateResult,
        id: 'templates/weapp-vite-wevu-tailwindcss-tdesign-template',
        scenarios: [
          {
            ...templateResult.scenarios[0]!,
            id: 'vue-template',
            profile: {
              dirtyCount: 1,
              pendingCount: 27,
              emittedCount: 27,
            },
          },
        ],
      },
    ], {
      generatedAt: '2026-04-29T00:00:00.000Z',
      mode: 'templates-baseline',
      thresholds: {
        maxPendingCount: 16,
        maxEmittedCount: 16,
        maxPendingDelta: 8,
        maxEmittedDelta: 8,
      },
    })

    const current: ProjectResult = {
      ...templateResult,
      id: 'e2e-apps/template-wevu-tdesign-regression',
      baselineId: 'templates/weapp-vite-wevu-tailwindcss-tdesign-template',
      kind: 'e2e-apps',
      scenarios: [
        {
          ...templateResult.scenarios[0]!,
          id: 'vue-template',
          profile: {
            dirtyCount: 1,
            pendingCount: 27,
            emittedCount: 27,
          },
        },
      ],
    }

    expect(evaluateWorkspaceHmrThresholds([current], { baseline }).issues).toHaveLength(0)

    const regressed = {
      ...current,
      scenarios: [
        {
          ...current.scenarios[0]!,
          profile: {
            dirtyCount: 1,
            pendingCount: 36,
            emittedCount: 36,
          },
        },
      ],
    }

    expect(evaluateWorkspaceHmrThresholds([regressed], { baseline }).issues.map(issue => issue.metric))
      .toEqual(['pendingCount', 'emittedCount'])
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

  it('fails scenarios above an absolute 1000ms total limit', () => {
    const evaluation = evaluateWorkspaceHmrThresholds([
      {
        ...templateResult,
        scenarios: [
          {
            ...templateResult.scenarios[0]!,
            totalMs: 1_001,
          },
        ],
      },
    ], {
      overrides: {
        maxScenarioMs: 1_000,
      },
    })

    expect(evaluation.issues).toMatchObject([
      {
        project: 'templates/weapp-vite-template',
        scenario: 'native-template',
        metric: 'totalMs',
        actual: 1_001,
        limit: 1_000,
      },
    ])
  })

  it('uses baseline regression budgets when baseline scenario time exceeds the absolute limit', () => {
    const baseline = createWorkspaceHmrBaseline([
      {
        ...templateResult,
        scenarios: [
          {
            ...templateResult.scenarios[0]!,
            totalMs: 3_000,
          },
        ],
      },
    ], {
      generatedAt: '2026-04-29T00:00:00.000Z',
      mode: 'templates-baseline',
      thresholds: {
        maxScenarioMs: 1_000,
        maxRegressionMs: 1_000,
        maxRegressionRatio: 0,
      },
    })

    const stable = evaluateWorkspaceHmrThresholds([
      {
        ...templateResult,
        scenarios: [
          {
            ...templateResult.scenarios[0]!,
            totalMs: 3_900,
          },
        ],
      },
    ], { baseline })

    expect(stable.issues).toHaveLength(0)

    const regressed = evaluateWorkspaceHmrThresholds([
      {
        ...templateResult,
        scenarios: [
          {
            ...templateResult.scenarios[0]!,
            totalMs: 4_100,
          },
        ],
      },
    ], { baseline })

    expect(regressed.issues).toMatchObject([
      {
        project: 'templates/weapp-vite-template',
        scenario: 'native-template',
        metric: 'totalMs',
        actual: 4_100,
        limit: 4_000,
        baseline: 3_000,
      },
    ])
  })

  it('fails when scenario P95 is above 1000ms', () => {
    const evaluation = evaluateWorkspaceHmrThresholds([
      {
        ...templateResult,
        scenarios: [
          {
            ...templateResult.scenarios[0]!,
            id: 'native-template',
            totalMs: 900,
          },
          {
            ...templateResult.scenarios[0]!,
            id: 'native-script',
            totalMs: 1_001,
          },
        ],
      },
    ], {
      overrides: {
        maxScenarioMs: 2_000,
        maxScenarioP95Ms: 1_000,
      },
    })

    expect(evaluation.scenarioP95Ms).toBe(1_001)
    expect(evaluation.issues).toMatchObject([
      {
        project: '<workspace>',
        metric: 'scenarioP95Ms',
        actual: 1_001,
        limit: 1_000,
      },
    ])
    expect(renderThresholdMarkdown(evaluation)).toContain('| <workspace> | - | scenarioP95Ms | 1001 | 1000 | - |')
  })

  it('uses baseline regression budgets when baseline scenario P95 exceeds the absolute limit', () => {
    const baseline = createWorkspaceHmrBaseline([
      {
        ...templateResult,
        scenarios: [
          {
            ...templateResult.scenarios[0]!,
            id: 'native-template',
            totalMs: 900,
          },
          {
            ...templateResult.scenarios[0]!,
            id: 'native-script',
            totalMs: 3_000,
          },
        ],
      },
    ], {
      generatedAt: '2026-04-29T00:00:00.000Z',
      mode: 'templates-baseline',
      thresholds: {
        maxScenarioMs: 5_000,
        maxScenarioP95Ms: 1_000,
        maxRegressionMs: 1_000,
        maxRegressionRatio: 0,
      },
    })

    const evaluation = evaluateWorkspaceHmrThresholds([
      {
        ...templateResult,
        scenarios: [
          {
            ...templateResult.scenarios[0]!,
            id: 'native-template',
            totalMs: 900,
          },
          {
            ...templateResult.scenarios[0]!,
            id: 'native-script',
            totalMs: 3_900,
          },
        ],
      },
    ], { baseline })

    expect(evaluation.scenarioP95Ms).toBe(3_900)
    expect(evaluation.issues).toHaveLength(0)
  })

  it('uses baseline scenario budgets when no env overrides are provided', () => {
    const evaluation = evaluateWorkspaceHmrThresholds([
      {
        ...templateResult,
        scenarios: [
          {
            ...templateResult.scenarios[0]!,
            id: 'native-template',
            totalMs: 1_500,
          },
        ],
      },
    ], {
      baseline: {
        version: 1,
        scope: 'templates',
        generatedAt: '2026-01-01T00:00:00.000Z',
        mode: 'templates-baseline',
        thresholds: {
          maxScenarioMs: 12_000,
          maxScenarioP95Ms: 12_000,
        },
        projects: {},
      },
    })

    expect(evaluation.issues).toHaveLength(2)
    expect(evaluation.issues.every(issue => issue.metric === 'baseline')).toBe(true)
  })
})
