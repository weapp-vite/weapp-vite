import type { ProcessIdentityMetadata } from '../types'
import type { NativeInventory } from './closure'
import type { NativeRow } from './model'
import { DARWIN_INSPECTOR_PHASES } from '../processInventory/darwinInspector/types'
import { completeForeignConfirmation, completeForeignProofFrames, foreignAncestry, foreignPaths } from './foreignProof'
import { insideInstallation, metadata, sameNativeIdentity, validNativeImage } from './model'
import { absoluteTicks, absoluteWithin, completePostAnchorRow, postAnchorBirth, sameCredentials, validNativeUid } from './postAnchorBirth'

type ForeignBracketMode = 'image-transition' | 'enumeration-credentials'

export interface ForeignBracketProof {
  firstIndex: number
  rows: NativeRow[]
  ancestry: ProcessIdentityMetadata[]
  birthTicks?: bigint
  previousFrameEndedAtTicks?: bigint
}

/** 旧映像转换保留独立的 RSS 权限与跨帧凭据契约。 */
function completeLegacyRow(row: NativeRow, installationRoot: string) {
  const { before, after, pathBefore, pathAfter, task } = row.entry
  const completeIdentities = [before, after].every(read => read.result === 0 && read.errno === 0 && read.length > 0 && read.identity !== null)
    && before.identity?.uid === after.identity?.uid
  const completeImages = [pathBefore, pathAfter].every(read => read.count > 0 && read.errno === 0 && validNativeImage(read.executable))
    && pathBefore.executable === pathAfter.executable && row.imageSource === 'kernel-path'
    && row.images?.length === 1 && row.images[0] === pathBefore.executable && !insideInstallation(installationRoot, row.images[0])
  const taskVerified = task.count > 0 && task.errno === 0 && sameNativeIdentity(row.identity, task.identity)
    && row.identity?.uid === task.identity?.uid && row.rssBytes !== null
  const taskPermissionDenied = task.count === 0 && task.errno === 1 && task.identity === null && task.rssBytes === null
  return completeIdentities && completeImages && !row.identityChanged && !row.imageChanged && !row.identity?.zombie
    && sameNativeIdentity(row.identity, row.finalIdentity) && (taskVerified || taskPermissionDenied)
    && row.entry.gaps.every(gap => gap === 'rss-unavailable' && taskPermissionDenied)
}

/** 新例外仅允许首次枚举至 before 的 UID 差异，不恢复归一化后的映像或 RSS。 */
function completeCredentialRow(row: NativeRow, installationRoot: string, first: boolean) {
  const { enumeratedIdentity, before, after, pathBefore, pathAfter, gaps, task } = row.entry
  const changed = !sameCredentials(enumeratedIdentity, before.identity)
  const completeCredentials = [enumeratedIdentity.uid, before.identity?.uid, task.identity?.uid, after.identity?.uid]
    .every(validNativeUid)
  return completeCredentials && completePostAnchorRow(row) && Number.isSafeInteger(Number(task.rssBytes))
    && foreignPaths(row.entry, installationRoot) && pathBefore.executable === pathAfter.executable
    && (first
      ? changed && row.enumerationIdentityChange?.position === 'before'
      && gaps.length === 1 && gaps[0] === 'enumeration-identity-changed'
      : !changed && !row.identityChanged && gaps.length === 0)
}

/** 新证明同时核对原时钟校准；旧模式不新增绝对时钟前提。 */
function completeCredentialClocks(inventory: NativeInventory) {
  return completeForeignProofFrames(inventory) && inventory.frames.every(({ wire }) => {
    const absolute = wire.absolute!
    const start = absolute.startCalibration
    const end = absolute.endCalibration
    if (!start || !end || start.absoluteTicks !== absolute.startedAtTicks || end.absoluteTicks !== absolute.endedAtTicks) {
      return false
    }
    const values = [wire.startedAtNanoseconds, start.monotonicBeforeNanoseconds, start.monotonicAfterNanoseconds, end.monotonicBeforeNanoseconds, end.monotonicAfterNanoseconds, wire.endedAtNanoseconds].map(absoluteTicks)
    return values.every((value, index) => value !== null && (index === 0 || (values[index - 1] !== null && value >= values[index - 1]!)))
  })
}

