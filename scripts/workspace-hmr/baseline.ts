/* eslint-disable ts/no-use-before-define */
import type {
  ProjectResult,
  ScenarioResult,
  ThresholdIssue,
  ThresholdOverrideEnv,
  WorkspaceHmrBaseline,
  WorkspaceHmrBaselineScenario,
  WorkspaceHmrThresholds,
} from './types'
import { formatNumber } from './report'

export { renderThresholdMarkdown } from './report'
export type {
  ProjectResult,
  ScenarioResult,
  ThresholdEvaluation,
  ThresholdIssue,
  WorkspaceHmrBaseline,
  WorkspaceHmrThresholds,
} from './types'

const DEFAULT_BASELINE_THRESHOLDS: WorkspaceHmrThresholds = {
  maxStartupMs: 15_000,
  maxScenarioMs: 5_000,
  maxScenarioP95Ms: 5_000,
  maxImpactFiles: 12,
  maxDirtyCount: 12,
  maxPendingCount: 12,
  maxEmittedCount: 12,
  maxRegressionMs: 1_000,
  maxRegressionRatio: 0.75,
  maxImpactFileDelta: 2,
  maxDirtyDelta: 2,
  maxPendingDelta: 2,
  maxEmittedDelta: 2,
}

export function parseThresholdOverrides(env: ThresholdOverrideEnv): WorkspaceHmrThresholds {
  return mergeThresholds({
    maxStartupMs: readOptionalNumber(env.WORKSPACE_HMR_MAX_STARTUP_MS),
    maxScenarioMs: readOptionalNumber(env.WORKSPACE_HMR_MAX_SCENARIO_MS),
    maxScenarioP95Ms: readOptionalNumber(env.WORKSPACE_HMR_MAX_P95_MS),
    maxImpactFiles: readOptionalNumber(env.WORKSPACE_HMR_MAX_IMPACT_FILES),
    maxDirtyCount: readOptionalNumber(env.WORKSPACE_HMR_MAX_DIRTY_COUNT),
    maxPendingCount: readOptionalNumber(env.WORKSPACE_HMR_MAX_PENDING_COUNT),
    maxEmittedCount: readOptionalNumber(env.WORKSPACE_HMR_MAX_EMITTED_COUNT),
    maxRegressionMs: readOptionalNumber(env.WORKSPACE_HMR_MAX_REGRESSION_MS),
    maxRegressionRatio: readOptionalNumber(env.WORKSPACE_HMR_MAX_REGRESSION_RATIO),
    maxImpactFileDelta: readOptionalNumber(env.WORKSPACE_HMR_MAX_IMPACT_DELTA),
    maxDirtyDelta: readOptionalNumber(env.WORKSPACE_HMR_MAX_DIRTY_DELTA),
    maxPendingDelta: readOptionalNumber(env.WORKSPACE_HMR_MAX_PENDING_DELTA),
    maxEmittedDelta: readOptionalNumber(env.WORKSPACE_HMR_MAX_EMITTED_DELTA),
  })
}

export function createWorkspaceHmrBaseline(
  results: ProjectResult[],
  options: {
    generatedAt: string
    mode: string
    scope?: WorkspaceHmrBaseline['scope']
    thresholds?: WorkspaceHmrThresholds
  },
): WorkspaceHmrBaseline {
  const scope = options.scope ?? 'templates'
  const selectedResults = scope === 'templates'
    ? results.filter(project => project.kind === 'templates')
    : results

  return {
    version: 1,
    scope,
    generatedAt: options.generatedAt,
    mode: options.mode,
    thresholds: mergeThresholds(DEFAULT_BASELINE_THRESHOLDS, options.thresholds),
    projects: Object.fromEntries(selectedResults.map((project) => {
      return [project.id, {
        startupMs: roundMetric(project.startupMs),
        scenarios: Object.fromEntries(project.scenarios.map((scenario) => {
          return [scenario.id, {
            totalMs: roundMetric(scenario.totalMs),
            dirtyCount: scenario.profile?.dirtyCount,
            pendingCount: scenario.profile?.pendingCount,
            emittedCount: scenario.profile?.emittedCount,
            impactFiles: scenario.impact?.length,
          }]
        })),
      }]
    })),
  }
}

