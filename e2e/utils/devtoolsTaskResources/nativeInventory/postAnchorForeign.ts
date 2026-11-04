import type { ProcessIdentityMetadata, VerifiedPostAnchorForeignProcess } from '../types'
import type { NativeInventory } from './closure'
import type { NativeRow } from './model'
import { DARWIN_INSPECTOR_PHASES } from '../processInventory/darwinInspector/types'
import { imageEvidence } from './evidence'
import { insideInstallation, metadata, sameNativeIdentity, validNativeImage } from './model'
import { absoluteTicks, absoluteWithin, completePostAnchorRow, postAnchorBirth, sameCredentials } from './postAnchorBirth'

function foreignPaths(row: Pick<NativeRow['entry'], 'pathBefore' | 'pathAfter'>, installationRoot: string) {
  return [row.pathBefore, row.pathAfter].every(read => read.count > 0 && read.errno === 0
    && validNativeImage(read.executable) && !insideInstallation(installationRoot, read.executable))
}

/** 祖先使用各帧完整稳定的原生证据；出生时间不能把未知父进程变成外来进程。 */
function foreignAncestry(inventory: NativeInventory, installationRoot: string, pid: number, requiredFrom: number, visiting: Set<number>): ProcessIdentityMetadata[] | null {
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
  visiting.add(pid)
  const parents = foreignAncestry(inventory, installationRoot, first.identity!.parentPid, firstIndex, visiting)
  return parents === null ? null : [metadata(first), ...parents]
}

/** 出生严格晚于整个 RSS 锚点；最终独立确认只证明闭合归属，绝不补采 RSS。 */
export function verifiedPostAnchorForeignProcesses(inventory: NativeInventory, installationRoot: string): VerifiedPostAnchorForeignProcess[] {
  const { frames, tracked, selectedSeen } = inventory
  if (frames.length !== DARWIN_INSPECTOR_PHASES.length || frames.some((frame, index) => frame.phase !== DARWIN_INSPECTOR_PHASES[index])) {
    return []
  }
  let previousEnd = 0n
  for (const frame of frames) {
    const absolute = frame.wire.absolute
    const start = absoluteTicks(absolute?.startedAtTicks)
    const end = absoluteTicks(absolute?.endedAtTicks)
    if (absolute?.clockDomain !== 'mach-absolute-ticks' || start === null || end === null || start < previousEnd || end < start) {
      return []
    }
    previousEnd = end
  }
  const anchorEnd = absoluteTicks(frames[1]!.wire.absolute!.endedAtTicks)!
  const proofs: VerifiedPostAnchorForeignProcess[] = []
  for (const [pid, entry] of tracked) {
    if ((entry.firstPhase !== 'closure1' && entry.firstPhase !== 'closure2') || entry.absent || !entry.changed
      || selectedSeen.has(pid) || entry.textImageEvidenceConflict || entry.closureIdentityUnverifiable
      || !entry.causes.length || entry.causes.some(cause => !['enumeration-identity-changed', 'identity-changed', 'image-changed'].includes(cause.reason))
      || frames.slice(0, 2).some(frame => frame.rows.has(pid))) {
      continue
    }
    const change = inventory.changes.get(pid)
    if (change && (change.reasons.length !== 1 || change.reasons[0] !== 'credentials-changed'
      || change.boundary?.from.position !== 'enumeration' || change.boundary.from.phase !== change.boundary.to.phase)) {
      continue
    }
    const firstIndex = entry.firstPhase === 'closure1' ? 2 : 3
    const rows = frames.slice(firstIndex).map(frame => frame.rows.get(pid))
    const first = rows[0]
    let birth: bigint | undefined
    let previousImage: string | null = null
    let valid = Boolean(first)
    for (const [index, row] of rows.entries()) {
      if (!row || !first || !completePostAnchorRow(row) || !sameCredentials(first.identity, row.identity)
        || !foreignPaths(row.entry, installationRoot) || !absoluteWithin(row.entry.absolute, frames[firstIndex + index]!.wire.absolute)
        || (previousImage !== null && previousImage !== row.entry.pathBefore.executable)) {
        valid = false
        break
      }
      const value = postAnchorBirth(row.entry.absolute, anchorEnd, birth)
      if (value === null) {
        valid = false
        break
      }
      birth = value
      previousImage = row.entry.pathAfter.executable
    }
    const final = rows.at(-1)
    const confirmation = final?.entry.confirmation
    const finalAbsolute = final?.entry.absolute
    if (!valid || !first || birth === undefined || !confirmation || !finalAbsolute
      || !absoluteWithin(confirmation, frames[3]!.wire.absolute)
      || absoluteTicks(confirmation.startedAtTicks) === null || absoluteTicks(finalAbsolute.endedAtTicks) === null
      || BigInt(confirmation.startedAtTicks) < BigInt(finalAbsolute.endedAtTicks)
      || postAnchorBirth(confirmation, anchorEnd, birth) === null
      || ![confirmation.before, confirmation.after].every(read => read.result === 0 && read.errno === 0 && read.length > 0)
      || !sameCredentials(first.identity, confirmation.before.identity) || !sameCredentials(first.identity, confirmation.after.identity)
      || !sameNativeIdentity(final!.entry.enumeratedIdentity, confirmation.before.identity)
      || !foreignPaths(confirmation, installationRoot) || confirmation.pathBefore.executable !== confirmation.pathAfter.executable
      || confirmation.pathBefore.executable !== previousImage) {
      continue
    }
    const ancestry = foreignAncestry(inventory, installationRoot, first.identity!.parentPid, firstIndex, new Set([pid]))
    if (ancestry === null) {
      continue
    }
    proofs.push({
      process: inventory.gap(entry),
      proof: 'mach-birth-after-entire-anchor-and-complete-foreign-confirmation',
      clockDomain: 'mach-absolute-ticks',
      birthTicks: String(birth),
      anchorEndedAtTicks: String(anchorEnd),
      phases: frames.slice(firstIndex).map(frame => frame.phase as 'closure1' | 'closure2'),
      confirmationPhase: 'closure2',
      enumerationCredentialsChanged: rows.some(row => row!.entry.enumeratedIdentity.uid !== row!.identity!.uid),
      ancestry,
      image: imageEvidence(previousImage!, installationRoot),
      semantics: 'closure-ownership-only; no-preparation-or-closure-rss-counted',
    })
  }
  return proofs
}
