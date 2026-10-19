import type { ManagedWechatProjectRecord } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/types'
import type { TaskResourceReport } from './types'

/** 创建时间表示启动意图；只计算保守意图区间，绝不将其命名为原生窗口峰值。 */
export function summarizeTaskWindows(records: Array<Pick<ManagedWechatProjectRecord, 'id' | 'createdAt' | 'openedProjectWindow' | 'releasedReason' | 'windowClose'> & { snapshot?: Pick<NonNullable<ManagedWechatProjectRecord['snapshot']>, 'state' | 'dispatchedAt'> }>, budget: string | undefined, observedAt: string): TaskResourceReport['windowUsage'] {
  const gaps: string[] = []
  const boundary = Date.parse(observedAt)
  const events: Array<{ at: number, delta: number }> = []
  let invalid = false
  for (const record of records) {
    if (record.openedProjectWindow === false || record.releasedReason === 'borrowed'
      || (record.releasedReason === 'not-started' && record.snapshot?.state === 'removed'
        && !record.snapshot.dispatchedAt && record.openedProjectWindow === undefined)) {
      continue
    }
    const start = Date.parse(record.createdAt)
    const window = record.windowClose?.window
    const nativeClosed = window?.nativeClosedAt ? Date.parse(window.nativeClosedAt) : Number.NaN
    const webDestroyed = window?.webContentsDestroyedAt ? Date.parse(window.webContentsDestroyedAt) : Number.NaN
    const hasBoth = Number.isFinite(nativeClosed) && Number.isFinite(webDestroyed)
    const end = hasBoth ? Math.max(nativeClosed, webDestroyed) : boundary
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      gaps.push(`Invalid intent/destruction interval for journal record ${record.id}.`)
      invalid = true
      continue
    }
    if (!hasBoth) {
      gaps.push(`Journal record ${record.id} has no complete native/webContents destruction pair; its intent interval remains open through the observation boundary.`)
    }
    events.push({ at: start, delta: 1 }, { at: end, delta: -1 })
  }
  // 同一时间先算创建，保持创建时间精度不足时的保守重叠上界。
  events.sort((first, second) => first.at - second.at || second.delta - first.delta)
  let active = 0
  let maximum = 0
  for (const event of events) {
    active += event.delta
    maximum = Math.max(maximum, active)
  }
  const selectedBudget = budget ?? '1'
  return {
    managedBudget: selectedBudget === '1' || selectedBudget === '2'
      ? { status: 'observed', value: Number(selectedBudget) as 1 | 2 }
      : { status: 'unavailable', reason: 'Configured managed window budget is not 1 or 2.' },
    traceDerivedManagedOverlapUpperBound: invalid
      ? { status: 'unavailable', reason: 'Journal intent intervals contain invalid timestamps.' }
      : { status: 'observed', value: maximum },
    sampledNativeWindowMaximum: { status: 'unavailable', reason: 'This recorder does not sample native windows.' },
    semantics: 'Conservative overlap of managed launch intents from createdAt through both destruction events, or the observation boundary when the pair is missing; neither createdAt nor this bound proves native window opening or a native peak.',
    gaps,
  }
}
