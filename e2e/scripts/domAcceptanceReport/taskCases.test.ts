import type { AcceptanceReport } from './types'
import { describe, expect, it } from 'vitest'
import { assertTaskCaseCoverage, readPlannedTaskCases } from './taskCases'

const first = { file: 'e2e/ide/aggregate.test.ts', name: 'first suite > first case' }
const second = { file: first.file, name: 'second suite > second case' }

function report(cases: Array<{ file: string, name: string }>): Pick<AcceptanceReport, 'cases'> {
  return { cases: cases.map(item => ({ ...item, id: item.name, state: 'passed', status: 'passed', violations: [] })) }
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