/** 一个逐帧证明引擎分离旧转换与严格凭据模式，候选不能相互豁免祖先缺口。 */
export function createForeignBracketProver(inventory: NativeInventory, installationRoot: string) {
  const { frames, tracked, selectedSeen } = inventory
  const completePhases = frames.length === DARWIN_INSPECTOR_PHASES.length
    && frames.every((frame, index) => frame.phase === DARWIN_INSPECTOR_PHASES[index])
  const caches = {
    'image-transition': new Map<number, ForeignBracketProof | null>(),
    'enumeration-credentials': new Map<number, ForeignBracketProof | null>(),
  }

  function prove(pid: number, mode: ForeignBracketMode, requiredFrom = frames.length - 1, visiting = new Set<number>()): ForeignBracketProof | null {
    const entry = tracked.get(pid)
    const firstIndex = frames.findIndex(frame => frame.phase === entry?.firstPhase)
    if (!completePhases || firstIndex < 0 || firstIndex > requiredFrom || firstIndex >= frames.length - 1) {
      return null
    }
    const cache = caches[mode]
    if (cache.has(pid)) {
      return cache.get(pid)!
    }
    const strict = mode === 'enumeration-credentials'
    const change = inventory.changes.get(pid)
    const changeAllowed = strict
      ? change !== undefined && change.boundary !== undefined
      && change.reasons.length === 1 && change.reasons[0] === 'credentials-changed'
      && change.boundary.from.phase === entry?.firstPhase && change.boundary.from.position === 'enumeration'
      && change.boundary.to.phase === entry?.firstPhase && change.boundary.to.position === 'before'
      : !change
    const rows = frames.slice(firstIndex).map(frame => frame.rows.get(pid))
    const first = rows[0]
    if (visiting.has(pid) || !entry || !first || entry.absent || entry.imageEvidenceConflict || entry.closureIdentityUnverifiable
      || selectedSeen.has(pid) || !changeAllowed
      || entry.causes.some(cause => strict
        ? !['enumeration-identity-changed', 'identity-changed', 'image-changed'].includes(cause.reason)
        : cause.reason !== 'image-changed')
      || frames.slice(0, firstIndex).some(frame => frame.rows.has(pid))
      || rows.some((row, index) => !row || !(strict ? completeCredentialRow(row, installationRoot, index === 0) : completeLegacyRow(row, installationRoot))
        || !(strict ? sameCredentials(first.identity, row.identity) : sameNativeIdentity(first.identity, row.identity)))) {
      cache.set(pid, null)
      return null
    }
    let birthTicks: bigint | undefined
    const boundary = firstIndex === 0 ? 0n : absoluteTicks(frames[firstIndex - 1]!.wire.absolute?.endedAtTicks)
    if (strict) {
      // 仅两次主读取时，必须额外独立确认最终身份；确认仍逐项进入原有核验。
      const requiresFinalConfirmation = rows.length < 3
      if (!completeCredentialClocks(inventory) || boundary === null
        || (requiresFinalConfirmation && !rows.at(-1)!.entry.confirmation)) {
        cache.set(pid, null)
        return null
      }
      for (const [index, row] of rows.entries()) {
        const frame = frames[firstIndex + index]!
        const value = postAnchorBirth(row!.entry.absolute, boundary, birthTicks)
        const start = absoluteTicks(row!.entry.absolute?.startedAtTicks)
        if (value === null || start === null || value > start || !absoluteWithin(row!.entry.absolute, frame.wire.absolute)
          || (row!.entry.confirmation && !completeForeignConfirmation(row!, first.identity!, value, boundary, frame, installationRoot))) {
          cache.set(pid, null)
          return null
        }
        birthTicks = value
      }
    }
    visiting.add(pid)
    const parentPid = first.identity!.parentPid
    const parent = !strict && parentPid > 1 ? prove(parentPid, mode, firstIndex, visiting) : null
    const ancestry = strict
      ? foreignAncestry(inventory, installationRoot, parentPid, firstIndex, visiting, true)
      : parentPid <= 1 ? [] : parent ? [metadata(parent.rows[0]!), ...parent.ancestry] : null
    const proof = ancestry === null ? null : { firstIndex, rows: rows as NativeRow[], ancestry, ...(strict ? { birthTicks, previousFrameEndedAtTicks: boundary! } : {}) }
    cache.set(pid, proof)
    return proof
  }

  return prove
}

export type ForeignBracketProver = ReturnType<typeof createForeignBracketProver>
