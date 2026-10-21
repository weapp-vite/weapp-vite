import type { ProjectResult, ScenarioResult } from './types'
import { describe, expect, it } from 'vitest'
import { evaluateWorkspaceHmrThresholds } from './baseline'
import { assertWorkspaceHmrDelivery, expectedWorkspaceHmrDelivery, orderWorkspaceHmrScenarios, planWorkspaceHmrScenarios } from './delivery'

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
  ] as const)('freezes %s / classic=%s / template=%s as %s', (mode, classic, template, expected) => {
    expect(expectedWorkspaceHmrDelivery(mode, classic, template)).toBe(expected)
  })

  it('preserves every case and runs supported script/style scenarios before irreversible fallback', () => {
    const scenarios = [
      { id: 'native-template' },
      { id: 'vue-template', statefulTemplate: true },
      { id: 'vue-script' },
      { id: 'vue-style' },
    ]
    expect(orderWorkspaceHmrScenarios(scenarios).map(item => item.id)).toEqual(['native-template', 'vue-script', 'vue-style', 'vue-template'])
    expect(scenarios.map(item => item.id)).toEqual(['native-template', 'vue-template', 'vue-script', 'vue-style'])
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

  it('freezes a React template capability reason after supported native scripts and styles', () => {
    const planned = planWorkspaceHmrScenarios('stateful', [
      { id: 'react-template', statefulTemplate: true, classicFallbackReason: 'patch-shape' },
      { id: 'native-script' },
      { id: 'native-style' },
    ])
    expect(planned.map(({ id, expectedDelivery, expectedFallbackReason }) => [id, expectedDelivery, expectedFallbackReason])).toEqual([
      ['native-script', 'stateful', undefined],
      ['native-style', 'stateful', undefined],
      ['react-template', 'classic-fallback', 'patch-shape'],
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
