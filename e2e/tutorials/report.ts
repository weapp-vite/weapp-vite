import type {
  TutorialPackageManager,
  TutorialScenarioId,
  TutorialSource,
} from './config'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface TutorialStepResult {
  durationMs: number
  name: string
  status: 'failed' | 'passed'
}

export interface TutorialRunResult {
  error?: string
  id: string
  packageManager: TutorialPackageManager
  scenario: TutorialScenarioId
  source: TutorialSource
  status: 'failed' | 'passed'
  steps: TutorialStepResult[]
  template: string
}

export interface TutorialReport {
  generatedAt: string
  nodeVersion: string
  platform: string
  results: TutorialRunResult[]
  source: TutorialSource
}

export class TutorialRunRecorder {
  readonly steps: TutorialStepResult[] = []

  async step<T>(name: string, action: () => Promise<T>) {
    const startedAt = Date.now()
    try {
      const result = await action()
      this.steps.push({ durationMs: Date.now() - startedAt, name, status: 'passed' })
      return result
    }
    catch (error) {
      this.steps.push({ durationMs: Date.now() - startedAt, name, status: 'failed' })
      throw error
    }
  }
}

function escapeTableCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', '<br>')
}

function renderMarkdown(report: TutorialReport) {
  const failed = report.results.filter(result => result.status === 'failed')
  const lines = [
    '# Tutorial E2E Report',
    '',
    `- Source: \`${report.source}\``,
    `- Platform: \`${report.platform}\``,
    `- Node: \`${report.nodeVersion}\``,
    `- Scenarios: ${report.results.length}`,
    `- Failures: ${failed.length}`,
    '',
    '| Scenario | Template | Package manager | Status | Steps |',
    '| --- | --- | --- | --- | --- |',
    ...report.results.map((result) => {
      const steps = result.steps
        .map(step => `${step.name}=${step.status} (${step.durationMs}ms)`)
        .join('<br>')
      return `| ${result.scenario} | ${result.template} | ${result.packageManager} | ${result.status} | ${steps} |`
    }),
  ]

  if (failed.length > 0) {
    lines.push('', '## Failures', '')
    for (const result of failed) {
      lines.push(`- \`${result.id}\`: ${escapeTableCell(result.error ?? 'Unknown failure')}`)
    }
  }

  return `${lines.join('\n')}\n`
}

export async function writeTutorialReport(outputDir: string, report: TutorialReport) {
  await fs.mkdir(outputDir, { recursive: true })
  await Promise.all([
    fs.writeFile(
      path.join(outputDir, `tutorial-e2e-${report.source}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    ),
    fs.writeFile(
      path.join(outputDir, `tutorial-e2e-${report.source}.md`),
      renderMarkdown(report),
      'utf8',
    ),
  ])
}
