import type { ThresholdEvaluation } from './types'

export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function renderThresholdMarkdown(evaluation: ThresholdEvaluation) {
  const lines = [
    '## Threshold Summary',
    '',
    `- measured scenarios: ${evaluation.measuredScenarioCount}/${evaluation.scenarioCount}`,
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
