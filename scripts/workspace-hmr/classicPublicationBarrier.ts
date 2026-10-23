import type { NativePublicationCompletionEvidence, NativePublicationProfileCursor, NativePublicationSourceEvidence } from '../../e2e/utils/nativePublication/files'
import type { WorkspaceHmrAuditBudget } from './auditDeadline'
import type { WorkspaceHmrStageObserver } from './stageRecorder'
import { assertHmrAuditBudget } from './auditDeadline'

interface ClassicPublicationObservation {
  outputOffset: number
  profileCursor?: NativePublicationProfileCursor
  sourcePublications?: readonly NativePublicationSourceEvidence[]
}

export interface ClassicPublicationBarrierOptions<T> {
  mode: 'stateful-experimental' | 'classic'
  native: { wait: (timeoutMs: number) => Promise<ClassicPublicationObservation> }
  completion: { wait: (timeoutMs: number, cursor?: NativePublicationCompletionEvidence) => Promise<void> }
  ready: () => Promise<number>
  stable: (timeoutMs: number, signal?: AbortSignal) => Promise<unknown>
  inspect: () => Promise<T>
  observe?: WorkspaceHmrStageObserver
}

/** 原生字节收据不等于正式 END；完整产物检查只在同一预算内的当前发布完成后执行一次。 */
export async function inspectSettledClassicPublication<T>(options: ClassicPublicationBarrierOptions<T>, budget: WorkspaceHmrAuditBudget): Promise<T> {
  const observe = <V>(step: string, action: () => V | Promise<V>) => options.observe ? options.observe(`publication.${step}`, action) : action()
  const remaining = () => {
    assertHmrAuditBudget(budget, 'Classic publication inspection deadline exceeded.')
    return budget.deadline - Date.now()
  }
  const receipt = await observe('native-receipt', () => options.native.wait(remaining()))
  remaining()
  let needsSourceCompletion = options.mode === 'classic'
  if (!needsSourceCompletion) {
    const readyOffset = await observe('ready-transition', () => options.ready())
    remaining()
    // 首次冷 classic 的正式 END 先于 ready；更晚的收据必须有对应 source END。
    needsSourceCompletion = readyOffset < receipt.outputOffset
  }
  if (needsSourceCompletion) {
    if (!receipt.profileCursor) {
      throw new Error('Classic publication requires the native write profile cursor.')
    }
    await observe('formal-end', () => options.completion.wait(remaining(), receipt.sourcePublications ?? receipt.profileCursor))
    remaining()
  }
  await observe('stable-output', () => options.stable(remaining(), budget.signal))
  remaining()
  const result = await observe('inspect-output', () => options.inspect())
  remaining()
  return result
}
