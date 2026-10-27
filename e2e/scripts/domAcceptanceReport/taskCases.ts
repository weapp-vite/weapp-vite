import type { SuiteTask } from '../suiteRunner'
import type { PlannedTaskCase } from './caseCoverage'
import type { AcceptanceReport } from './types'
import process from 'node:process'
import { freezeProviderCaseScope } from './caseCoverage'
import { ACCEPTANCE_ROOT } from './helpers'
import { readSelectedAcceptanceCases } from './selectedCases'

export { assertTaskCaseCoverage, freezeProviderCaseScope, isValidProviderCaseScope, providerOutOfScopeCases } from './caseCoverage'
export type { PlannedTaskCase, ProviderCaseScope } from './caseCoverage'

export type PlannedTaskCaseReader = (task: SuiteTask, provider: AcceptanceReport['provider']) => Promise<PlannedTaskCase[]>

/** 延迟加载 AST 模块；复用静态清单后仍为每个 provider 独立冻结名称与范围。 */
export function createPlannedTaskCaseReader(root = ACCEPTANCE_ROOT): PlannedTaskCaseReader {
  let inventory: Promise<ReturnType<typeof import('./inventory')['createTaskCaseReader']>> | undefined
  return async (task, provider) => {
    const selected = readSelectedAcceptanceCases({ ...process.env, ...task.env })
    if (selected) {
      return selected
    }
    inventory ??= import('./inventory').then(({ createTaskCaseReader }) => createTaskCaseReader(root))
    const readCases = await inventory
    const cases = readCases(task.label, task.acceptanceTemplates)
    if (!cases.length || cases.some(item => item.notes.some(note => note.startsWith('Dynamic')))) {
      throw new Error(`Cannot resolve complete DOM case inventory for ${task.label}`)
    }
    return cases.map((item) => {
      const name = item.name.replaceAll(/\$\{runtimeProvider\}/g, provider)
      if (/\$\{[^}]+\}/.test(name)) {
        throw new Error(`Unresolved DOM case name in ${task.label}: ${name}`)
      }
      return { file: `e2e/${task.label}`, name, ...(item.providerApplicability ? { providerScope: freezeProviderCaseScope(item.providerApplicability, provider) } : {}) }
    })
  }
}

export function readPlannedTaskCases(task: SuiteTask, provider: AcceptanceReport['provider']): Promise<PlannedTaskCase[]> {
  return createPlannedTaskCaseReader()(task, provider)
}
