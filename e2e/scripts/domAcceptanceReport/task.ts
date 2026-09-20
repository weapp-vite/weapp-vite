import type { SuiteTask } from '../suiteRunner'
import type { PlannedTaskCase } from './taskCases'
import type { AcceptanceIdentity, AcceptanceReport } from './types'
import fs from 'node:fs/promises'
import process from 'node:process'
import { assertAcceptanceReportPassed } from './helpers'
import { assertTaskCaseCoverage, readPlannedTaskCases } from './taskCases'

export async function validateTaskAcceptance(task: SuiteTask, identity: AcceptanceIdentity, plannedCases?: PlannedTaskCase[]) {
  const artifacts = task.artifacts?.filter(artifact => artifact.kind === 'dom-acceptance-report') ?? []
  if (!artifacts.length) {
    throw new Error('Missing DOM acceptance reporter output; task cannot be accepted from its exit code')
  }
  const reports: AcceptanceReport[] = []
  const invocationIds = new Set<string>()
  for (const artifact of artifacts) {
    const report: unknown = JSON.parse(await fs.readFile(artifact.indexPath, 'utf8'))
    assertAcceptanceReportPassed(report, identity)
    const provider = (task.env?.WEAPP_VITE_E2E_RUNTIME_PROVIDER ?? process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER) === 'headless' ? 'headless' : 'devtools'
    if (report.taskLabel !== task.label || report.provider !== provider) {
      throw new Error('DOM acceptance report belongs to a different task or runtime provider')
    }
    if (invocationIds.has(report.invocationId)) {
      throw new Error('Duplicate DOM acceptance invocation')
    }
    invocationIds.add(report.invocationId)
    reports.push(report)
  }
  if (task.acceptanceTemplates) {
    const actual = reports.map(report => report.template).sort()
    const expected = [...task.acceptanceTemplates].sort()
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Template DOM acceptance invocations incomplete: expected ${expected.join(', ')}`)
    }
  }
  assertTaskCaseCoverage(plannedCases ?? await readPlannedTaskCases(task, reports[0]!.provider), reports)
}
