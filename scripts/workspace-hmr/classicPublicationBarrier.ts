import type { NativePublicationProfileCursor } from '../../e2e/utils/nativePublication/files'
import type { WorkspaceHmrAuditBudget } from './auditDeadline'
import { assertHmrAuditBudget } from './auditDeadline'

interface ClassicPublicationObservation {
  outputOffset: number
  profileCursor?: NativePublicationProfileCursor
}

export interface ClassicPublicationBarrierOptions<T> {
  mode: 'stateful-experimental' | 'classic'
  native: { wait: (timeoutMs: number) => Promise<ClassicPublicationObservation> }
  completion: { wait: (timeoutMs: number, cursor?: NativePublicationProfileCursor) => Promise<void> }
  ready: () => Promise<number>
  stable: (timeoutMs: number, signal?: AbortSignal) => Promise<unknown>
  inspect: () => Promise<T>
}

/** 原生字节收据不等于正式 END；完整产物检查只在同一预算内的当前发布完成后执行一次。 */
export async function inspectSettledClassicPublication<T>(options: ClassicPublicationBarrierOptions<T>, budget: WorkspaceHmrAuditBudget): Promise<T> {
  const remaining = () => {
    assertHmrAuditBudget(budget, 'Classic publication inspection deadline exceeded.')
    return budget.deadline - Date.now()
  }
  const receipt = await options.native.wait(remaining())
  remaining()
  let needsSourceCompletion = options.mode === 'classic'
  if (!needsSourceCompletion) {
    const readyOffset = await options.ready()
    remaining()
    // 首次冷 classic 的正式 END 先于 ready；更晚的收据必须有对应 source END。
    needsSourceCompletion = readyOffset < receipt.outputOffset
  }
  if (needsSourceCompletion) {
    if (!receipt.profileCursor) {
      throw new Error('Classic publication requires the native write profile cursor.')
    }
    await options.completion.wait(remaining(), receipt.profileCursor)
    remaining()
  }
  await options.stable(remaining(), budget.signal)
  remaining()
  const result = await options.inspect()
  remaining()
  return result
}
