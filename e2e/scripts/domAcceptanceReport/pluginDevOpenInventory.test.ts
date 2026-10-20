import type { AcceptanceReport } from './types'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getIdeExhaustiveTasks, getIdeHeadlessTasks, getIdeTasks, getIdeTemplatesTasks, getSuiteTasks } from '../e2e-suite-manifest'
import { readTaskCases } from './inventory'
import { assertTaskCaseCoverage, readPlannedTaskCases } from './taskCases'

const root = path.resolve(import.meta.dirname, '../../..')
const label = 'ide/template-plugin-dev-open.runtime.test.ts'
function report(cases: Array<{ file: string, name: string }>): Pick<AcceptanceReport, 'cases'> {
  return { cases: cases.map(item => ({ ...item, id: item.name, state: 'passed', status: 'passed', violations: [] })) }
}

const names = [
  'plugin template dev:open IDE integration > default CLI P > default CLI opens source plugin project',
  'plugin template dev:open IDE integration > explicit automator W > explicit automator opens owned plugin snapshot',
]

describe('plugin P/W dev:open inventory', () => {
  it('retains both static cases in full, templates, exhaustive and both headless scopes', async () => {
    for (const factory of [getIdeTasks, getIdeTemplatesTasks, getIdeExhaustiveTasks, getIdeHeadlessTasks, () => getSuiteTasks('ide-dom-headless')]) {
      const matches = (await factory()).filter(task => task.label === label)
      expect(matches).toHaveLength(1)
      expect(matches[0]?.acceptanceTemplates).toBeUndefined()
    }
    expect(getIdeTasks().find(task => task.label === label)?.env?.WEAPP_VITE_E2E_TASK_TIMEOUT_MS).toBe('1260000')
    const common = getIdeTasks().find(task => task.label === 'ide/template-dev-open-all.runtime.test.ts')
    expect(common?.acceptanceTemplates).not.toContain('weapp-vite-plugin-template')
  })

  it('requires a complete opened checkpoint plan for each static strategy case', () => {
    const cases = readTaskCases(root, label)
    expect(cases.map(item => item.name)).toEqual(names)
    expect(new Set(cases.map(item => item.name)).size).toBe(2)
    for (const item of cases) {
      expect(item.notes).toEqual([])
      expect(item.plans).toEqual([expect.objectContaining({ registration: 'createDomAcceptance', fixture: 'templates/weapp-vite-plugin-template', checkpoints: '[checkpoint]' })])
    }
  })

  it.each(['devtools', 'headless'] as const)('rejects missing or duplicate P/W report cases for %s', async (provider) => {
    const task = { label, command: 'pnpm', args: [] }
    const planned = await readPlannedTaskCases(task, provider)
    expect(planned.map(item => item.name)).toEqual(names)
    const reports = [report(planned)]
    expect(() => assertTaskCaseCoverage(planned, reports)).not.toThrow()
    for (const omitted of [0, 1]) {
      expect(() => assertTaskCaseCoverage(planned, [report(planned.filter((_, index) => index !== omitted))])).toThrow(/inventory mismatch/)
    }
    expect(() => assertTaskCaseCoverage(planned, [report([...planned, planned[0]!])])).toThrow(/inventory mismatch/)
  })
})
