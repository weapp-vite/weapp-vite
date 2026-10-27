import { getAutoChangesetWorkflow } from 'repoctl'
import { parse } from 'yaml'

const native = parse(await getAutoChangesetWorkflow({
  environment: 'pr-ci-approval',
  workflowPath: '.github/workflows/release-intent-auto.yml',
  workflowName: 'Automatic Release Intent',
}))
native.jobs.plan.environment = 'pr-ci-approval'

/** 保留仓库审批门禁，其余编排逐项对照已安装 repoctl 的正式工作流。 */
export function checkReleaseIntentAdmission(workflow, policy, add) {
  for (const field of ['name', 'on', 'permissions', 'defaults', 'concurrency', 'env']) {
    add(`自动 changeset 使用原生 ${field} 配置`, native[field], workflow?.[field])
  }
  add('自动 changeset 只有原生 plan/apply 任务', ['plan', 'apply'], Object.keys(workflow?.jobs ?? {}))
  for (const [name, job] of Object.entries(native.jobs)) {
    add(`自动 changeset ${name} 审批 Environment`, policy.environment, workflow?.jobs?.[name]?.environment)
    add(`自动 changeset ${name} 保留可信原生执行入口`, job, workflow?.jobs?.[name])
  }
}
