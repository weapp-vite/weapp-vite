import type { AcceptanceReport } from './types'
import { describe, expect, it } from 'vitest'
import { assertTaskCaseCoverage, freezeProviderCaseScope, readPlannedTaskCases } from './taskCases'

const first = { file: 'e2e/ide/aggregate.test.ts', name: 'first suite > first case' }
const second = { file: first.file, name: 'second suite > second case' }

function report(cases: Array<{ file: string, name: string }>): Pick<AcceptanceReport, 'cases'> {
  return {
    cases: cases.map(item => ({
      ...item,
      id: item.name,
      state: 'passed',
      status: 'passed',
      violations: [],
      acceptance: {
        fixture: 'e2e-apps/example',
        provider: 'headless',
        checkpoints: [{ id: 'mounted', route: '/pages/index/index', action: 'mount', nodes: [{ selector: '.title', text: 'Ready' }] }],
        evidence: [{ id: 'mounted', route: 'pages/index/index', source: 'headless-logical-tree', capturedAt: '2026-10-19T00:00:01.000Z', nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
      },
    })),
  }
}

describe('planned DOM cases versus actual collection', () => {
  it('accepts the exact case multiset across template invocations and normalizes Windows separators', () => {
    expect(() => assertTaskCaseCoverage([first, second], [report([second]), report([{ ...first, file: first.file.replaceAll('/', '\\') }])])).not.toThrow()
  })

  it('rejects an omitted aggregate child even when every collected case passed', () => {
    expect(() => assertTaskCaseCoverage([first, second], [report([first])])).toThrow('planned=2 executed=1')
  })

  it('rejects duplicates, substituted cases and incorrect source modules even when counts match', () => {
    for (const substitute of [first, { ...second, name: 'unexpected' }, { ...second, file: 'e2e/ide/other.test.ts' }]) {
      expect(() => assertTaskCaseCoverage([first, second], [report([first, substitute])])).toThrow('DOM case inventory mismatch')
    }
  })

  it.each(['skipped', 'failed', 'pending', 'blocked', 'missing-evidence'] as const)('rejects a planned %s case even when the collected names match exactly', (fault) => {
    const actual = report([first, second])
    const incomplete = actual.cases[1]!
    if (fault === 'blocked') {
      incomplete.status = 'blocked'
    }
    else if (fault !== 'missing-evidence') {
      incomplete.state = fault
    }
    if (fault === 'skipped' || fault === 'missing-evidence') {
      delete incomplete.acceptance
    }
    expect(() => assertTaskCaseCoverage([first, second], [actual])).toThrow('Planned DOM case did not pass with acceptance evidence')
  })

  it('preserves explicitly selected scope while requiring every selected case to pass with evidence', () => {
    const actual = report([first, second])
    actual.cases[1] = { ...actual.cases[1]!, state: 'skipped', status: 'skipped', acceptance: undefined }
    expect(() => assertTaskCaseCoverage([first], [actual], true)).not.toThrow()
    expect(() => assertTaskCaseCoverage([first, second], [actual], true)).toThrow('Planned DOM case did not pass with acceptance evidence')
  })

  it('accepts only the skipped declaration frozen as inapplicable to the actual provider', () => {
    const applicability = { providers: ['headless'] as const, conditions: [{ modifier: 'runIf' as const, expression: 'provider === \'headless\'', source: 'e2e/ide/aggregate.test.ts:1' }] }
    const scoped = { ...second, providerScope: freezeProviderCaseScope({ ...applicability, providers: [...applicability.providers] }, 'devtools') }
    const actual = report([first, second])
    actual.cases[1] = { ...actual.cases[1]!, state: 'skipped', status: 'skipped', acceptance: undefined }
    expect(() => assertTaskCaseCoverage([first, scoped], [actual], false, 'devtools')).not.toThrow()
    expect(() => assertTaskCaseCoverage([first, scoped], [actual], false, 'headless')).toThrow('Invalid frozen DOM provider')
    const headless = { ...second, providerScope: freezeProviderCaseScope({ ...applicability, providers: [...applicability.providers] }, 'headless') }
    expect(() => assertTaskCaseCoverage([first, headless], [actual], false, 'headless')).toThrow('Planned DOM case did not pass')
    expect(() => assertTaskCaseCoverage([first, second], [actual], false, 'devtools')).toThrow('Planned DOM case did not pass')
    expect(() => assertTaskCaseCoverage([first, scoped], [report([first, second])], false, 'devtools')).toThrow('Planned DOM case did not pass')
  })

  it('enumerates both compiler entrypoints with the same names as runtime collection', async () => {
    const cases = await readPlannedTaskCases({ label: 'ide/vite-plugin.runtime.test.ts', command: 'node', args: [] }, 'headless')
    expect(cases.map(item => item.name)).toEqual([
      'vite shared compiler session runtime (weapp e2e) > renders Vue routes and navigates to an ordinary subpackage after build',
      'wv shared compiler session runtime (weapp e2e) > renders Vue routes and navigates to an ordinary subpackage after build',
    ])
  })

  it('enumerates standalone and native Vite classic runtime cases', async () => {
    const cases = await readPlannedTaskCases({ label: 'ide/hmr-auto-classic.runtime.test.ts', command: 'node', args: [] }, 'headless')
    expect(cases.map(item => item.name)).toEqual([
      'wv automatic classic HMR in real WeChat DevTools > uses direct output and reloads the page instead of preserving its state',
      'vite automatic classic HMR in real WeChat DevTools > uses direct output and reloads the page instead of preserving its state',
      'vite-watch automatic classic HMR in real WeChat DevTools > uses direct output and reloads the page instead of preserving its state',
    ])
  })

  it('enumerates native batch recovery only for its declared stateful mode', async () => {
    const cases = await readPlannedTaskCases({ label: 'ide/issue-1134-native-batch.runtime.test.ts', command: 'node', args: [] }, 'headless')
    expect(cases.map(item => item.name)).toEqual([
      'issue #1134 native four-file runtime (classic) > renders matching script, template, style and config batches on repeated saves and restoration',
      'issue #1134 native four-file runtime (stateful-experimental) > persists a native script saved on the first actual sidecar notification',
      'issue #1134 native four-file runtime (stateful-experimental) > renders matching script, template, style and config batches on repeated saves and restoration',
    ])
  })

  it('expands provider titles and template children from the declared suite source', async () => {
    const jsx = await readPlannedTaskCases({ label: 'ide/wevu-jsx-tsx.runtime.test.ts', command: 'node', args: [] }, 'headless')
    expect(jsx).toHaveLength(3)
    expect(jsx.every(item => item.name.startsWith('wevu JSX/TSX runtime [headless] >'))).toBe(true)
    const templates = await readPlannedTaskCases({
      label: 'ide/template-dev-open-all.runtime.test.ts',
      command: 'node',
      args: [],
      acceptanceTemplates: ['weapp-vite-template', 'weapp-vite-wevu-template'],
    }, 'devtools')
    expect(templates.map(item => item.name)).toEqual([
      'all templates dev:open IDE integration > weapp-vite-template renders after dev:open without runtime errors',
      'all templates dev:open IDE integration > weapp-vite-wevu-template renders after dev:open without runtime errors',
    ])
  })
})
