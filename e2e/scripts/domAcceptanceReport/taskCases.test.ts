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
