import type { RuntimeDiagnostic } from './runtimeDiagnostics'
import type { AcceptanceCaseInput } from './types'

export function evaluateExpectedErrors(cases: AcceptanceCaseInput[], diagnostics: RuntimeDiagnostic[]) {
  const remaining = diagnostics.filter(item => item.event.level === 'error' || item.event.level === 'exception')
  const violations: string[] = []
  const scopeIds = new Set<string>()
  for (const item of cases) {
    for (const scope of item.acceptance?.errorScopes ?? []) {
      if (scopeIds.has(scope.id) || !item.acceptance?.checkpoints.some(checkpoint => checkpoint.id === scope.checkpoint)) {
        violations.push(`Invalid or reused diagnostic scope in ${item.id}`)
      }
      scopeIds.add(scope.id)
    }
    for (const checkpoint of item.acceptance?.checkpoints ?? []) {
      if (!checkpoint.expectedErrors?.length) {
        continue
      }
      const scopes = item.acceptance!.errorScopes?.filter(scope => scope.checkpoint === checkpoint.id) ?? []
      if (scopes.length !== 1) {
        violations.push(`Expected errors require exactly one action scope: ${item.id}/${checkpoint.id}`)
        continue
      }
      const boundaries = diagnostics.filter(entry => entry.event.acceptanceScope?.id === scopes[0]!.id)
      if (boundaries.length !== 2 || boundaries[0]!.event.acceptanceScope?.boundary !== 'start'
        || boundaries[1]!.event.acceptanceScope?.boundary !== 'end'
        || boundaries.some(entry => entry.event.acceptanceScope?.caseId !== item.id || entry.event.acceptanceScope?.checkpointId !== checkpoint.id)) {
        violations.push(`Expected errors require a completed matching action: ${item.id}/${checkpoint.id}`)
        continue
      }
      const startIndex = diagnostics.indexOf(boundaries[0]!)
      const endIndex = diagnostics.indexOf(boundaries[1]!)
      for (const expected of checkpoint.expectedErrors) {
        const matches = remaining.filter(actual => actual.caseId === item.id && actual.checkpointId === checkpoint.id
          && actual.scopeId === scopes[0]!.id && actual.event.source === expected.source && actual.event.level === expected.level
          && actual.event.channel === expected.channel && actual.event.text === expected.text
          && diagnostics.indexOf(actual) > startIndex && diagnostics.indexOf(actual) < endIndex)
        if (matches.length !== expected.count) {
          violations.push(`Expected error count mismatch: ${item.id}/${checkpoint.id}: expected ${expected.count}, received ${matches.length}: ${expected.text}`)
        }
        else {
          for (const match of matches) {
            remaining.splice(remaining.indexOf(match), 1)
          }
        }
      }
    }
  }
  return [...violations, ...remaining.map(item => `Unclassified IDE ${item.event.source} ${item.event.level}${item.caseId ? ` in ${item.caseId}` : ' outside a case'}: ${item.event.text || '<empty diagnostic>'}`)]
}
