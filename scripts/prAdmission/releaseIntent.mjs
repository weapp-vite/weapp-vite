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
  const toolchainJob = workflow?.jobs?.toolchain
  add('自动 changeset 保留集中化工具链任务', {
    if: native.jobs.plan.if,
    permissions: { contents: 'read' },
    uses: './.github/workflows/reusable-repoctl-toolchain.yml',
  }, toolchainJob)
  add('自动 changeset 只有工具链与原生 plan/apply 任务', ['toolchain', 'plan', 'apply'], Object.keys(workflow?.jobs ?? {}))
  add('自动 changeset plan 等待工具链版本解析', 'toolchain', workflow?.jobs?.plan?.needs)
  add('自动 changeset apply 等待 plan 与工具链', ['plan', 'toolchain'], workflow?.jobs?.apply?.needs)
  for (const [name, job] of Object.entries(native.jobs)) {
    const currentJob = workflow?.jobs?.[name]
    const expected = structuredClone(job)
    const actual = structuredClone(currentJob)
    const expectedInstall = expected.steps.find(step => step.name === 'Install trusted repoctl')
    expectedInstall.run = expectedInstall.run.replace(/repoctl@\d+\.\d+\.\d+/u, '"repoctl@$REPOCTL_VERSION"')
    // eslint-disable-next-line no-template-curly-in-string -- GitHub Actions expression must stay literal.
    add(`自动 changeset ${name} 从共享工具链读取 repoctl 版本`, '${{ needs.toolchain.outputs.repoctl_version }}', currentJob?.env?.REPOCTL_VERSION)
    if (name === 'plan') {
      if (actual) {
        delete actual.needs
      }
    }
    else if (name === 'apply') {
      if (actual) {
        actual.needs = actual.needs.filter(dependency => dependency !== 'toolchain')
        if (actual.needs.length === 1) {
          actual.needs = actual.needs[0]
        }
      }
    }
    if (actual?.env) {
      delete actual.env.REPOCTL_VERSION
      if (Object.keys(actual.env).length === 0) {
        delete actual.env
      }
    }
    add(`自动 changeset ${name} 审批 Environment`, policy.environment, workflow?.jobs?.[name]?.environment)
    add(`自动 changeset ${name} 保留可信原生执行入口`, expected, actual)
  }
}
