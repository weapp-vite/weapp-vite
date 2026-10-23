import type { ProjectResult, ScenarioResult } from './types'
import { describe, expect, it } from 'vitest'
import { evaluateWorkspaceHmrThresholds } from './baseline'
import { assertWorkspaceHmrDelivery, expectedWorkspaceHmrDelivery, orderWorkspaceHmrScenarios, planWorkspaceHmrScenarios, workspaceHmrFallbackReason } from './delivery'
import { summarizeWorkspaceHmrExecution } from './report'

const impact = (count: number) => Array.from({ length: count }, (_, index) => ({ path: `pages/page-${index}.js`, status: 'modified' as const }))
const transition: ScenarioResult = {
  id: 'vue-template',
  label: 'compiled template',
  source: 'src/page.vue',
  output: 'dist/page.wxml',
  expectedDelivery: 'classic-fallback',
  expectedFallbackReason: 'native-registration',
  actualMode: 'classic',
  deliveryEvidence: { delivery: 'classic', reason: 'native-registration' },
  restoreDelivery: { delivery: 'classic' },
  repeatDelivery: { delivery: 'classic' },
  classicPublication: { files: [{ path: 'app.js', hash: 'a'.repeat(64), size: 8 }], checkedFileCount: 1, transport: 'retired-410' },
  impact: impact(30),
  steadyClassicImpact: impact(1),
}
const project = (scenario: ScenarioResult): ProjectResult => ({ id: 'apps/example', kind: 'apps', platform: 'weapp', source: 'apps/example', scenarios: [scenario] })

