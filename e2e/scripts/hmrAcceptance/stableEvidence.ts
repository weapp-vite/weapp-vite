import type { VerificationPlan } from '../verification/types'
import path from 'node:path'
import { HMR_ACCEPTANCE_BUILD_TESTS, hmrAcceptanceRuntimeFiles } from '../hmr-acceptance-manifest'
import { CLASSIC_HMR_OUT_OF_SCOPE_TASKS, isStableHmrSuite } from './stableScope'
import { CLASSIC_IDE_CASES } from './stableScopeCases'

/** 稳定验收仍冻结完整旧清单；仅已声明的实验边界可不执行。 */
export function assertStableHmrPlanScope(plan: VerificationPlan) {
  if (!isStableHmrSuite(plan.suite)) {
    return false
  }
  const files = plan.suite === 'hmr-build:classic'
    ? HMR_ACCEPTANCE_BUILD_TESTS.map(file => path.relative(path.resolve(import.meta.dirname, '../..'), file).replaceAll('\\', '/'))
    : hmrAcceptanceRuntimeFiles(plan.profile.provider === 'devtools' ? 'ide' : 'headless')
  const labels = plan.tasks.map(task => task.label).sort()
  if (JSON.stringify(labels) !== JSON.stringify([...files].sort())
    || !plan.tasks.some(task => !task.outOfScopeReason)
    || plan.tasks.some(task => task.outOfScopeReason !== CLASSIC_HMR_OUT_OF_SCOPE_TASKS[task.label])
    || plan.tasks.some((task) => {
      const selected = CLASSIC_IDE_CASES[task.label]?.filter(item => item.supported).map(({ name }) => ({ file: `e2e/${task.label}`, name }))
      return selected && JSON.stringify(task.cases) !== JSON.stringify(selected)
    })) {
    throw new Error('Classic HMR acceptance requires the complete frozen supported inventory and declared diagnostic boundaries')
  }
  return true
}
