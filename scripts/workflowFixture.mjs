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
