import assert from 'node:assert/strict'
import { validateNativeRunIdentity } from './native-pr-identity.mjs'
import { matchesMergeParents, samePullIdentity } from './pr-target-identity.mjs'

const fullSha = value => typeof value === 'string' && /^[a-f\d]{40}$/u.test(value)
const positive = value => Number.isSafeInteger(value) && value > 0
const fileStatuses = new Set(['added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged'])

/** 普通 PR 只验证本轮已批准的 merge，不用审批后的可变主线重新分配目标。 */
export async function resolveNativeSnapshotContext({ repository, runId, runAttempt = 1, driverSha, event }, get) {
  const pull = event?.pull_request
  assert(pull && pull.base?.repo?.full_name === repository && pull.head?.repo?.full_name
    && positive(event.number) && event.number === pull.number
    && positive(pull.head.repo.id) && positive(pull.base.repo.id), 'Expected a pull_request event for this repository')
  const context = {
    schemaVersion: 1,
    repository,
    runId: String(runId),
    runAttempt: Number(runAttempt),
    driverSha,
    event: 'pull_request',
    isPr: true,
    shouldRun: true,
    prNumber: event.number,
    headSha: pull.head.sha,
    headRef: pull.head.ref,
    baseRef: pull.base.ref,
    headRepository: pull.head.repo.full_name,
    checkoutSha: driverSha,
    checkoutMode: 'merge',
  }
  const run = await get(`/actions/runs/${runId}`)
  validateNativeRunIdentity(context, run, repository, true)
  const identities = { baseRepositoryId: run.repository.id, headRepositoryId: run.head_repository.id }
  assert(pull.base.repo.id === identities.baseRepositoryId && pull.head.repo.id === identities.headRepositoryId, 'Untrusted native PR event repository identity')
  const merge = await get(`/git/commits/${driverSha}`)
  const baseSha = merge?.parents?.[0]?.sha
  assert(fullSha(baseSha) && matchesMergeParents(merge, driverSha, baseSha, context.headSha), 'Untrusted native PR snapshot merge parent identity')
  context.baseSha = baseSha
  const current = await get(`/pulls/${context.prNumber}`)
  assert(samePullIdentity(current, context, identities), 'PR changed while waiting for approval; approve the new run')
  return { context, identities }
}

/** 文件选择同样来自冻结的两个提交；比较接口截断时保留全部适用检查。 */
export async function readNativeSnapshotFiles(context, get) {
  const comparison = await get(`/compare/${context.baseSha}...${context.headSha}?per_page=100`)
  assert(comparison?.base_commit?.sha === context.baseSha && Array.isArray(comparison.files)
    && comparison.files.every(file => typeof file?.filename === 'string' && file.filename.length > 0
      && (file.previous_filename === undefined || (typeof file.previous_filename === 'string' && file.previous_filename.length > 0))), 'Invalid native snapshot changed-files response')
  const files = comparison.files
  const truncated = files.length >= 300 || files.some(file => !fileStatuses.has(file.status)
    || (file.status === 'renamed' && !file.previous_filename))
  return { files, truncated }
}
