import type { SuiteTask } from '../suiteRunner'
import type { AcceptanceReport } from './types'
import { ACCEPTANCE_ROOT } from './helpers'

export interface PlannedTaskCase {
  file: string
  name: string
}

export async function readPlannedTaskCases(task: SuiteTask, provider: AcceptanceReport['provider']): Promise<PlannedTaskCase[]> {
  const { readTaskCases } = await import('./inventory')
  const cases = readTaskCases(ACCEPTANCE_ROOT, task.label, task.acceptanceTemplates)
  if (!cases.length || cases.some(item => item.notes.some(note => note.startsWith('Dynamic')))) {
    throw new Error(`Cannot resolve complete DOM case inventory for ${task.label}`)
  }
  return cases.map((item) => {
    const name = item.name.replaceAll(/\$\{runtimeProvider\}/g, provider)
    if (/\$\{[^}]+\}/.test(name)) {
      throw new Error(`Unresolved DOM case name in ${task.label}: ${name}`)
    }
    return { file: `e2e/${task.label}`, name }
  })
}

export function assertTaskCaseCoverage(expected: PlannedTaskCase[], reports: Pick<AcceptanceReport, 'cases'>[]) {
  const key = (item: PlannedTaskCase) => JSON.stringify([item.file.replaceAll('\\', '/'), item.name])
  const planned = expected.map(key).sort()
  const actual = reports.flatMap(report => report.cases.map(key)).sort()
  if (!planned.length || JSON.stringify(actual) !== JSON.stringify(planned)) {
    const missing = [...planned]
    const unexpected: string[] = []
    for (const item of actual) {
      const index = missing.indexOf(item)
      if (index < 0) {
        unexpected.push(item)
      }
      else {
        missing.splice(index, 1)
      }
    }
    throw new Error(`DOM case inventory mismatch: planned=${planned.length} executed=${actual.length}; missing=${JSON.stringify(missing)}; unexpected=${JSON.stringify(unexpected)}`)
  }
}
