import type { ProjectResult, ThresholdEvaluation, WorkspaceHmrBaseline, WorkspaceHmrThresholds } from './types'
import { evaluateWorkspaceHmrThresholds } from './baseline'
import { workspaceHmrIncrementalImpact } from './delivery'
import { summarizeWorkspaceHmrExecution } from './report'

/** 功能验收必须显式选择，且不能同时写入性能基线。 */
export function readWorkspaceHmrFunctionalOnly(raw: string | undefined, writeBaseline = false): boolean {
  if (raw !== undefined && raw !== '' && raw !== '0' && raw !== '1') {
    throw new Error('WEAPP_VITE_HMR_AUDIT_FUNCTIONAL_ONLY must be 0 or 1')
  }
  const functionalOnly = raw === '1'
  if (functionalOnly && writeBaseline) {
    throw new Error('Functional-only workspace HMR cannot write a performance baseline')
  }
  return functionalOnly
}

/** 保留全部功能交付证据；仅显式功能模式不计算性能阈值。 */
export function evaluateWorkspaceHmrAudit(results: ProjectResult[], options: {
  functionalOnly: boolean
  baseline?: WorkspaceHmrBaseline
  overrides?: WorkspaceHmrThresholds
}): ThresholdEvaluation {
  if (!options.functionalOnly) {
    return { ...evaluateWorkspaceHmrThresholds(results, options), comparison: 'evaluated', scope: 'in-scope' }
  }
  const issues: ThresholdEvaluation['issues'] = []
  for (const project of results) {
    for (const scenario of project.scenarios) {
      try {
        workspaceHmrIncrementalImpact(scenario)
      }
      catch (error) {
        issues.push({ project: project.id, scenario: scenario.id, metric: 'delivery-evidence', actual: 0, limit: 1, message: error instanceof Error ? error.message : String(error) })
      }
    }
  }
  return {
    comparison: 'not-evaluated',
    scope: 'out-of-scope',
    scenarioCount: results.reduce((count, project) => count + project.scenarios.length, 0),
    measuredScenarioCount: 0,
    issues,
  }
}

/** 交付、恢复、清理失败和未执行场景都不能由性能范围选择豁免。 */
export function workspaceHmrFailedProjects(results: ProjectResult[]): ProjectResult[] {
  return results.filter(project => project.error || project.scenarios.some(scenario => scenario.error
    || scenario.cleanupErrors?.length || scenario.failedStage || scenario.cleanupFailedStage))
}

export function workspaceHmrAuditExitCode(results: ProjectResult[], evaluation: ThresholdEvaluation, failOnError: boolean): 0 | 1 {
  return failOnError && (workspaceHmrFailedProjects(results).length
    || summarizeWorkspaceHmrExecution(results).notExecutedScenarioCount
    || evaluation.issues.length)
    ? 1
    : 0
}
