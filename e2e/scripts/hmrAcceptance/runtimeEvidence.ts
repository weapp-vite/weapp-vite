import type { VerificationPlan } from '../verification/types'
import fs from 'node:fs/promises'
import { assertAcceptanceReportPassed } from '../domAcceptanceReport/helpers'
import { assertTaskCaseCoverage } from '../domAcceptanceReport/taskCases'

export interface HmrRuntimeReceipt {
  runId: string
  commitSha: string
  provider: 'devtools' | 'headless'
  tasks: string[]
  cases: number
  checkpoints: number
}

/** 从同提交的实际 DOM 报告复核 case 与 checkpoint，不以任务退出码或能力映射替代。 */
export async function readHmrRuntimeReceipt(plan: VerificationPlan, files: string[]): Promise<HmrRuntimeReceipt> {
  if (!plan.strict || (plan.profile.provider !== 'devtools' && plan.profile.provider !== 'headless')) {
    throw new Error('HMR runtime receipt requires a strict runtime plan')
  }
  const reports = await Promise.all(files.map(async (file) => {
    const value: unknown = JSON.parse(await fs.readFile(file, 'utf8'))
    assertAcceptanceReportPassed(value, plan)
    if (value.provider !== plan.profile.provider || !plan.tasks.some(task => task.label === value.taskLabel)) {
      throw new Error('HMR runtime receipt includes another provider or an unplanned task')
    }
    return value
  }))
  if (new Set(reports.map(report => report.invocationId)).size !== reports.length) {
    throw new Error('HMR runtime receipt contains duplicate invocations')
  }
  for (const task of plan.tasks) {
    if (!task.cases?.length || task.outOfScopeReason) {
      throw new Error('HMR runtime receipt requires every planned task and case')
    }
    assertTaskCaseCoverage(task.cases, reports.filter(report => report.taskLabel === task.label), false, plan.profile.provider)
  }
  const cases = reports.flatMap(report => report.cases).filter(item => item.state === 'passed')
  const checkpoints = cases.reduce((sum, item) => sum + (item.acceptance?.evidence.length ?? 0), 0)
  if (!cases.length || checkpoints < cases.length) {
    throw new Error('HMR runtime receipt is missing completed checkpoint evidence')
  }
  return {
    runId: plan.runId,
    commitSha: plan.commitSha,
    provider: plan.profile.provider,
    tasks: plan.tasks.map(task => task.label).sort(),
    cases: cases.length,
    checkpoints,
  }
}
