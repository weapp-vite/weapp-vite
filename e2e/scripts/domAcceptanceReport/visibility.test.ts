import type { DomAcceptance } from '../../utils/domAcceptance/types'
import type { AcceptanceReport } from './types'
import { describe, expect, it } from 'vitest'
import { assertAcceptanceReportPassed, evaluateAcceptanceCase, summarizeAcceptanceCases } from './helpers'

function createReport(): AcceptanceReport {
  const acceptance: DomAcceptance = {
    fixture: 'e2e-apps/base',
    provider: 'devtools',
    runtime: { ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.2' },
    checkpoints: [{ id: 'closed', route: '/pages/index/index', action: 'close slot', nodes: [{ selector: '#message', text: 'ready', visible: false }] }],
    evidence: [{
      id: 'closed',
      route: 'pages/index/index',
      source: 'devtools-page-frame',
      capturedAt: '2026-09-01T00:00:01.000Z',
      nodes: [{ selector: '#message', query: 'css', count: 1, nodes: [{ text: 'ready', size: { width: 0, height: 0 }, styles: { display: null, visibility: null, opacity: null } }] }],
    }],
  }
  const cases = [evaluateAcceptanceCase({
    id: 'case-a',
    file: 'e2e/ide/example.test.ts',
    name: 'unprojected slot',
    state: 'passed',
    acceptance,
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
    environment: { nodeVersion: 'test', ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.2' },
    startedAt: '2026-09-01T00:00:00.000Z',
    finishedAt: '2026-09-01T00:00:02.000Z',
    status: 'passed',
    errors: [],
    cases,
    summary: summarizeAcceptanceCases(cases),
  }
}

function expectBlocked(report: AcceptanceReport) {
  expect(evaluateAcceptanceCase(report.cases[0]!).status).toBe('blocked')
  const serialized: unknown = JSON.parse(JSON.stringify(report))
  expect(() => assertAcceptanceReportPassed(serialized, report)).toThrow('DOM acceptance incomplete')
}

describe('serialized DOM visibility evidence', () => {
  it('preserves raw unavailable styles when zero dimensions prove invisibility', () => {
    const report = createReport()
    expect(report.cases[0]!.status).toBe('passed')
    expect(report.summary).toMatchObject({ passedCount: 1, blockedCount: 0, capturedCheckpointCount: 1 })
    const serialized: unknown = JSON.parse(JSON.stringify(report))
    expect(() => assertAcceptanceReportPassed(serialized, report)).not.toThrow()
    expect(report.cases[0]!.acceptance!.evidence[0]!.nodes[0]!.nodes[0]!.styles).toEqual({ display: null, visibility: null, opacity: null })
  })

  it('does not accept zero area as visible after serialization', () => {
    const report = createReport()
    report.cases[0]!.acceptance!.checkpoints[0]!.nodes[0]!.visible = true
    expectBlocked(report)
  })

  it.each([true, false])('blocks positive area with unknown styles even when expected=%s', (visible) => {
    const report = createReport()
    report.cases[0]!.acceptance!.checkpoints[0]!.nodes[0]!.visible = visible
    report.cases[0]!.acceptance!.evidence[0]!.nodes[0]!.nodes[0]!.size = { width: 20, height: 10 }
    expectBlocked(report)
  })

  it.each(['display', 'visibility', 'opacity'])('blocks a missing %s observation after serialization', (key) => {
    const report = createReport()
    delete report.cases[0]!.acceptance!.evidence[0]!.nodes[0]!.nodes[0]!.styles![key]
    expectBlocked(report)
  })

  it.each(['display', 'visibility', 'opacity'])('does not treat inherited %s as an observation before serialization', (key) => {
    const report = createReport()
    const styles = report.cases[0]!.acceptance!.evidence[0]!.nodes[0]!.nodes[0]!.styles!
    delete styles[key]
    Object.setPrototypeOf(styles, { [key]: null })
    expectBlocked(report)
  })

  it.each([{ display: ' ' }, { visibility: '\t' }, { opacity: ' \n' }])('rejects whitespace-only style evidence after serialization: %j', (styles) => {
    const report = createReport()
    Object.assign(report.cases[0]!.acceptance!.evidence[0]!.nodes[0]!.nodes[0]!.styles!, styles)
    expectBlocked(report)
  })

  it('preserves valid opacity with surrounding whitespace after serialization', () => {
    const report = createReport()
    const acceptance = report.cases[0]!.acceptance!
    acceptance.checkpoints[0]!.nodes[0]!.visible = true
    Object.assign(acceptance.evidence[0]!.nodes[0]!.nodes[0]!, {
      size: { width: 20, height: 10 },
      styles: { display: 'block', visibility: 'visible', opacity: ' 0.5 ' },
    })
    expect(evaluateAcceptanceCase(report.cases[0]!).status).toBe('passed')
    expect(() => assertAcceptanceReportPassed(JSON.parse(JSON.stringify(report)), report)).not.toThrow()
    expect(acceptance.evidence[0]!.nodes[0]!.nodes[0]!.styles!.opacity).toBe(' 0.5 ')
  })

  it.each(['', '-0.1', '1.1', 'NaN', 'Infinity'])('rejects invalid known opacity even for zero area: %s', (opacity) => {
    const report = createReport()
    report.cases[0]!.acceptance!.evidence[0]!.nodes[0]!.nodes[0]!.styles!.opacity = opacity
    expectBlocked(report)
  })

  it.each(['block', { rpx: 24 }, { rpxCalc: { value: 8, multiply: 24 } }])('keeps explicit style expectations strict after serialization: %j', (display) => {
    const report = createReport()
    const acceptance = report.cases[0]!.acceptance!
    acceptance.checkpoints[0]!.nodes[0]!.styles = { display }
    acceptance.evidence[0]!.windowWidth = 390
    expectBlocked(report)
  })

  it.each([{ width: -1, height: 0 }, { width: 0, height: -1 }])('rejects invalid dimensions before accepting zero area: %j', (size) => {
    const report = createReport()
    report.cases[0]!.acceptance!.evidence[0]!.nodes[0]!.nodes[0]!.size = size
    expect(evaluateAcceptanceCase(report.cases[0]!).status).toBe('blocked')
    expect(() => assertAcceptanceReportPassed(JSON.parse(JSON.stringify(report)), report)).toThrow('valid serialized report')
  })
})
