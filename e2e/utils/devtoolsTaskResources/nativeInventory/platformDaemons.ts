import type { VerifiedPlatformDaemonProcess } from '../types'
import type { NativeInventory } from './closure'
import { DARWIN_INSPECTOR_PHASES } from '../processInventory/darwinInspector/types'
import { imageEvidence } from './evidence'
import { foreignPaths } from './foreignProof'
import { sameNativeIdentity, validNativeImage } from './model'

/** 仅接受闭合阶段首次出现、由 launchd 托管且资源查询明确被拒绝的平台守护进程。 */
export function verifiedPlatformDaemonProcesses(inventory: NativeInventory, installationRoot: string): VerifiedPlatformDaemonProcess[] {
  const { frames, tracked, selectedSeen, changes } = inventory
  if (frames.length !== DARWIN_INSPECTOR_PHASES.length || frames.some((frame, index) => frame.phase !== DARWIN_INSPECTOR_PHASES[index])) {
    return []
  }
  const proofs: VerifiedPlatformDaemonProcess[] = []
  for (const [pid, entry] of tracked) {
    if ((entry.firstPhase !== 'closure1' && entry.firstPhase !== 'closure2') || entry.absent || !entry.changed
      || selectedSeen.has(pid) || entry.imageEvidenceConflict || entry.textImageEvidenceConflict
      || entry.closureIdentityUnverifiable || entry.causes.some(cause => cause.reason !== 'enumeration-identity-changed')) {
      continue
    }
    const change = changes.get(pid)
    if (!change || change.reasons.length !== 1 || change.reasons[0] !== 'credentials-changed'
      || change.boundary?.from.phase !== entry.firstPhase || change.boundary.from.position !== 'enumeration'
      || change.boundary.to.phase !== entry.firstPhase || change.boundary.to.position !== 'before') {
      continue
    }
    const firstIndex = frames.findIndex(frame => frame.phase === entry.firstPhase)
    const rows = frames.slice(firstIndex).map(frame => frame.rows.get(pid))
    const first = rows[0]
    if (!first || first.identity?.parentPid !== 1) {
      continue
    }
    let valid = true
    for (const row of rows) {
      const task = row?.entry.task
      const absolute = row?.entry.absolute
      if (!row || row.identityChanged || row.imageChanged || !row.identity || !row.finalIdentity
        || !sameNativeIdentity(first.identity, row.identity) || !sameNativeIdentity(row.identity, row.finalIdentity)
        || !sameNativeIdentity(row.entry.enumeratedIdentity, row.identity) || row.identity.parentPid !== 1
        || !foreignPaths(row.entry, installationRoot) || !validNativeImage(row.entry.pathBefore.executable)
        || row.entry.pathBefore.executable !== row.entry.pathAfter.executable
        || row.entry.gaps.length !== 2 || !row.entry.gaps.includes('enumeration-identity-changed') || !row.entry.gaps.includes('rss-unavailable')
        || !task || task.count !== 0 || task.errno !== 1 || task.identity !== null || task.rssBytes !== null
        || !absolute || absolute.birthBefore.result !== -1 || absolute.birthBefore.errno !== 1 || absolute.birthBefore.birthTicks !== null || absolute.birthBefore.exitTicks !== null
        || absolute.birthAfter.result !== -1 || absolute.birthAfter.errno !== 1 || absolute.birthAfter.birthTicks !== null || absolute.birthAfter.exitTicks !== null) {
        valid = false
        break
      }
    }
    if (!valid) {
      continue
    }
    const final = rows.at(-1)!
    proofs.push({
      process: inventory.gap(entry),
      proof: 'stable-closure-platform-daemon-with-denied-resource-reads',
      phases: frames.slice(firstIndex).map(frame => frame.phase as 'closure1' | 'closure2'),
      image: imageEvidence(final.entry.pathAfter.executable!, installationRoot),
      deniedReads: 'task-rss-and-birth',
      semantics: 'closure-ownership-only; no-preparation-or-closure-rss-counted',
    })
  }
  return proofs
}
