import type { AcceptanceCaseReport } from './types'
import process from 'node:process'
import { z } from 'zod'

export const SELECTED_CASES_ENV = 'WEAPP_VITE_E2E_ACCEPTANCE_CASES'
const caseIdentity = z.object({ file: z.string().min(1), name: z.string().min(1) }).strict()
export type SelectedAcceptanceCase = z.infer<typeof caseIdentity>

function caseKey(item: SelectedAcceptanceCase) {
  return JSON.stringify([item.file.replaceAll('\\', '/'), item.name])
}

export const selectedAcceptanceCases = z.array(caseIdentity).min(1).refine(
  cases => new Set(cases.map(caseKey)).size === cases.length,
  'Selected DOM cases must be unique',
)

/** 在执行前读取调用方声明的精确清单，不从已完成结果反推计划。 */
export function readSelectedAcceptanceCases(env = process.env) {
  const serialized = env[SELECTED_CASES_ENV]
  return serialized === undefined ? undefined : selectedAcceptanceCases.parse(JSON.parse(serialized) as unknown)
}

/** 选中用例必须完整通过；过滤掉的无计划 skipped 用例不属于本次验收。 */
export function evaluateSelectedAcceptanceCases(selected: SelectedAcceptanceCase[] | undefined, cases: AcceptanceCaseReport[]) {
  if (!selected) {
    return []
  }
  const errors: string[] = []
  const planned = new Set(selected.map(caseKey))
  for (const expected of selected) {
    const actual = cases.filter(item => caseKey(item) === caseKey(expected))
    if (actual.length !== 1 || actual[0]?.state !== 'passed' || actual[0]?.status !== 'passed') {
      errors.push(`Selected DOM case did not pass exactly once: ${expected.file} > ${expected.name}`)
    }
  }
  for (const actual of cases) {
    if (!planned.has(caseKey(actual)) && (actual.state !== 'skipped' || actual.acceptance)) {
      errors.push(`Unexpected DOM case outside the selected plan: ${actual.file} > ${actual.name}`)
    }
  }
  return errors
}
