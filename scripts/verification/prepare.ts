import type { SelectionMode, VerificationMode, VerificationPlan } from './types.ts'
import { readChanges } from './changes.ts'
import { createVerificationPlan } from './plan.ts'
import { getResourceBudget } from './resources.ts'
import { readWorkspace } from './workspace.ts'

export interface PreparationOptions {
  base?: string
  head?: string
  files?: string[]
  mode: VerificationMode
  selection?: SelectionMode
  jobs?: string | number
  topology?: string
}

/** 每轮读取真实变更、依赖图、工具链和资源预算，不复用陈旧推导。 */
export async function prepareVerificationPlan(root: string, options: PreparationOptions): Promise<VerificationPlan> {
  const [changes, packages] = await Promise.all([
    readChanges(root, options),
    readWorkspace(root),
  ])
  return createVerificationPlan({
    root,
    changes,
    packages,
    resources: getResourceBudget({ jobs: options.jobs }),
    mode: options.mode,
    selection: options.selection,
    topology: options.topology,
    partial: Boolean(options.files?.length),
  })
}

export async function assertCurrentPlan(root: string, plan: VerificationPlan, options: PreparationOptions): Promise<void> {
  const current = await prepareVerificationPlan(root, options)
  if (current.fingerprint !== plan.fingerprint) {
    throw new Error('源码、workspace、配置、工具链或资源预算已变化，请重新执行验证')
  }
}

/** 完成后只核对不可变提交与工作树，不因运行中的资源余量变化重建任务图。 */
export async function assertCommittedSnapshot(root: string, plan: VerificationPlan, options: PreparationOptions): Promise<void> {
  if (!options.head) {
    throw new Error('提交快照校验缺少 head')
  }
  const current = await readChanges(root, { head: options.head, base: options.base })
  if (current.fingerprint !== plan.changes.fingerprint) {
    throw new Error('候选提交快照已变化，不能记录成功回执')
  }
}
