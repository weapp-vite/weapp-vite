import { validateNativeContextShape } from '../../.github/scripts/native-pr-identity.mjs'
import { isNativePrContext } from '../../.github/scripts/native-pr-refresh.mjs'
import { samePullIdentity } from '../../.github/scripts/pr-target-identity.mjs'
import { request } from './github.mjs'

/** 普通原生 CI 复核固定快照的 PR 身份，手动与显式重验仍要求当前基线。 */
export async function readFrozenPrTarget(context, get = request, message = 'PR changed after dispatch; start a new validation') {
  if (isNativePrContext(context)) {
    validateNativeContextShape(context)
  }
  const pull = await get(`/pulls/${context.prNumber}`)
  if (!samePullIdentity(pull, context)) {
    throw new Error(message)
  }
  if (context.event !== 'pull_request') {
    const base = await get(`/git/ref/heads/${encodeURIComponent(context.baseRef)}`)
    if (base.object?.sha !== context.baseSha) {
      throw new Error(message)
    }
  }
  return pull
}
