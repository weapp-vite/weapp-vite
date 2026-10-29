import { samePullIdentity } from '../../.github/scripts/pr-target-identity.mjs'
import { request } from './github.mjs'

/** 分别核验冻结的 PR 身份与实际目标分支，避免把 PR base 快照当作当前 ref。 */
export async function readFrozenPrTarget(context, get = request, message = 'PR changed after dispatch; start a new validation') {
  const pull = await get(`/pulls/${context.prNumber}`)
  if (!samePullIdentity(pull, context)) {
    throw new Error(message)
  }
  const base = await get(`/git/ref/heads/${encodeURIComponent(context.baseRef)}`)
  if (base.object?.sha !== context.baseSha) {
    throw new Error(message)
  }
  return pull
}
