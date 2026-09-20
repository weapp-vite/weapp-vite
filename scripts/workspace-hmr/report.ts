import type { ProjectResult, ThresholdEvaluation } from './types'

export interface WorkspaceHmrExecutionSummary {
  executedScenarioCount: number
  successfulScenarioCount: number
  failedScenarioCount: number
  notExecutedScenarioCount: number
  compilerProfileSampleCount: number
}

export function summarizeWorkspaceHmrExecution(results: ProjectResult[]): WorkspaceHmrExecutionSummary {
  const scenarios = results.flatMap(project => project.scenarios)
  const executed = scenarios.filter(scenario => !scenario.error?.startsWith('Not executed:') && (
    scenario.marker !== undefined
    || scenario.observedMs !== undefined
    || scenario.totalMs !== undefined
    || scenario.profile !== undefined
  ))
  return {
    executedScenarioCount: executed.length,
    successfulScenarioCount: executed.filter(scenario => !scenario.error).length,
    failedScenarioCount: executed.filter(scenario => scenario.error).length,
    notExecutedScenarioCount: scenarios.length - executed.length,
    compilerProfileSampleCount: scenarios.filter(scenario => scenario.profile?.totalMs !== undefined).length,
  }
}

export function renderWorkspaceHmrExecution(summary: WorkspaceHmrExecutionSummary, scenarioCount: number) {
  return [
    `- executed scenarios: ${summary.executedScenarioCount}/${scenarioCount}`,
    `- successful scenarios: ${summary.successfulScenarioCount}`,
    `- failed scenarios: ${summary.failedScenarioCount}`,
    `- not executed scenarios: ${summary.notExecutedScenarioCount}`,
    `- compiler profile samples: ${summary.compilerProfileSampleCount}/${scenarioCount}`,
  ]
}

export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function renderThresholdMarkdown(evaluation: ThresholdEvaluation, execution?: WorkspaceHmrExecutionSummary) {
  const lines = [
    '## Threshold Summary',
    '',
    ...(execution ? renderWorkspaceHmrExecution(execution, evaluation.scenarioCount) : []),
    `- timing threshold samples: ${evaluation.measuredScenarioCount}/${evaluation.scenarioCount}`,
    `- scenario P95: ${evaluation.scenarioP95Ms == null ? '-' : `${formatNumber(evaluation.scenarioP95Ms)}ms`}`,
    `- threshold issues: ${evaluation.issues.length}`,
    '',
  ]

  if (!evaluation.issues.length) {
    lines.push('No threshold regressions detected.', '')
    return lines.join('\n')
  }

  lines.push('| project | scenario | metric | actual | limit | baseline |')
  lines.push('| --- | --- | --- | ---: | ---: | ---: |')
  for (const issue of evaluation.issues) {
    lines.push([
      issue.project,
      issue.scenario ?? '-',
      issue.metric,
      formatNumber(issue.actual),
      formatNumber(issue.limit),
      issue.baseline == null ? '-' : formatNumber(issue.baseline),
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }
  lines.push('')
  return lines.join('\n')
}
