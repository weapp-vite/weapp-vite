import type { ProcessIdentityMetadata, VerifiedTerminalProcess } from '../types'
import type { NativeInventory } from './closure'
import type { NativeFrame } from './model'
import { DARWIN_INSPECTOR_PHASES } from '../processInventory/darwinInspector/types'
import { completeNativeLiveRow, hasNativeExitEvidence, insideInstallation, metadata, sameNativeIdentity } from './model'

/** 准备帧中的外部活体及祖先均须完整核验；此证明不能提供锚点的映像或 RSS。 */
export function preparedForeignAncestry(inventory: NativeInventory, frame: NativeFrame, pid: number, installationRoot: string) {
  const ancestry: ProcessIdentityMetadata[] = []
  const visiting = new Set<number>()
  let current = pid
  do {
    const row = frame.rows.get(current)
    const tracked = inventory.tracked.get(current)
    if (!row || !tracked || visiting.has(current) || inventory.selectedSeen.has(current)
      || tracked.imageEvidenceConflict || tracked.textImageEvidenceConflict
      || !completeNativeLiveRow(row) || row.identityChanged || row.imageChanged || !row.identity || row.identity.zombie
      || row.identity.pid !== current || !sameNativeIdentity(row.identity, row.finalIdentity)
      || row.identity.uid !== row.finalIdentity?.uid || row.identity.uid !== row.entry.task.identity?.uid
      || !sameNativeIdentity(row.identity, row.entry.task.identity)
      || row.images!.some(image => insideInstallation(installationRoot, image))) {
      return null
    }
    visiting.add(current)
    if (current !== pid) {
      ancestry.push(metadata(row))
    }
    current = row.identity.parentPid
  } while (current > 1)
  return ancestry
}

/** 锚点查询已完整证明任务消失时保留独立退出证明，不回填准备帧数值或删除原始变化。 */
export function verifiedAnchorExits(inventory: NativeInventory, installationRoot: string): VerifiedTerminalProcess[] {
  const { frames, tracked, selectedSeen } = inventory
  if (frames.length !== DARWIN_INSPECTOR_PHASES.length || frames.some((frame, index) => frame.phase !== DARWIN_INSPECTOR_PHASES[index])) {
    return []
  }
  const prepare = frames[0]!
  const anchor = frames[1]!
  const proofs: VerifiedTerminalProcess[] = []
  for (const [pid, entry] of tracked) {
    const gone = anchor.rows.get(pid)
    if (entry.firstPhase !== 'prepare' || selectedSeen.has(pid) || !gone || !hasNativeExitEvidence(gone)
      || entry.causes.some(cause => !['identity-changed', 'kernel-identity-unverifiable', 'process-absent'].includes(cause.reason))
      || frames.slice(2).some((frame) => {
        const row = frame.rows.get(pid)
        return row && !hasNativeExitEvidence(row)
      })) {
      continue
    }
    const ancestry = preparedForeignAncestry(inventory, prepare, pid, installationRoot)
    if (ancestry === null) {
      continue
    }
    proofs.push({
      process: inventory.gap(entry),
      terminalIdentity: metadata(gone),
      firstTerminalPhase: 'anchor',
      proof: 'prepare-proven-foreign-then-anchor-exit',
      phases: frames.map(frame => frame.phase),
      ancestry,
      semantics: 'terminated-task-without-executable-or-rss; no-ownership-inference',
    })
  }
  return proofs
}
