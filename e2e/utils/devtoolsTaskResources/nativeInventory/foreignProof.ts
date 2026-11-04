import type { DarwinProcessIdentity } from '../processInventory/darwinInspector/types'
import type { ProcessIdentityMetadata } from '../types'
import type { NativeInventory } from './closure'
import type { NativeFrame, NativeRow } from './model'
import { DARWIN_INSPECTOR_PHASES } from '../processInventory/darwinInspector/types'
import { insideInstallation, metadata, sameNativeIdentity, validNativeImage } from './model'
import { absoluteTicks, absoluteWithin, completePostAnchorRow, postAnchorBirth, sameCredentials } from './postAnchorBirth'

export function foreignPaths(row: Pick<NativeRow['entry'], 'pathBefore' | 'pathAfter'>, installationRoot: string) {
  return [row.pathBefore, row.pathAfter].every(read => read.count > 0 && read.errno === 0
    && validNativeImage(read.executable) && !insideInstallation(installationRoot, read.executable))
}

/** 四个原生阶段必须完整且同钟域有序，不能用后来的锚点替换失败帧。 */
export function completeForeignProofFrames(inventory: NativeInventory) {
  const { frames } = inventory
  if (frames.length !== DARWIN_INSPECTOR_PHASES.length || frames.some((frame, index) => frame.phase !== DARWIN_INSPECTOR_PHASES[index])) {
    return false
  }
  let previousEnd = 0n
  for (const frame of frames) {
    const absolute = frame.wire.absolute
    const start = absoluteTicks(absolute?.startedAtTicks)
    const end = absoluteTicks(absolute?.endedAtTicks)
    if (absolute?.clockDomain !== 'mach-absolute-ticks' || start === null || end === null || start < previousEnd || end < start) {
      return false
    }
    previousEnd = end
  }
  return true
}

/** 若存在额外确认，仍逐项核验原始读取，不能只接受一个成功标记。 */
export function completeForeignConfirmation(row: NativeRow, identity: DarwinProcessIdentity, birth: bigint, boundary: bigint, frame: NativeFrame, installationRoot: string) {
  const confirmation = row.entry.confirmation
  const absolute = row.entry.absolute
  return Boolean(confirmation && absolute
    && absoluteWithin(confirmation, frame.wire.absolute)
    && absoluteTicks(confirmation.startedAtTicks) !== null && absoluteTicks(absolute.endedAtTicks) !== null
    && BigInt(confirmation.startedAtTicks) >= BigInt(absolute.endedAtTicks)
    && postAnchorBirth(confirmation, boundary, birth) !== null
    && [confirmation.before, confirmation.after].every(read => read.result === 0 && read.errno === 0 && read.length > 0)
    && sameCredentials(identity, confirmation.before.identity) && sameCredentials(identity, confirmation.after.identity)
    && sameNativeIdentity(row.entry.enumeratedIdentity, confirmation.before.identity)
    && foreignPaths(confirmation, installationRoot) && confirmation.pathBefore.executable === confirmation.pathAfter.executable
    && confirmation.pathBefore.executable === row.entry.pathAfter.executable)
}

/** 祖先必须独立持有完整稳定的外来证据；候选之间不能相互豁免未知归属。 */
export function foreignAncestry(inventory: NativeInventory, installationRoot: string, pid: number, requiredFrom: number, visiting: Set<number>, requireAbsoluteBirth = false): ProcessIdentityMetadata[] | null {
  if (pid <= 1) {
    return []
  }
  const entry = inventory.tracked.get(pid)
  const firstIndex = inventory.frames.findIndex(frame => frame.phase === entry?.firstPhase)
  if (!entry || firstIndex < 0 || firstIndex > requiredFrom || visiting.has(pid) || entry.absent || entry.changed || entry.causes.length
    || entry.textImageEvidenceConflict || entry.closureIdentityUnverifiable || inventory.selectedSeen.has(pid) || inventory.changes.has(pid)) {
    return null
  }
  const rows = inventory.frames.slice(firstIndex).map(frame => frame.rows.get(pid))
  const first = rows[0]
  if (!first || rows.some(row => !row || !completePostAnchorRow(row) || row.entry.gaps.length || row.identityChanged
    || !sameCredentials(first.identity, row.identity) || !foreignPaths(row.entry, installationRoot)
    || row.entry.pathBefore.executable !== row.entry.pathAfter.executable || row.entry.pathBefore.executable !== first.entry.pathBefore.executable)) {
    return null
  }
  if (requireAbsoluteBirth) {
    let birth: bigint | undefined
    for (const [index, row] of rows.entries()) {
      const frame = inventory.frames[firstIndex + index]!
      const value = postAnchorBirth(row!.entry.absolute, 0n, birth)
      const rowStart = absoluteTicks(row!.entry.absolute?.startedAtTicks)
      if (value === null || rowStart === null || value > rowStart || !absoluteWithin(row!.entry.absolute, frame.wire.absolute)
        || (row!.entry.confirmation && !completeForeignConfirmation(row!, first.identity!, value, 0n, frame, installationRoot))) {
        return null
      }
      birth = value
    }
  }
  visiting.add(pid)
  const parents = foreignAncestry(inventory, installationRoot, first.identity!.parentPid, firstIndex, visiting, requireAbsoluteBirth)
  return parents === null ? null : [metadata(first), ...parents]
}
