import type { DomAcceptance } from '../../utils/domAcceptance/types'
import type { RuntimeDiagnostic } from './runtimeDiagnostics'
import { describe, expect, it } from 'vitest'
import { evaluateExpectedErrors } from './expectedErrors'

function fixture() {
  const expected = { source: 'runtime' as const, level: 'error' as const, channel: 'runtime', text: 'intentional failure', count: 1 }
  const plan: DomAcceptance = {
    fixture: 'e2e-apps/base',
    provider: 'devtools',
    evidence: [],
    checkpoints: [{ id: 'reject', route: 'pages/index/index', action: 'reject request', nodes: [{ selector: '.result', text: 'rejected' }], expectedErrors: [expected] }],
    errorScopes: [{ checkpoint: 'reject', id: 'scope-a' }],
  }
  const cases = [{ id: 'case-a', file: 'example.test.ts', name: 'rejects', state: 'passed' as const, acceptance: plan }]
  const entry = { observedAt: '2026-09-01T00:00:01.000Z', caseId: 'case-a', phase: 'case' as const }
  const boundary = (phase: 'start' | 'end'): RuntimeDiagnostic => ({
    ...entry,
    event: { source: 'runtime', kind: 'message', project: 'base', level: 'debug', acceptanceScope: { id: 'scope-a', caseId: 'case-a', checkpointId: 'reject', boundary: phase } },
  })
  const error: RuntimeDiagnostic = { ...entry, scopeId: 'scope-a', checkpointId: 'reject', event: { ...expected, kind: 'message', project: 'base' } }
  return { cases, plan, diagnostics: [boundary('start'), error, boundary('end')] }
}

describe('exact expected IDE errors', () => {
  it('consumes only the exact error count in a completed case checkpoint action', () => {
    const { cases, diagnostics } = fixture()
    expect(evaluateExpectedErrors(cases, diagnostics)).toEqual([])
  })

  it.each(['text', 'channel', 'caseId', 'checkpointId', 'scopeId'] as const)('does not broaden matching for a different %s', (key) => {
    const { cases, diagnostics } = fixture()
    if (key === 'text' || key === 'channel') {
      diagnostics[1]!.event[key] = 'different'
    }
    else {
      diagnostics[1]![key] = 'different'
    }
    expect(evaluateExpectedErrors(cases, diagnostics).some(error => error.startsWith('Unclassified'))).toBe(true)
  })

  it.each([0, 2])('rejects receiving %s errors when exactly one was declared', (count) => {
    const { cases, diagnostics } = fixture()
    const entries = [diagnostics[0]!, ...Array.from({ length: count }, () => structuredClone(diagnostics[1]!)), diagnostics[2]!]
    expect(evaluateExpectedErrors(cases, entries).some(error => error.includes('count mismatch'))).toBe(true)
  })

  it('rejects missing, unfinished, repeated or cross-case action boundaries', () => {
    for (const mutate of [
      (entries: RuntimeDiagnostic[]) => { entries.shift() },
      (entries: RuntimeDiagnostic[]) => { entries.pop() },
      (entries: RuntimeDiagnostic[]) => { entries.push(entries[2]!) },
      (entries: RuntimeDiagnostic[]) => { entries[0]!.event.acceptanceScope!.caseId = 'other-case' },
    ]) {
      const { cases, diagnostics } = fixture()
      mutate(diagnostics)
      expect(evaluateExpectedErrors(cases, diagnostics).some(error => error.includes('completed matching action'))).toBe(true)
    }
  })

  it('does not consume the same error outside its action window', () => {
    const { cases, diagnostics } = fixture()
    const error = diagnostics.splice(1, 1)[0]!
    diagnostics.push(error)
    expect(evaluateExpectedErrors(cases, diagnostics).some(error => error.startsWith('Unclassified'))).toBe(true)
  })

  it('requires a declared action scope and cannot reuse it across cases', () => {
    const { cases, plan, diagnostics } = fixture()
    expect(evaluateExpectedErrors([...cases, { ...cases[0]!, id: 'case-b' }], diagnostics).some(error => error.includes('reused diagnostic scope'))).toBe(true)
    plan.errorScopes = []
    expect(evaluateExpectedErrors(cases, diagnostics).some(error => error.includes('exactly one action scope'))).toBe(true)
  })
})
