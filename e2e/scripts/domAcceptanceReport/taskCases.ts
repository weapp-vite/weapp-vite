import type { SuiteTask } from '../suiteRunner'
import type { AcceptanceProvider, ProviderCaseApplicability } from './inventoryProviders'
import type { AcceptanceReport } from './types'
import process from 'node:process'
import { ACCEPTANCE_ROOT } from './helpers'
import { readSelectedAcceptanceCases } from './selectedCases'

export interface PlannedTaskCase {
  file: string
  name: string
  providerScope?: ProviderCaseScope
}

export interface ProviderCaseScope extends ProviderCaseApplicability {
  provider: AcceptanceProvider
  scope: 'in-scope' | 'out-of-scope'
  reason: string
}

function providerScopeReason(applicability: ProviderCaseApplicability, provider: AcceptanceProvider) {
  return `Provider ${provider} ${applicability.providers.includes(provider) ? 'satisfies' : 'is outside'} declared applicability (${applicability.providers.join(', ') || 'none'}): ${applicability.conditions.map(condition => `${condition.modifier}(${condition.expression}) at ${condition.source}`).join('; ')}`
}

export function freezeProviderCaseScope(applicability: ProviderCaseApplicability, provider: AcceptanceProvider): ProviderCaseScope {
  return { ...applicability, provider, scope: applicability.providers.includes(provider) ? 'in-scope' : 'out-of-scope', reason: providerScopeReason(applicability, provider) }
}

/** 冻结的 provider 范围必须自洽；缺少来源和条件的普通 skip 不能借此通过。 */
export function isValidProviderCaseScope(scope: ProviderCaseScope | undefined, provider: AcceptanceProvider): boolean {
  if (!scope) {
    return true
  }
  return scope.provider === provider
    && Array.isArray(scope.providers) && scope.providers.length > 0 && new Set(scope.providers).size === scope.providers.length
    && scope.providers.every(item => item === 'devtools' || item === 'headless')
    && Array.isArray(scope.conditions) && scope.conditions.length > 0
    && scope.conditions.every(condition => (condition.modifier === 'runIf' || condition.modifier === 'skipIf')
      && typeof condition.expression === 'string' && condition.expression.trim().length > 0
      && typeof condition.source === 'string' && /^e2e\/.+:\d+$/.test(condition.source))
    && scope.scope === (scope.providers.includes(provider) ? 'in-scope' : 'out-of-scope')
    && scope.reason === providerScopeReason(scope, provider)
}

export function providerOutOfScopeCases(cases: PlannedTaskCase[] = []) {
  return cases.filter(item => item.providerScope?.scope === 'out-of-scope')
}

export async function readPlannedTaskCases(task: SuiteTask, provider: AcceptanceReport['provider']): Promise<PlannedTaskCase[]> {
  const selected = readSelectedAcceptanceCases({ ...process.env, ...task.env })
  if (selected) {
    return selected
  }
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
    return { file: `e2e/${task.label}`, name, ...(item.providerApplicability ? { providerScope: freezeProviderCaseScope(item.providerApplicability, provider) } : {}) }
  })
}

export function assertTaskCaseCoverage(expected: PlannedTaskCase[], reports: Pick<AcceptanceReport, 'cases'>[], selected = false, provider?: AcceptanceProvider) {
  if (expected.some(item => item.providerScope && (!provider || !isValidProviderCaseScope(item.providerScope, provider)))) {
    throw new Error('Invalid frozen DOM provider case applicability')
  }
  const key = (item: PlannedTaskCase) => JSON.stringify([item.file.replaceAll('\\', '/'), item.name])
  const planned = expected.map(key).sort()
  const collected = reports.flatMap(report => report.cases)
  const actual = collected
    .filter(item => !selected || planned.includes(key(item)) || item.state !== 'skipped' || item.acceptance)
    .map(key)
    .sort()
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
  const incomplete = collected.find((item) => {
    const frozen = expected.find(expected => key(expected) === key(item))
    if (!frozen) {
      return false
    }
    return frozen.providerScope?.scope === 'out-of-scope'
      ? item.state !== 'skipped' || item.status !== 'skipped' || Boolean(item.acceptance) || item.violations.length > 0 || Boolean(item.errors?.length)
      : item.state !== 'passed' || item.status !== 'passed' || !item.acceptance
  })
  if (incomplete) {
    throw new Error(`Planned DOM case did not pass with acceptance evidence: ${incomplete.file} > ${incomplete.name}`)
  }
}
