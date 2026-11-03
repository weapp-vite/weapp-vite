import type { DarwinProcessIdentity } from '../processInventory/darwinInspector/types'
import type { ProcessIdentityChangeObservation, ProcessIdentityGapCause } from '../types'
import type { TrackedNativeProcess } from './closure'
import type { NativePhase, NativeRow } from './model'
import { metadata, nativeLocation, sameNativeIdentity } from './model'

/** 枚举身份独立于逐行查询；新的冲突只能增加缺口，不能补齐查询、映像或 RSS。 */
export function trackEnumerationIdentity(
  entry: TrackedNativeProcess,
  row: NativeRow,
  phase: NativePhase,
  changes: Map<number, ProcessIdentityChangeObservation>,
  cause: (entry: TrackedNativeProcess, reason: ProcessIdentityGapCause['reason'], phase: NativePhase) => void,
) {
  function record(from: DarwinProcessIdentity, to: DarwinProcessIdentity, boundary: NonNullable<ProcessIdentityChangeObservation['boundary']>, credentials: boolean) {
    entry.changed = true
    cause(entry, 'enumeration-identity-changed', phase)
    if (changes.has(row.pid)) {
      return
    }
    const reasons: ProcessIdentityChangeObservation['reasons'] = []
    if (entry.absent) {
      reasons.push('returned-after-absence')
    }
    if (from.startedSeconds !== to.startedSeconds || from.startedMicroseconds !== to.startedMicroseconds) {
      reasons.push('started-changed')
    }
    if (from.parentPid !== to.parentPid) {
      reasons.push('parent-changed')
    }
    if (from.zombie !== to.zombie) {
      reasons.push('zombie-changed')
    }
    if (credentials && from.uid !== to.uid) {
      reasons.push('credentials-changed')
    }
    changes.set(row.pid, {
      ...metadata({ ...row, identity: from }),
      changedTo: metadata({ ...row, identity: to }),
      reasons,
      firstObserved: nativeLocation(phase),
      boundary,
    })
  }

  if (entry.row !== row) {
    const previous = entry.row.identity ?? entry.row.entry.enumeratedIdentity
    const enumerated = row.entry.enumeratedIdentity
    // 跨帧凭据变化和单纯 zombie 转移仍由原契约处理；不能把换了启动令牌的退出拼到旧身份。
    if (!sameNativeIdentity({ ...previous, zombie: enumerated.zombie }, enumerated)) {
      record(previous, enumerated, {
        from: { phase: entry.firstPhase, position: entry.row.entry.before.identity ? 'before' : entry.row.identity ? 'after' : 'enumeration' },
        to: { phase, position: 'enumeration' },
      }, false)
    }
  }
  if (row.enumerationIdentityChange) {
    const { from, to, position } = row.enumerationIdentityChange
    record(from, to, { from: { phase, position: 'enumeration' }, to: { phase, position } }, true)
  }
}
