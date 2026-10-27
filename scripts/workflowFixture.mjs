import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { verificationTopologyVariant } from './verificationTelemetry/topology.mjs'

/** 从实际包装入口追踪共用验证主体，保留原入口参数和调度策略供契约测试核验。 */
export function readWorkflowFixture(name) {
  const workflow = parse(readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8'))
  const validation = workflow.jobs?.validation?.uses
  if (!validation?.startsWith('./.github/workflows/validate-')) {
    return workflow
  }
  const shared = parse(readFileSync(new URL(`../${validation.slice(2)}`, import.meta.url), 'utf8'))
  return { ...workflow, jobs: { ...shared.jobs, 'pr-context': workflow.jobs['pr-context'] } }
}

/** 保留每层 workflow 的真实 job 归属，用于检查嵌套复用后的权限、产物与覆盖范围。 */
export function readWorkflowGraph(name, workflows = new Map()) {
  if (workflows.has(name)) {
    return workflows
  }
  const workflow = parse(readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8'))
  workflows.set(name, workflow)
  for (const job of Object.values(workflow.jobs)) {
    if (job.uses?.startsWith('./.github/workflows/')) {
      readWorkflowGraph(job.uses.split('/').at(-1), workflows)
    }
  }
  return workflows
}

/** 从实际质量入口读取拓扑，未知配置不能隐式省略另一侧断言。 */
export function readVerificationTopologyVariant() {
  return verificationTopologyVariant(readWorkflowFixture('validate-ci.yml'))
}

/** 从旧断言的语义构造双拓扑预期值，实际 workflow 不做投影或删减。 */
export function frozenWorkflowText(value, profile) {
  const fields = { checkout_sha: 'checkoutSha', base_sha: 'baseSha', head_sha: 'headSha', head_ref: 'headRef', base_ref: 'baseRef', head_repository: 'headRepository' }
  return value.replace(/needs\.pr-context\.outputs\.([a-z_]+)/gu, (original, output) => {
    let selected
    if (output === 'should_run') {
      selected = `((fromJSON(inputs.pr_context).event == 'pull_request' && fromJSON(inputs.pr_context).selections['${profile}'] || fromJSON(inputs.pr_context).event != 'pull_request' && fromJSON(inputs.pr_context).shouldRun) && 'true' || 'false')`
    }
    else if (output === 'is_pr') {
      selected = '(fromJSON(inputs.pr_context).isPr && \'true\' || \'false\')'
    }
    else if (output === 'pr_number') {
      selected = 'format(\'{0}\', fromJSON(inputs.pr_context).prNumber || \'\')'
    }
    else if (output === 'checkout_sha' && ['ci-performance', 'wevu-runtime-size'].includes(profile)) {
      selected = '(fromJSON(inputs.pr_context).event == \'pull_request\' && fromJSON(inputs.pr_context).headSha || fromJSON(inputs.pr_context).checkoutSha)'
    }
    else {
      if (!Object.hasOwn(fields, output)) {
        throw new Error(`Unknown frozen workflow output: ${output}`)
      }
      selected = `fromJSON(inputs.pr_context).${fields[output]}`
    }
    return `(inputs.verification_topology == 'optimized-v2' && ${selected} || ${original})`
  })
}

/** 显式要求取消和成功依赖门禁，不能用宽松包含断言掩盖跳过 context 后的调度。 */
export function frozenJobCondition(condition, profile, dependencies = ['pr-context']) {
  const projected = frozenWorkflowText(condition, profile)
  if (['!cancelled()', 'always()', 'success()', 'failure()'].some(status => condition.includes(status))) {
    return projected
  }
  const terms = ['!cancelled()', '(inputs.verification_topology == \'optimized-v2\' || needs.pr-context.result == \'success\')', ...dependencies.filter(name => name !== 'pr-context').map(name => `needs.${name}.result == 'success'`), `(${projected})`]
  return `$${'{{'} ${terms.join(' && ')} }}`
}
