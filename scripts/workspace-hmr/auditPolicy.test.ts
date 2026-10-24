import type { ProjectResult } from './types'
import { describe, expect, it } from 'vitest'
import { evaluateWorkspaceHmrAudit, readWorkspaceHmrFunctionalOnly, workspaceHmrAuditExitCode } from './auditPolicy'
import { renderThresholdMarkdown, summarizeWorkspaceHmrExecution } from './report'

function fixture(): ProjectResult[] {
  return [{
    id: 'apps/example',
    kind: 'apps',
    platform: 'weapp',
    source: 'apps/example',
    scenarios: [{
      id: 'native-script',
      label: 'native script',
      source: 'src/page.ts',
      output: 'dist/page.js',
      marker: 'observed-current-generation',
      totalMs: 5_000,
      expectedDelivery: 'classic',
      actualMode: 'classic',
    }],
  }]
}

describe('workspace HMR acceptance scope', () => {
  it('defaults to full and rejects ambiguous selection or writing a baseline in functional mode', () => {
    for (const raw of [undefined, '', '0']) {
      expect(readWorkspaceHmrFunctionalOnly(raw)).toBe(false)
    }
    expect(readWorkspaceHmrFunctionalOnly('1')).toBe(true)
    expect(() => readWorkspaceHmrFunctionalOnly('true')).toThrow('must be 0 or 1')
    expect(() => readWorkspaceHmrFunctionalOnly('1', true)).toThrow('cannot write a performance baseline')
  })

  it('keeps the full performance thresholds and nonzero exit unchanged', () => {
    const results = fixture()
    const evaluation = evaluateWorkspaceHmrAudit(results, { functionalOnly: false, overrides: { maxScenarioMs: 1 } })
    expect(evaluation.comparison).toBe('evaluated')
    expect(evaluation.issues).toContainEqual(expect.objectContaining({ metric: 'totalMs', actual: 5_000, limit: 1 }))
    expect(workspaceHmrAuditExitCode(results, evaluation, true)).toBe(1)
  })

  it('does not read historical performance inputs or report an unevaluated comparison as passing', () => {
    const results = fixture()
    const evaluation = evaluateWorkspaceHmrAudit(results, {
      functionalOnly: true,
      get baseline(): never {
        throw new Error('must not read the historical baseline')
      },
      get overrides(): never {
        throw new Error('must not evaluate performance thresholds')
      },
    })
    expect(evaluation).toEqual({ comparison: 'not-evaluated', scope: 'out-of-scope', scenarioCount: 1, measuredScenarioCount: 0, issues: [] })
    expect(workspaceHmrAuditExitCode(results, evaluation, true)).toBe(0)
    const markdown = renderThresholdMarkdown(evaluation, summarizeWorkspaceHmrExecution(results))
    expect(markdown).toContain('performance comparison: not-evaluated')
    expect(markdown).toContain('performance scope: out-of-scope')
    expect(markdown).not.toContain('No threshold regressions detected')
    expect(markdown).not.toContain('timing threshold samples:')
  })

  it.each(['project', 'scenario', 'cleanup', 'restore', 'cleanup-stage', 'not-executed', 'no-observation'] as const)('still fails functional-only acceptance for %s failure', (failure) => {
    const results = fixture()
    const project = results[0]!
    const scenario = project.scenarios[0]!
    if (failure === 'project') {
      project.error = 'dev process failed'
    }
    if (failure === 'scenario') {
      scenario.error = 'the rendered generation did not update'
    }
    if (failure === 'cleanup') {
      scenario.cleanupErrors = ['owned watcher did not stop']
    }
    if (failure === 'restore') {
      scenario.failedStage = { phase: 'restore', step: 'publication.inspect-output' }
    }
    if (failure === 'cleanup-stage') {
      scenario.cleanupFailedStage = { phase: 'cleanup', step: 'restore source' }
    }
    if (failure === 'not-executed') {
      scenario.error = 'Not executed: previous restore failed'
    }
    if (failure === 'no-observation') {
      delete scenario.marker
      delete scenario.totalMs
    }
    const evaluation = evaluateWorkspaceHmrAudit(results, { functionalOnly: true })
    expect(evaluation.comparison).toBe('not-evaluated')
    expect(workspaceHmrAuditExitCode(results, evaluation, true)).toBe(1)
  })

  it.each(['unexpected-mode', 'missing-transition-proof'] as const)('retains %s delivery evidence assertions outside performance evaluation', (failure) => {
    const results = fixture()
    const scenario = results[0]!.scenarios[0]!
    if (failure === 'unexpected-mode') {
      scenario.actualMode = 'stateful-experimental'
    }
    else {
      scenario.expectedDelivery = 'classic-fallback'
      scenario.expectedFallbackReason = 'native-registration'
      scenario.deliveryEvidence = { delivery: 'classic', reason: 'native-registration' }
    }
    const evaluation = evaluateWorkspaceHmrAudit(results, { functionalOnly: true })
    expect(evaluation.issues).toContainEqual(expect.objectContaining({ metric: 'delivery-evidence' }))
    expect(workspaceHmrAuditExitCode(results, evaluation, true)).toBe(1)
  })
})
