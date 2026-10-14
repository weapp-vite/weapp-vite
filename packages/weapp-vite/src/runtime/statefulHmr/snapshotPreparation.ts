import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrSnapshotBatch } from './snapshotScheduler'
import { getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { withTailwindSnapshotGeneration } from '../../plugins/tailwindcss/generation'

interface SnapshotPreparation {
  input?: WeappCompilerHmrRequest
  rebuild: () => Promise<StatefulHmrSnapshot>
}

/** 刷新独自持有固定 preparation，直到提交、替代或失败后才释放。 */
export async function withStatefulHmrSnapshotPreparation<T>(
  ctx: CompilerContext,
  batch: StatefulHmrSnapshotBatch,
  rebuild: (files: string[], sources?: ReadonlyMap<string, string | null>) => Promise<StatefulHmrSnapshot>,
  consume: (preparation: SnapshotPreparation) => Promise<T>,
): Promise<T | undefined> {
  const host = getCompilerHmrHost(ctx)
  if (batch.mode !== 'refresh' || !host.enabled || !host.supported) {
    return consume({ rebuild: () => rebuild(batch.files) })
  }
  if (batch.isSuperseded()) {
    return undefined
  }
  // refresh 不消费原生批次的视觉旧值；输入捕获已由前置 watch owner 完成。
  const view = host.freeze([])
  const input = Object.freeze({
    revision: view.revision,
    sources: view.sources,
    changedFiles: Object.freeze([...batch.files]),
  })
  // 必须在同一同步入口封存 provider roots，不能在取得 view 后插入异步等待。
  const preparations = await host.prepare(input)
  let result: T | undefined
  let failed = false
  let failure: unknown
  try {
    if (!batch.isSuperseded()) {
      result = await consume({
        input,
        rebuild: () => withTailwindSnapshotGeneration(input, preparations, () => rebuild([...input.changedFiles], input.sources)),
      })
    }
  }
  catch (error) {
    failed = true
    failure = error
  }
  const results = await Promise.allSettled(preparations.map(preparation => Promise.resolve().then(() => preparation.dispose?.())))
  const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  if (failures.length) {
    if (failed) {
      throw new AggregateError([failure, ...failures], 'HMR 资产刷新及 preparation 释放均失败。', { cause: failure })
    }
    if (failures.length === 1) {
      throw failures[0]
    }
    throw new AggregateError(failures, 'HMR 资产刷新 preparation 释放失败。')
  }
  if (failed) {
    throw failure
  }
  return result
}