export function evaluateWorkspaceHmrThresholds(
  results: ProjectResult[],
  options: {
    baseline?: WorkspaceHmrBaseline
    overrides?: WorkspaceHmrThresholds
  } = {},
): ThresholdEvaluation {
  const issues: ThresholdIssue[] = []
  const measuredScenarioMs = results
    .flatMap(project => project.scenarios.map(scenario => scenario.totalMs))
    .filter((value): value is number => typeof value === 'number')
  const scenarioP95Ms = percentile(measuredScenarioMs, 0.95)
  const globalThresholds = mergeThresholds(DEFAULT_BASELINE_THRESHOLDS, options.baseline?.thresholds, options.overrides)

  if (scenarioP95Ms != null && globalThresholds.maxScenarioP95Ms != null && scenarioP95Ms > globalThresholds.maxScenarioP95Ms) {
    issues.push({
      project: '<workspace>',
      metric: 'scenarioP95Ms',
      actual: scenarioP95Ms,
      limit: globalThresholds.maxScenarioP95Ms,
      message: `HMR P95 ${formatNumber(scenarioP95Ms)}ms exceeds ${formatNumber(globalThresholds.maxScenarioP95Ms)}ms`,
    })
  }

  for (const project of results) {
    const baselineProject = options.baseline?.projects[project.id]
    if (options.baseline?.scope === 'templates' && project.kind === 'templates' && !baselineProject) {
      issues.push(createMissingBaselineIssue(project.id, 'project'))
    }
    const projectThresholds = mergeThresholds(globalThresholds, baselineProject?.thresholds)

    if (project.startupMs != null) {
      checkAbsoluteLimit(issues, {
        project: project.id,
        metric: 'startupMs',
        actual: project.startupMs,
        limit: projectThresholds.maxStartupMs,
      })
    }

    for (const scenario of project.scenarios) {
      const baselineScenario = baselineProject?.scenarios[scenario.id]
      if (options.baseline?.scope === 'templates' && project.kind === 'templates' && !baselineScenario) {
        issues.push(createMissingBaselineIssue(project.id, scenario.id))
      }
      const scenarioThresholds = mergeThresholds(projectThresholds, baselineScenario?.thresholds)

      checkScenarioTime(issues, project.id, scenario, baselineScenario, scenarioThresholds)
      checkMetric(issues, project.id, scenario.id, 'impactFiles', scenario.impact?.length, baselineScenario?.impactFiles, scenarioThresholds.maxImpactFiles, scenarioThresholds.maxImpactFileDelta)
      checkMetric(issues, project.id, scenario.id, 'dirtyCount', scenario.profile?.dirtyCount, baselineScenario?.dirtyCount, scenarioThresholds.maxDirtyCount, scenarioThresholds.maxDirtyDelta)
      checkMetric(issues, project.id, scenario.id, 'pendingCount', scenario.profile?.pendingCount, baselineScenario?.pendingCount, scenarioThresholds.maxPendingCount, scenarioThresholds.maxPendingDelta)
      checkMetric(issues, project.id, scenario.id, 'emittedCount', scenario.profile?.emittedCount, baselineScenario?.emittedCount, scenarioThresholds.maxEmittedCount, scenarioThresholds.maxEmittedDelta)
    }
  }

  return {
    scenarioCount: results.reduce((count, project) => count + project.scenarios.length, 0),
    measuredScenarioCount: measuredScenarioMs.length,
    scenarioP95Ms,
    issues,
  }
}

function checkScenarioTime(
  issues: ThresholdIssue[],
  project: string,
  scenario: ScenarioResult,
  baseline: WorkspaceHmrBaselineScenario | undefined,
  thresholds: WorkspaceHmrThresholds,
) {
  if (scenario.totalMs == null) {
    return
  }
  const regressionLimit = baseline?.totalMs == null
    ? undefined
    : baseline.totalMs + Math.max(
      thresholds.maxRegressionMs ?? 0,
      baseline.totalMs * (thresholds.maxRegressionRatio ?? 0),
    )
  const limit = minDefined(thresholds.maxScenarioMs, regressionLimit)
  checkAbsoluteLimit(issues, {
    project,
    scenario: scenario.id,
    metric: 'totalMs',
    actual: scenario.totalMs,
    limit,
    baseline: baseline?.totalMs,
  })
}

function checkMetric(
  issues: ThresholdIssue[],
  project: string,
  scenario: string,
  metric: string,
  actual: number | undefined,
  baseline: number | undefined,
  maxLimit: number | undefined,
  deltaLimit: number | undefined,
) {
  if (actual == null) {
    return
  }
  const regressionLimit = baseline == null || deltaLimit == null ? undefined : baseline + deltaLimit
  const limit = baseline != null && maxLimit != null && baseline > maxLimit
    ? regressionLimit
    : minDefined(maxLimit, regressionLimit)
  checkAbsoluteLimit(issues, {
    project,
    scenario,
    metric,
    actual,
    limit,
    baseline,
  })
}

function checkAbsoluteLimit(
  issues: ThresholdIssue[],
  input: {
    project: string
    scenario?: string
    metric: string
    actual: number
    limit?: number
    baseline?: number
  },
) {
  if (input.limit == null || input.actual <= input.limit) {
    return
  }
  issues.push({
    project: input.project,
    scenario: input.scenario,
    metric: input.metric,
    actual: input.actual,
    limit: input.limit,
    baseline: input.baseline,
    message: `${input.metric} ${formatNumber(input.actual)} exceeds ${formatNumber(input.limit)}`,
  })
}

function createMissingBaselineIssue(project: string, scenario: string): ThresholdIssue {
  return {
    project,
    scenario,
    metric: 'baseline',
    actual: 1,
    limit: 0,
    message: `Missing HMR baseline for ${project} ${scenario}`,
  }
}

function mergeThresholds(...items: Array<WorkspaceHmrThresholds | undefined>): WorkspaceHmrThresholds {
  const result: WorkspaceHmrThresholds = {}
  for (const item of items) {
    if (!item) {
      continue
    }
    for (const [key, value] of Object.entries(item) as Array<[keyof WorkspaceHmrThresholds, number | undefined]>) {
      if (value != null) {
        result[key] = value
      }
    }
  }
  return result
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) {
    return undefined
  }
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.ceil(sorted.length * percentileValue) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))]
}

function minDefined(...values: Array<number | undefined>) {
  const defined = values.filter((value): value is number => value != null)
  if (!defined.length) {
    return undefined
  }
  return Math.min(...defined)
}

function readOptionalNumber(raw: string | undefined) {
  if (raw == null || raw === '') {
    return undefined
  }
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid workspace HMR threshold: ${raw}`)
  }
  return value
}

function roundMetric(value: number | undefined) {
  return value == null ? undefined : Math.round(value)
}
