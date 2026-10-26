import { matchesMergeParents, samePullIdentity } from './pr-target-identity.mjs'

const positive = value => Number.isSafeInteger(value) && value > 0

/** 运行本身的仓库、源仓库与分支不可由 artifact 补造，空 PR 关联另需完整 API 证明。 */
export function validateNativeRunIdentity(context, run, repository, allowUnassociated = false) {
  const pull = run.pull_requests?.find(pull => pull.number === context.prNumber)
  if (run.event !== 'pull_request' || run.path !== '.github/workflows/ci-pr.yml'
    || !['headRef', 'baseRef', 'headRepository'].every(key => typeof context[key] === 'string' && context[key])
    || !/^[a-f\d]{40}$/u.test(context.headSha ?? '')
    || String(run.id) !== String(context.runId) || !positive(run.id)
    || run.run_attempt !== Number(context.runAttempt) || !positive(run.run_attempt)
    || run.repository?.full_name !== repository || !positive(run.repository.id)
    || run.head_repository?.full_name !== context.headRepository || !positive(run.head_repository.id)
    || run.head_sha !== context.headSha || run.head_branch !== context.headRef
    || !Array.isArray(run.pull_requests) || (!allowUnassociated && !pull)
    || (run.pull_requests.length > 0 && (!pull || pull.head?.sha !== context.headSha
      || pull.head.ref !== context.headRef || pull.base?.ref !== context.baseRef
      || (!allowUnassociated && pull.base.sha !== context.baseSha)
      || (pull.head.repo?.id !== undefined && pull.head.repo.id !== run.head_repository.id)
      || (pull.base.repo?.id !== undefined && pull.base.repo.id !== run.repository.id)))) {
    throw new Error('Untrusted native PR run identity')
  }
}

export function validateNativeContextShape(context) {
  if (context?.event !== 'pull_request' || context.schemaVersion !== 1 || context.isPr !== true
    || !positive(context.prNumber) || !positive(Number(context.runAttempt))
    || !['headRef', 'baseRef', 'headRepository'].every(key => typeof context[key] === 'string' && context[key])
    || !['headSha', 'baseSha', 'driverSha', 'checkoutSha'].every(key => /^[a-f\d]{40}$/u.test(context[key] ?? ''))
    || context.checkoutMode !== 'merge' || context.checkoutSha !== context.driverSha
    || typeof context.selections !== 'object' || !context.selections) {
    throw new Error('Untrusted native PR context')
  }
}

/** 独立核验 fork 运行的 PR、仓库、ref 与合并父节点；不能仅凭空关联跳过身份检查。 */
export async function verifyNativePrContext(context, run, repository, get) {
  validateNativeContextShape(context)
  if (context.repository !== repository) {
    throw new Error('Untrusted native PR context repository')
  }
  validateNativeRunIdentity(context, run, repository, true)
  const pull = await get(`/pulls/${context.prNumber}`)
  const identities = { baseRepositoryId: run.repository.id, headRepositoryId: run.head_repository.id }
  if (!samePullIdentity(pull, context, identities)) {
    return { valid: false, reason: 'stale-pr' }
  }
  const base = await get(`/git/ref/heads/${encodeURIComponent(context.baseRef)}`)
  if (base.object?.sha !== context.baseSha) {
    return { valid: false, reason: 'stale-base' }
  }
  const mergeRef = await get(`/git/ref/pull/${context.prNumber}/merge`)
  if (mergeRef.ref !== `refs/pull/${context.prNumber}/merge` || mergeRef.object?.sha !== context.checkoutSha
    || pull.merge_commit_sha !== context.checkoutSha) {
    return { valid: false, reason: 'stale-merge' }
  }
  const merge = await get(`/git/commits/${context.checkoutSha}`)
  if (!matchesMergeParents(merge, context.checkoutSha, context.baseSha, context.headSha)) {
    throw new Error('Untrusted native PR merge parent identity')
  }
  const current = await get(`/pulls/${context.prNumber}`)
  const currentBase = await get(`/git/ref/heads/${encodeURIComponent(context.baseRef)}`)
  if (!samePullIdentity(current, context, identities) || current.merge_commit_sha !== context.checkoutSha) {
    return { valid: false, reason: 'stale-pr' }
  }
  if (currentBase.object?.sha !== context.baseSha) {
    return { valid: false, reason: 'stale-base' }
  }
  return { valid: true, pull }
}
