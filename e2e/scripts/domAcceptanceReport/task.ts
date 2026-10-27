import type { SuiteTask } from '../suiteRunner'
import type { PlannedTaskCase } from './taskCases'
import type { AcceptanceIdentity } from './types'
import process from 'node:process'
import { readPlannedTaskCases } from './taskCases'
import { validateTaskEvidence } from './taskEvidence'

/** 普通执行从源码冻结 case；分布式聚合必须显式传入计划中的清单。 */
export async function validateTaskAcceptance(task: SuiteTask, identity: AcceptanceIdentity, plannedCases?: PlannedTaskCase[]) {
  const provider = (task.env?.WEAPP_VITE_E2E_RUNTIME_PROVIDER ?? process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER) === 'headless' ? 'headless' : 'devtools'
  await validateTaskEvidence(task, identity, plannedCases ?? (() => readPlannedTaskCases(task, provider)))
}