describe('workspace HMR delivery admission and impact measurement', () => {
  it.each([
    ['stateful', false, false, 'stateful'],
    ['stateful', false, true, 'classic-fallback'],
    ['stateful', true, false, 'classic'],
    ['stateful', true, true, 'classic'],
    ['standard', false, true, 'classic'],
  ] as const)('freezes %s / classic=%s / requiresClassic=%s as %s', (mode, classic, requiresClassic, expected) => {
    expect(expectedWorkspaceHmrDelivery(mode, classic, requiresClassic)).toBe(expected)
  })

  it('preserves every case and runs supported scripts before irreversible stylesheet or template fallback', () => {
    const scenarios = [
      { id: 'native-template' },
      { id: 'native-style', classicFallbackReason: 'stylesheet-output' },
      { id: 'vue-template', statefulTemplate: true },
      { id: 'vue-script' },
      { id: 'vue-style', classicFallbackReason: 'stylesheet-output' },
    ]
    expect(orderWorkspaceHmrScenarios(scenarios).map(item => item.id)).toEqual(['native-template', 'vue-script', 'native-style', 'vue-template', 'vue-style'])
    expect(scenarios.map(item => item.id)).toEqual(['native-template', 'native-style', 'vue-template', 'vue-script', 'vue-style'])
  })

  it('uses declared change semantics without inferring a capability from scenario names', () => {
    expect(workspaceHmrFallbackReason({ classicFallbackReason: 'stylesheet-output' })).toBe('stylesheet-output')
    expect(workspaceHmrFallbackReason({ statefulTemplate: true })).toBe('native-registration')
    expect(workspaceHmrFallbackReason({ statefulTemplate: true, classicFallbackReason: 'patch-shape' })).toBe('patch-shape')
    expect(workspaceHmrFallbackReason({})).toBeUndefined()
    expect(planWorkspaceHmrScenarios('stateful', [
      { id: 'arbitrary-first', classicFallbackReason: 'stylesheet-output' },
      { id: 'arbitrary-supported' },
      { id: 'arbitrary-next', classicFallbackReason: 'patch-shape' },
    ]).map(({ id, expectedDelivery, expectedFallbackReason }) => [id, expectedDelivery, expectedFallbackReason])).toEqual([
      ['arbitrary-supported', 'stateful', undefined],
      ['arbitrary-first', 'classic-fallback', 'stylesheet-output'],
      ['arbitrary-next', 'classic', undefined],
    ])
  })

  it.each(['native-style', 'vue-style'])('freezes %s as the one stylesheet fallback and keeps every following save classic', (id) => {
    const planned = planWorkspaceHmrScenarios('stateful', [
      { id, classicFallbackReason: 'stylesheet-output' },
      { id: 'native-script' },
      { id: 'vue-template', statefulTemplate: true },
      { id: 'vue-script' },
      { id: 'later-style', classicFallbackReason: 'stylesheet-output' },
    ])
    expect(planned.map(({ id, expectedDelivery, expectedFallbackReason }) => [id, expectedDelivery, expectedFallbackReason])).toEqual([
      ['native-script', 'stateful', undefined],
      ['vue-script', 'stateful', undefined],
      [id, 'classic-fallback', 'stylesheet-output'],
      ['vue-template', 'classic', undefined],
      ['later-style', 'classic', undefined],
    ])
    expect(planWorkspaceHmrScenarios('standard', [{ id, classicFallbackReason: 'stylesheet-output' }])[0])
      .toMatchObject({ expectedDelivery: 'classic', expectedFallbackReason: undefined })
  })

  it('keeps all physical transition files while applying unchanged impact limits to later same-mode saves', () => {
    expect(evaluateWorkspaceHmrThresholds([project(transition)]).issues).toEqual([])
    expect(transition.impact).toHaveLength(30)
    expect(evaluateWorkspaceHmrThresholds([project({ ...transition, steadyClassicImpact: impact(13) })]).issues).toMatchObject([
      { metric: 'impactFiles', actual: 13, limit: 12 },
    ])
  })

  it('freezes every declared delivery before execution, including cases after the one allowed transition', () => {
    const planned = planWorkspaceHmrScenarios('stateful', [
      { id: 'first-template', statefulTemplate: true },
      { id: 'script' },
      { id: 'second-template', statefulTemplate: true },
    ])
    expect(planned.map(item => [item.id, item.expectedDelivery])).toEqual([
      ['script', 'stateful'],
      ['first-template', 'classic-fallback'],
      ['second-template', 'classic'],
    ])
    expect(planWorkspaceHmrScenarios('standard', [{ id: 'template', statefulTemplate: true }])[0]?.expectedDelivery).toBe('classic')
  })

  it('freezes a React template capability reason after supported scripts and keeps later styles classic', () => {
    const planned = planWorkspaceHmrScenarios('stateful', [
      { id: 'react-template', statefulTemplate: true, classicFallbackReason: 'patch-shape' },
      { id: 'native-script' },
      { id: 'native-style', classicFallbackReason: 'stylesheet-output' },
    ])
    expect(planned.map(({ id, expectedDelivery, expectedFallbackReason }) => [id, expectedDelivery, expectedFallbackReason])).toEqual([
      ['native-script', 'stateful', undefined],
      ['react-template', 'classic-fallback', 'patch-shape'],
      ['native-style', 'classic', undefined],
    ])
    expect(() => assertWorkspaceHmrDelivery({
      expectedDelivery: 'classic-fallback',
      expectedFallbackReason: 'patch-shape',
      actualMode: 'classic',
      deliveryEvidence: { delivery: 'classic', reason: 'patch-shape' },
    })).not.toThrow()
    expect(() => assertWorkspaceHmrDelivery({
      expectedDelivery: 'classic-fallback',
      expectedFallbackReason: 'patch-shape',
      actualMode: 'stateful-experimental',
      deliveryEvidence: { delivery: 'full-reload', reason: 'patch-shape' },
    })).toThrow('declared capability')
  })

  it('keeps existing baseline plus delta limits for the same-mode companion', () => {
    const evaluation = evaluateWorkspaceHmrThresholds([project({ ...transition, steadyClassicImpact: impact(5) })], {
      baseline: {
        version: 1,
        scope: 'workspace',
        generatedAt: '2026-10-21',
        mode: 'full',
        thresholds: {},
        projects: { 'apps/example': { scenarios: { 'vue-template': { impactFiles: 2 } } } },
      },
    })
    expect(evaluation.issues).toMatchObject([{ metric: 'impactFiles', actual: 5, baseline: 2, limit: 4 }])
  })

  it.each([
    { expectedFallbackReason: undefined },
    { classicPublication: undefined },
    { restoreDelivery: undefined },
    { repeatDelivery: undefined },
    { steadyClassicImpact: undefined },
    { steadyClassicImpact: [] },
    { deliveryEvidence: { delivery: 'classic', reason: 'patch-shape' } },
  ])('rejects a transition with missing or mismatched evidence: %j', (missing) => {
    expect(evaluateWorkspaceHmrThresholds([project({ ...transition, ...missing })]).issues).toMatchObject([{ metric: 'delivery-evidence' }])
  })

  it.each(['restoreDelivery', 'repeatDelivery'] as const)('does not accept successful cleanup as missing formal %s evidence', (missing) => {
    const scenario: ScenarioResult = {
      ...transition,
      marker: 'updated-source',
      [missing]: undefined,
      error: 'The operation was aborted due to timeout',
      failedStage: { phase: missing === 'restoreDelivery' ? 'restore' : 'repeat', step: 'publication.formal-end' },
      cleanupRestoreDelivery: { delivery: 'classic' },
    }
    const results = [project(scenario)]
    expect(evaluateWorkspaceHmrThresholds(results).issues).toMatchObject([{ metric: 'delivery-evidence' }])
    expect(summarizeWorkspaceHmrExecution(results)).toMatchObject({
      executedScenarioCount: 1,
      successfulScenarioCount: 0,
      failedScenarioCount: 1,
      notExecutedScenarioCount: 0,
    })
  })

  it('requires complete publication, retired transport, restored output and repeated saves for a stylesheet transition', () => {
    const stylesheet: ScenarioResult = {
      ...transition,
      id: 'native-style',
      expectedFallbackReason: 'stylesheet-output',
      deliveryEvidence: { delivery: 'classic', reason: 'stylesheet-output' },
    }
    expect(evaluateWorkspaceHmrThresholds([project(stylesheet)]).issues).toEqual([])
    for (const missing of [
      { classicPublication: undefined },
      { restoreDelivery: undefined },
      { repeatDelivery: undefined },
      { steadyClassicImpact: undefined },
      { deliveryEvidence: { delivery: 'classic', reason: 'native-registration' } },
    ]) {
      expect(evaluateWorkspaceHmrThresholds([project({ ...stylesheet, ...missing })]).issues).toMatchObject([{ metric: 'delivery-evidence' }])
    }
  })

  it('fails unexpected classic even when its small impact would fit the old budget', () => {
    const scenario = { ...transition, expectedDelivery: 'stateful' as const, impact: impact(1) }
    expect(() => assertWorkspaceHmrDelivery(scenario)).toThrow('unexpectedly switched')
    expect(evaluateWorkspaceHmrThresholds([project(scenario)]).issues).toMatchObject([{ metric: 'delivery-evidence' }])
  })

  it('rejects a stateful full rebuild as evidence of a supported incremental update', () => {
    expect(() => assertWorkspaceHmrDelivery({
      expectedDelivery: 'stateful',
      actualMode: 'stateful-experimental',
      deliveryEvidence: { delivery: 'full-reload' },
    })).toThrow('unexpectedly switched')
  })

  it('keeps normal classic and stateful impact checks unchanged', () => {
    for (const [expectedDelivery, actualMode] of [['classic', 'classic'], ['stateful', 'stateful-experimental']] as const) {
      expect(evaluateWorkspaceHmrThresholds([project({ ...transition, expectedDelivery, actualMode, impact: impact(13) })]).issues)
        .toMatchObject([{ metric: 'impactFiles', actual: 13, limit: 12 }])
    }
  })
})
