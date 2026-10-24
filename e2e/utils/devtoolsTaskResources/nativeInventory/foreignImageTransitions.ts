import type { ProcessIdentityMetadata, VerifiedForeignImageTransition } from '../types'
import type { NativeInventory } from './closure'
import type { NativeRow } from './model'
import { DARWIN_INSPECTOR_PHASES } from '../processInventory/darwinInspector/types'
import { imageEvidence } from './evidence'
import { insideInstallation, metadata, sameNativeIdentity, validNativeImage } from './model'

/** 外来映像证明独立于其 RSS 读取权限；成功 task 身份仍必须与相邻内核身份完全一致。 */
function completeForeignRow(row: NativeRow, installationRoot: string) {
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

/** 只区分完整四帧排除所选安装的映像转换，不修改任何已记录的 changed、缺口或原始帧。 */
export function verifiedForeignImageTransitions(inventory: NativeInventory, installationRoot: string): VerifiedForeignImageTransition[] {
  const { frames, tracked, selectedSeen } = inventory
  if (frames.length !== DARWIN_INSPECTOR_PHASES.length || frames.some((frame, index) => frame.phase !== DARWIN_INSPECTOR_PHASES[index])) {
    return []
  }
  const proofs = new Map<number, ProcessIdentityMetadata[] | null>()
  const proveAncestry = (pid: number, visiting = new Set<number>()): ProcessIdentityMetadata[] | null => {
    if (proofs.has(pid)) {
      return proofs.get(pid)!
    }
    const entry = tracked.get(pid)
    const rows = frames.map(frame => frame.rows.get(pid))
    const first = rows[0]
    if (visiting.has(pid) || !entry || !first || entry.absent || entry.imageEvidenceConflict || entry.closureIdentityUnverifiable
      || selectedSeen.has(pid) || inventory.changes.has(pid) || entry.causes.some(cause => cause.reason !== 'image-changed')
      || rows.some(row => !row || !completeForeignRow(row, installationRoot) || !sameNativeIdentity(first.identity, row.identity)
        || first.identity?.uid !== row.identity?.uid)) {
      proofs.set(pid, null)
      return null
    }
    visiting.add(pid)
    const parentPid = first.identity!.parentPid
    const ancestors = parentPid <= 1 ? [] : proveAncestry(parentPid, visiting)
    const proof = ancestors === null ? null : [metadata(first), ...ancestors]
    proofs.set(pid, proof)
    return proof
  }
  const transitions: VerifiedForeignImageTransition[] = []
  for (const [pid, entry] of tracked) {
    if (!entry.changed || !entry.causes.some(cause => cause.reason === 'image-changed')) {
      continue
    }
    const proof = proveAncestry(pid)
    if (!proof) {
      continue
    }
    for (let index = 1; index < frames.length; index++) {
      const from = frames[index - 1]!
      const to = frames[index]!
      const previous = from.rows.get(pid)!.images![0]!
      const current = to.rows.get(pid)!.images![0]!
      if (previous !== current) {
        transitions.push({
          process: inventory.gap(entry),
          from: { phase: from.phase, image: imageEvidence(previous, installationRoot) },
          to: { phase: to.phase, image: imageEvidence(current, installationRoot) },
          ancestry: proof.slice(1),
          proof: 'four-complete-native-foreign-frames',
        })
      }
    }
  }
  return transitions
}
