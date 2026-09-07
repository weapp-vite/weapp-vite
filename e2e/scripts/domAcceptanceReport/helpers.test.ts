import type { DomAcceptance } from '../../utils/domAcceptance/types'
import type { AcceptanceReport } from './types'
import { describe, expect, it } from 'vitest'
import { assertAcceptanceReportPassed, createAcceptanceIdentity, evaluateAcceptanceCase, isStrictDomAcceptanceSuite, sanitizeAcceptanceText, sanitizeAcceptanceValue, summarizeAcceptanceCases } from './helpers'

function createPlan(): DomAcceptance {
  return {
    fixture: 'e2e-apps/base',
    provider: 'devtools',
    checkpoints: [{ id: 'mounted', route: '/pages/index/index', action: 'launch', nodes: [{ selector: '.title', text: 'Ready' }] }],
    evidence: [{ id: 'mounted', route: 'pages/index/index', source: 'devtools-page-frame', capturedAt: '2026-09-01T00:00:01.000Z', nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
  }
}

function createReport(): AcceptanceReport {
  const cases = [evaluateAcceptanceCase({
    id: 'case-a',
    file: 'e2e/ide/example.test.ts',
    name: 'mounts',
    state: 'passed',
    acceptance: createPlan(),
    startedAt: Date.parse('2026-09-01T00:00:00.000Z'),
    finishedAt: Date.parse('2026-09-01T00:00:02.000Z'),
  })]
  return {
    schemaVersion: 1,
    runId: 'run-a',
    invocationId: 'invocation-a',
    commitSha: 'commit-a',
    taskLabel: 'ide/example.test.ts',
    template: null,
    provider: 'devtools',
    strict: true,
    environment: { nodeVersion: 'test', ideVersion: null, baseLibraryVersion: null },
    startedAt: '2026-09-01T00:00:00.000Z',
    finishedAt: '2026-09-01T00:00:02.000Z',
    status: 'passed',
    errors: [],
    cases,
    summary: summarizeAcceptanceCases(cases),
  }
}

describe('DOM acceptance report validation', () => {
  it.each([
    'ide-full',
    'ide-full:exhaustive',
    'e2e:ide-full',
    'e2e:ide-full:exhaustive',
    'e2e:ide-full shard=1-2',
    'e2e:ide-full:exhaustive shard=2-3',
  ])('requires strict evidence by default for %s', (suite) => {
    expect(isStrictDomAcceptanceSuite(suite, {})).toBe(true)
    expect(isStrictDomAcceptanceSuite(suite, { WEAPP_VITE_E2E_DOM_ACCEPTANCE: '0' })).toBe(true)
  })

  it.each(['ci', 'e2e:ci', 'ide-smoke', 'ide-gate', 'ide-headless-full', 'ide-component-libraries', 'ide-full:templates'])(
    'preserves explicit strict opt-in for %s',
    (suite) => {
      expect(isStrictDomAcceptanceSuite(suite, {})).toBe(false)
      expect(isStrictDomAcceptanceSuite(suite, { WEAPP_VITE_E2E_DOM_ACCEPTANCE: '1' })).toBe(true)
    },
  )

  it('does not let an inherited SHA mislabel the current checkout', () => {
    expect(() => createAcceptanceIdentity({ WEAPP_VITE_E2E_ACCEPTANCE_SHA: 'old-commit' }, () => 'current-commit')).toThrow('current checkout')
    expect(createAcceptanceIdentity({ WEAPP_VITE_E2E_ACCEPTANCE_SHA: 'current-commit', WEAPP_VITE_E2E_ACCEPTANCE_DIRTY: '0' }, () => 'current-commit')).toMatchObject({ commitSha: 'current-commit', workingTreeDirty: false })
  })
  it('blocks passed tests that never registered DOM acceptance', () => {
    const result = evaluateAcceptanceCase({ id: 'case-a', file: 'case.test.ts', name: 'data-only', state: 'passed' })
    expect(result.status).toBe('blocked')
    expect(result.violations).toContain('Missing DOM acceptance plan and evidence for this case')
  })

  it.each(['skipped', 'pending'] as const)('does not accept %s cases with previously valid evidence', (state) => {
    expect(evaluateAcceptanceCase({ id: 'case-a', file: 'case.test.ts', name: 'mounts', state, acceptance: createPlan() }).status).not.toBe('passed')
  })

  it('rejects missing, wrong-route and stale checkpoints', () => {
    const input = { id: 'case-a', file: 'case.test.ts', name: 'mounts', state: 'passed' as const, acceptance: createPlan() }
    input.acceptance.evidence = []
    expect(evaluateAcceptanceCase(input).status).toBe('blocked')
    input.acceptance = createPlan()
    input.acceptance.evidence[0]!.route = 'pages/other/index'
    expect(evaluateAcceptanceCase(input).status).toBe('blocked')
    input.acceptance = createPlan()
    expect(evaluateAcceptanceCase({ ...input, startedAt: Date.parse('2026-09-01T00:00:03.000Z') }).violations).toContain('DOM evidence predates the current case execution')
  })

  it('rejects empty, interrupted and previous-commit invocation reports', () => {
    const report = createReport()
    const identity = { runId: report.runId, commitSha: report.commitSha }
    expect(() => assertAcceptanceReportPassed(report, identity)).not.toThrow()
    expect(() => assertAcceptanceReportPassed({ ...report, cases: [] }, identity)).toThrow('did not finish')
    expect(() => assertAcceptanceReportPassed({ ...report, finishedAt: null }, identity)).toThrow('did not finish')
    expect(() => assertAcceptanceReportPassed({ ...report, commitSha: 'old-commit' }, identity)).toThrow('identity')
    expect(() => assertAcceptanceReportPassed({ ...report, runId: 'old-run' }, identity)).toThrow('identity')
    expect(() => assertAcceptanceReportPassed({ ...report, errors: ['runtime exception'] }, identity)).toThrow('did not finish')
  })

  it('redacts Windows and Unix home paths, credentials and emails', () => {
    expect(sanitizeAcceptanceText('C:\\Users\\operator\\repo\\e2e\\case.ts', 'C:\\Users\\operator\\repo', 'C:\\Users\\operator')).toBe('<repo>/e2e/case.ts')
    expect(sanitizeAcceptanceText('/home/operator/cache/log.json', '/workspace', '/other')).toBe('<home>/cache/log.json')
    expect(sanitizeAcceptanceText('token=private Bearer credentials test@example.com')).toBe('<redacted> <redacted> <email>')
    expect(sanitizeAcceptanceText('/pages/home/index https://example.com/app')).toBe('/pages/home/index https://example.com/app')
    expect(sanitizeAcceptanceValue({ route: '/home/index', id: '/home/index:initial' })).toEqual({ route: '/home/index', id: '/home/index:initial' })
  })

  it('revalidates serialized node contents rather than trusting checkpoint IDs', () => {
    for (const mutate of [
      (plan: DomAcceptance) => { plan.evidence[0]!.nodes = [] },
      (plan: DomAcceptance) => { plan.evidence[0]!.nodes[0]!.nodes[0]!.text = 'wrong text' },
      (plan: DomAcceptance) => { plan.evidence[0]!.nodes[0]!.nodes = [] },
      (plan: DomAcceptance) => { plan.evidence[0]!.nodes[0]!.scope = ['wrong-component'] },
      (plan: DomAcceptance) => { plan.evidence[0]!.nodes[0]!.query = 'xpath' },
    ]) {
      const report = createReport()
      mutate(report.cases[0]!.acceptance!)
      expect(() => assertAcceptanceReportPassed(report, { runId: report.runId, commitSha: report.commitSha })).toThrow('DOM acceptance incomplete')
    }
  })

  it('preserves explicit XPath queries and rejects missing query evidence after serialization', () => {
    const report = createReport()
    const plan = report.cases[0]!.acceptance!
    plan.checkpoints[0]!.nodes[0] = { selector: '//*[@id="title"]', query: 'xpath', text: 'Ready' }
    plan.evidence[0]!.nodes[0] = { selector: '//*[@id="title"]', query: 'xpath', count: 1, nodes: [{ text: 'Ready' }] }
    const identity = { runId: report.runId, commitSha: report.commitSha }
    expect(() => assertAcceptanceReportPassed(JSON.parse(JSON.stringify(report)), identity)).not.toThrow()
    const incomplete: unknown = JSON.parse(JSON.stringify(report, (key, value) => key === 'query' ? undefined : value))
    expect(() => assertAcceptanceReportPassed(incomplete, identity)).toThrow('valid serialized report')
  })

  it('revalidates responsive computed style evidence using the recorded IDE viewport', () => {
    const report = createReport()
    const plan = report.cases[0]!.acceptance!
    plan.checkpoints[0]!.nodes[0]!.styles = { 'font-size': { rpx: 24 } }
    plan.evidence[0]!.windowWidth = 390
    plan.evidence[0]!.nodes[0]!.nodes[0]!.styles = { 'font-size': '12px' }
    const identity = { runId: report.runId, commitSha: report.commitSha }
    expect(() => assertAcceptanceReportPassed(JSON.parse(JSON.stringify(report)), identity)).not.toThrow()
    plan.evidence[0]!.nodes[0]!.nodes[0]!.styles!['font-size'] = '14px'
    expect(() => assertAcceptanceReportPassed(report, identity)).toThrow('DOM acceptance incomplete')
    plan.evidence[0]!.nodes[0]!.nodes[0]!.styles!['font-size'] = '12px'
    delete plan.evidence[0]!.windowWidth
    expect(() => assertAcceptanceReportPassed(report, identity)).toThrow('DOM acceptance incomplete')
  })

  it('rejects evidence captured outside the case and inconsistent serialized summaries', () => {
    const report = createReport()
    const identity = { runId: report.runId, commitSha: report.commitSha }
    report.cases[0]!.acceptance!.evidence[0]!.capturedAt = '2026-09-01T00:00:03.000Z'
    expect(() => assertAcceptanceReportPassed(report, identity)).toThrow('DOM acceptance incomplete')
    const inconsistent = createReport()
    inconsistent.summary.plannedCount += 1
    expect(() => assertAcceptanceReportPassed(inconsistent, identity)).toThrow('summary does not match')
    const duplicate = createReport()
    duplicate.cases.push(duplicate.cases[0]!)
    expect(() => assertAcceptanceReportPassed(duplicate, identity)).toThrow('duplicate case IDs')
    expect(() => assertAcceptanceReportPassed(null, identity)).toThrow('valid serialized report')
  })

  it('preserves rpx calculation order when revalidating serialized reports', () => {
    const report = createReport()
    const plan = report.cases[0]!.acceptance!
    plan.checkpoints[0]!.nodes[0]!.styles = { width: { rpxCalc: { value: 8, multiply: 24 } } }
    plan.evidence[0]!.windowWidth = 390
    plan.evidence[0]!.nodes[0]!.nodes[0]!.styles = { width: '96px' }
    const identity = { runId: report.runId, commitSha: report.commitSha }
    expect(() => assertAcceptanceReportPassed(JSON.parse(JSON.stringify(report)), identity)).not.toThrow()
    for (const incorrect of ['99px', '99.84px']) {
      plan.evidence[0]!.nodes[0]!.nodes[0]!.styles!.width = incorrect
      expect(() => assertAcceptanceReportPassed(report, identity)).toThrow('DOM acceptance incomplete')
    }
    plan.evidence[0]!.nodes[0]!.nodes[0]!.styles!.width = '96px'
    delete plan.evidence[0]!.windowWidth
    expect(() => assertAcceptanceReportPassed(report, identity)).toThrow('DOM acceptance incomplete')
  })

  it('rejects unverified rpx calculation atoms in serialized plans', () => {
    const report = createReport()
    report.cases[0]!.acceptance!.checkpoints[0]!.nodes[0]!.styles = { width: { rpxCalc: { value: 1, multiply: 24 } } }
    expect(() => assertAcceptanceReportPassed(report, { runId: report.runId, commitSha: report.commitSha })).toThrow('valid serialized report')
  })

  it('preserves component scope and descendant filters through report serialization', () => {
    const report = createReport()
    const plan = report.cases[0]!.acceptance!
    plan.checkpoints[0]!.nodes[0]!.scope = ['feature-panel', { has: '.selected' }]
    plan.checkpoints[0]!.nodes[0]!.has = '.title'
    plan.evidence[0]!.nodes[0]!.scope = ['feature-panel', { has: '.selected' }]
    plan.evidence[0]!.nodes[0]!.has = '.title'
    const identity = { runId: report.runId, commitSha: report.commitSha }
    expect(() => assertAcceptanceReportPassed(JSON.parse(JSON.stringify(report)), identity)).not.toThrow()
    for (const mutate of [
      (value: DomAcceptance) => { delete value.evidence[0]!.nodes[0]!.has },
      (value: DomAcceptance) => { value.evidence[0]!.nodes[0]!.has = '.other-title' },
      (value: DomAcceptance) => { delete value.checkpoints[0]!.nodes[0]!.has },
      (value: DomAcceptance) => { value.evidence[0]!.nodes[0]!.scope = ['feature-panel', { has: '.other' }] },
    ]) {
      const changed = structuredClone(report)
      mutate(changed.cases[0]!.acceptance!)
      expect(evaluateAcceptanceCase(changed.cases[0]!).status).toBe('blocked')
      expect(() => assertAcceptanceReportPassed(JSON.parse(JSON.stringify(changed)), identity)).toThrow('DOM acceptance incomplete')
    }
  })

  it.each(['has', 'scope-selector', 'scope-has'] as const)('rejects an empty %s even when evidence matches', (field) => {
    const report = createReport()
    const plan = report.cases[0]!.acceptance!
    for (const item of [plan.checkpoints[0]!.nodes[0]!, plan.evidence[0]!.nodes[0]!]) {
      if (field === 'has') {
        item.has = ''
      }
      else {
        item.scope = field === 'scope-selector' ? [''] : [{ has: '' }]
      }
    }
    expect(() => assertAcceptanceReportPassed(report, { runId: report.runId, commitSha: report.commitSha })).toThrow('valid serialized report')
  })

  it('rejects successful reports with missing case execution timestamps', () => {
    const report = createReport()
    delete report.cases[0]!.startedAt
    expect(() => assertAcceptanceReportPassed(report, { runId: report.runId, commitSha: report.commitSha })).toThrow('valid serialized report')
  })

  it('rechecks retained runtime errors even when the report error summary is empty', () => {
    const report = createReport()
    report.runtimeDiagnostics = [{
      observedAt: '2026-09-01T00:00:01.000Z',
      caseId: null,
      phase: 'outside-case',
      event: { source: 'runtime', kind: 'message', project: 'base', level: 'error', text: 'startup failure' },
    }]
    expect(() => assertAcceptanceReportPassed(report, { runId: report.runId, commitSha: report.commitSha })).toThrow('did not finish')
  })

  it('rejects swallowed checkpoint failures and reports produced without strict hooks', () => {
    const report = createReport()
    const identity = { runId: report.runId, commitSha: report.commitSha }
    report.cases[0]!.acceptance!.failures = [{ checkpoint: 'mounted' }]
    expect(() => assertAcceptanceReportPassed(report, identity)).toThrow('DOM acceptance incomplete')
    expect(() => assertAcceptanceReportPassed({ ...createReport(), strict: false }, identity)).toThrow('did not finish')
  })
})
