import assert from 'node:assert/strict'
import { verifyNativeRefreshForkAdmission } from './native-pr-refresh-fork.mjs'
import { matchesMergeParents } from './pr-target-identity.mjs'

const fullSha = value => typeof value === 'string' && value.length === 40 && /^[a-f\d]{40}$/u.test(value)
const positive = value => Number.isSafeInteger(value) && value > 0
const titlePattern = /^PR CI refresh #([1-9]\d*) head=([a-f\d]{40}) base=([a-f\d]{40}) merge=([a-f\d]{40})$/u

/** 原生事件与显式重验共用冻结消费者，不把普通手动诊断提升为原生 CI。 */
export function isNativePrContext(context) {
  return context?.event === 'pull_request' || context?.event === 'native_refresh'
}

/** 请求在新运行创建前固定完整元组；只接受四个明确输入。 */
export function parseNativeRefreshInputs(inputs) {
  const keys = ['pr-number', 'head-sha', 'base-sha', 'merge-sha']
  assert(inputs && typeof inputs === 'object' && !Array.isArray(inputs)
    && Object.keys(inputs).length === keys.length && keys.every(key => Object.hasOwn(inputs, key)), 'Invalid native refresh inputs')
  assert(typeof inputs['pr-number'] === 'string' && /^[1-9]\d*$/u.test(inputs['pr-number'])
    && String(Number(inputs['pr-number'])) === inputs['pr-number']
    && positive(Number(inputs['pr-number'])) && keys.slice(1).every(key => fullSha(inputs[key])), 'Invalid native refresh pins')
  return { prNumber: Number(inputs['pr-number']), headSha: inputs['head-sha'], baseSha: inputs['base-sha'], checkoutSha: inputs['merge-sha'] }
}

/** 标题由 workflow 输入表达式固定，供独立报告器核验服务端保留的 pin。 */
export function nativeRefreshTitle(pins) {
  assert(positive(pins?.prNumber) && ['headSha', 'baseSha', 'checkoutSha'].every(key => fullSha(pins[key])), 'Invalid native refresh pins')
  return `PR CI refresh #${pins.prNumber} head=${pins.headSha} base=${pins.baseSha} merge=${pins.checkoutSha}`
}

/** 解析运行的不可变显示标题；不读取 artifact 提供的替代输入。 */
export function nativeRefreshPinsFromRun(run) {
  const match = titlePattern.exec(run?.display_title ?? '')
  assert(match && positive(Number(match[1])), 'Untrusted native refresh title')
  return { prNumber: Number(match[1]), headSha: match[2], baseSha: match[3], checkoutSha: match[4] }
}

/** run.name 随显示标题变化，按服务端路径路由；使用前仍核对审批、控制来源及目标。 */
export function isNativePrRun(run) {
  const match = titlePattern.exec(run?.display_title ?? '')
  return run?.path === '.github/workflows/ci-pr.yml'
    && (run.event === 'pull_request' || (run.event === 'workflow_dispatch' && Boolean(match && positive(Number(match[1])))))
}

/** 默认分支控制提交和被测 merge 分开证明；旧 run 的批准不能改绑新元组。 */
export function validateNativeRefreshRun(context, run, repository, defaultBranch) {
  assert(typeof defaultBranch === 'string' && defaultBranch && context.controlRef === defaultBranch
    && isNativePrRun(run) && run.event === 'workflow_dispatch'
    && positive(run.id) && String(run.id) === String(context.runId)
    && positive(run.run_attempt) && run.run_attempt === Number(context.runAttempt)
    && fullSha(context.driverSha) && run.head_sha === context.driverSha
    && run.head_branch === defaultBranch && run.repository?.full_name === repository
    && run.head_repository?.full_name === repository && positive(run.repository.id)
    && run.head_repository.id === run.repository.id
    && (context.baseRepositoryId === undefined || context.baseRepositoryId === run.repository.id)
    && run.display_title === nativeRefreshTitle(context), 'Untrusted native refresh run identity')
  const references = run.referenced_workflows
  const prefix = `${repository}/.github/workflows/`
  const owned = Array.isArray(references) ? references.filter(item => typeof item?.path === 'string' && item.path.toLowerCase().startsWith(`${repository.toLowerCase()}/`)) : []
  assert(owned.length && references.every(item => typeof item?.path === 'string' && item.path)
    && owned.every(item => item.path.startsWith(prefix)
      && /^[a-z\d][\w.-]*\.ya?ml@[a-f\d]{40}$/iu.test(item.path.slice(prefix.length))
      && item.path.endsWith(`@${context.driverSha}`) && item.sha === context.driverSha
      && item.ref === `refs/heads/${defaultBranch}`), 'Untrusted native refresh invocation proof')
}

/** 显式重验只使用请求中的 merge，绝不在审批后重新分配目标。 */
export async function resolveNativeRefreshContext({ repository, runId, runAttempt = 1, driverSha, refName, event }, get) {
  const pins = parseNativeRefreshInputs(event.inputs)
  const repo = await get('')
  assert(repo.full_name === repository && positive(repo.id) && typeof repo.default_branch === 'string'
    && refName === `refs/heads/${repo.default_branch}`, 'Native refresh requires the default branch')
  const context = { schemaVersion: 1, repository, runId: String(runId), runAttempt: Number(runAttempt), driverSha, event: 'native_refresh', isPr: true, shouldRun: true, ...pins, controlRef: repo.default_branch, checkoutMode: 'merge' }
  const run = await get(`/actions/runs/${runId}`)
  validateNativeRefreshRun(context, run, repository, repo.default_branch)
  assert(run.repository.id === repo.id, 'Native refresh control repository mismatch')
  const pull = await get(`/pulls/${pins.prNumber}`)
  assert(pull.number === pins.prNumber && pull.state === 'open' && pull.head?.sha === pins.headSha
    && typeof pull.head.ref === 'string' && pull.head.ref && typeof pull.head.repo?.full_name === 'string'
    && positive(pull.head.repo.id) && pull.base?.repo?.full_name === repository && pull.base.repo.id === repo.id
    && typeof pull.base.ref === 'string' && pull.base.ref, 'Native refresh PR changed before freeze')
  Object.assign(context, { headRef: pull.head.ref, baseRef: pull.base.ref, headRepository: pull.head.repo.full_name, headRepositoryId: pull.head.repo.id, baseRepositoryId: repo.id })
  const base = await get(`/git/ref/heads/${encodeURIComponent(context.baseRef)}`)
  const mergeRef = await get(`/git/ref/pull/${pins.prNumber}/merge`)
  const merge = await get(`/git/commits/${pins.checkoutSha}`)
  assert(base.object?.sha === pins.baseSha && mergeRef.ref === `refs/pull/${pins.prNumber}/merge`
    && mergeRef.object?.sha === pins.checkoutSha && matchesMergeParents(merge, pins.checkoutSha, pins.baseSha, pins.headSha), 'Native refresh target is stale or has invalid merge parents')
  await verifyNativeRefreshForkAdmission(context, get)
  return context
}
