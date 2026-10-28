import type { ProcessIdentityMetadata, VerifiedForeignNativeExec } from '../types'
import type { NativeInventory } from './closure'
import type { NativeRow } from './model'
import { DARWIN_INSPECTOR_PHASES } from '../processInventory/darwinInspector/types'
import { imageEvidence } from './evidence'
import { insideInstallation, metadata, sameNativeIdentity, validNativeImage } from './model'

/** 同帧 exec 只接受完整原生读取，帧内凭据和 RSS 身份必须一致。 */
function completeForeignRow(row: NativeRow, installationRoot: string, transition = false) {
  const { before, after, pathBefore, pathAfter, task, gaps } = row.entry
  const completeIdentities = [before, after].every(read => read.result === 0 && read.errno === 0 && read.length > 0 && read.identity !== null)
    && row.pid === before.identity?.pid && sameNativeIdentity(before.identity, after.identity)
    && before.identity?.uid === after.identity?.uid && !before.identity?.zombie && !row.identityChanged
  const completeTask = task.count > 0 && task.errno === 0 && task.identity !== null && row.rssBytes !== null
    && sameNativeIdentity(before.identity, task.identity) && before.identity?.uid === task.identity?.uid
  const completeImages = [pathBefore, pathAfter].every(read => read.count > 0 && read.errno === 0
    && validNativeImage(read.executable) && !insideInstallation(installationRoot, read.executable))
  const imageBracket = transition
    ? row.imageChanged && gaps.includes('image-changed') && gaps.every(gap => gap === 'image-changed')
    : !row.imageChanged && gaps.length === 0 && pathBefore.executable === pathAfter.executable
      && row.imageSource === 'kernel-path' && row.images?.length === 1 && row.images[0] === pathBefore.executable
  return completeIdentities && completeTask && completeImages && imageBracket
}

/** 新证明独立要求跨帧 UID 不变，不改变旧跨帧 exec 允许凭据变化的契约。 */
function sameCredentials(first: NativeRow, next: NativeRow) {
  return sameNativeIdentity(first.identity, next.identity) && first.identity?.uid === next.identity?.uid
}

/** 仅证明闭合首帧新出现的外来 exec，后一完整帧确认最终映像；保留原始变化。 */
export function verifiedForeignNativeExecs(inventory: NativeInventory, installationRoot: string): VerifiedForeignNativeExec[] {
  const { frames, tracked, selectedSeen, changes } = inventory
  if (frames.length !== DARWIN_INSPECTOR_PHASES.length || frames.some((frame, index) => frame.phase !== DARWIN_INSPECTOR_PHASES[index])) {
    return []
  }
  const proveAncestry = (pid: number, requiredFrom: number, visiting = new Set<number>()): ProcessIdentityMetadata[] | null => {
    const entry = tracked.get(pid)
    const firstIndex = frames.findIndex(frame => frame.phase === entry?.firstPhase)
    if (!entry || firstIndex < 0 || firstIndex > requiredFrom || visiting.has(pid) || entry.absent || entry.changed
      || entry.textImageEvidenceConflict || entry.closureIdentityUnverifiable || entry.causes.length || selectedSeen.has(pid) || changes.has(pid)) {
      return null
    }
    const rows = frames.slice(firstIndex).map(frame => frame.rows.get(pid))
    const first = rows[0]
    if (!first || rows.some(row => !row || !completeForeignRow(row, installationRoot) || !sameCredentials(first, row))) {
      return null
    }
    visiting.add(pid)
    const parentPid = first.identity!.parentPid
    const ancestors = parentPid <= 1 ? [] : proveAncestry(parentPid, firstIndex, visiting)
    return ancestors === null ? null : [metadata(first), ...ancestors]
  }
  const proofs: VerifiedForeignNativeExec[] = []
  for (const [pid, entry] of tracked) {
    if (entry.firstPhase !== 'closure1' || entry.absent || !entry.changed || entry.textImageEvidenceConflict
      || entry.closureIdentityUnverifiable || selectedSeen.has(pid) || changes.has(pid)
      || !entry.causes.length || entry.causes.some(cause => cause.reason !== 'image-changed')
      || frames.slice(0, 2).some(frame => frame.rows.has(pid))) {
      continue
    }
    const first = frames[2]!.rows.get(pid)
    const confirmation = frames[3]!.rows.get(pid)
    if (!first || !confirmation || !completeForeignRow(first, installationRoot, true)
      || !completeForeignRow(confirmation, installationRoot) || !sameCredentials(first, confirmation)
      || first.entry.pathAfter.executable !== confirmation.entry.pathBefore.executable) {
      continue
    }
    const parentPid = first.identity!.parentPid
    const ancestry = parentPid <= 1 ? [] : proveAncestry(parentPid, 2, new Set([pid]))
    if (ancestry === null) {
      continue
    }
    proofs.push({
      process: inventory.gap(entry),
      from: { phase: 'closure1', position: 'path-before', image: imageEvidence(first.entry.pathBefore.executable!, installationRoot) },
      to: { phase: 'closure1', position: 'path-after', image: imageEvidence(first.entry.pathAfter.executable!, installationRoot) },
      confirmationPhase: 'closure2',
      ancestry,
      proof: 'complete-native-foreign-exec-brackets-since-first-observation',
      phases: ['closure1', 'closure2'],
    })
  }
  return proofs
}
