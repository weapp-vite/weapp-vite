import type { ProcessIdentityMetadata, VerifiedTerminalProcess } from '../types'
import type { NativeInventory } from './closure'
import { DARWIN_INSPECTOR_PHASES } from '../processInventory/darwinInspector/types'
import { preparedForeignAncestry } from './anchorExits'
import { nativeRelation } from './closure'
import { completeNativeLiveRow, hasNativeExitEvidence, metadata, sameNativeIdentity } from './model'
import { sameInstance, terminalRow } from './terminalEvidence'

/** 锚点前终止的独立证明仍要求全部已核验祖先在后续帧保持完整外部活体身份。 */
function stableForeignAncestry(inventory: NativeInventory, ancestry: ProcessIdentityMetadata[], installationRoot: string) {
  for (const ancestor of ancestry) {
    const first = inventory.frames[0]!.rows.get(ancestor.pid)!
    for (const frame of inventory.frames.slice(1)) {
      const row = frame.rows.get(ancestor.pid)
      if (!row || row.identityChanged || row.imageChanged || !completeNativeLiveRow(row)
        || !sameNativeIdentity(first.identity, row.identity) || !sameNativeIdentity(row.identity, row.finalIdentity)
        || first.identity?.uid !== row.identity?.uid || first.images?.[0] !== row.images?.[0]
        || nativeRelation(frame, row, installationRoot) !== 'foreign') {
        return false
      }
    }
  }
  return true
}

/** 准备活体在锚点已由内核证明终止；不回填准备 RSS，也不推导资源所有权。 */
export function verifiedAnchorTerminals(inventory: NativeInventory, installationRoot: string): VerifiedTerminalProcess[] {
  const { frames, tracked, selectedSeen } = inventory
  if (frames.length !== DARWIN_INSPECTOR_PHASES.length || frames.some((frame, index) => frame.phase !== DARWIN_INSPECTOR_PHASES[index])) {
    return []
  }
  const prepare = frames[0]!
  const anchor = frames[1]!
  const proofs: VerifiedTerminalProcess[] = []
  for (const [pid, entry] of tracked) {
    const first = prepare.rows.get(pid)
    const terminal = anchor.rows.get(pid)
    if (entry.firstPhase !== 'prepare' || selectedSeen.has(pid) || entry.imageEvidenceConflict || entry.textImageEvidenceConflict
      || !first || !terminal || !terminalRow(terminal) || !sameInstance(first.identity, terminal.identity)
      || entry.causes.some(cause => !['identity-changed', 'zombie', 'kernel-identity-unverifiable', 'process-absent'].includes(cause.reason))) {
      continue
    }
    const ancestry = preparedForeignAncestry(inventory, prepare, pid, installationRoot)
    if (ancestry === null || !stableForeignAncestry(inventory, ancestry, installationRoot)) {
      continue
    }
    let absent = false
    let valid = true
    for (const frame of frames.slice(2)) {
      const row = frame.rows.get(pid)
      if (!row || hasNativeExitEvidence(row)) {
        absent = true
      }
      else if (absent || !terminalRow(row) || !sameInstance(first.identity, row.identity)) {
        valid = false
      }
    }
    if (valid) {
      proofs.push({
        process: inventory.gap(entry),
        terminalIdentity: metadata(terminal),
        firstTerminalPhase: 'anchor',
        proof: 'prepare-proven-foreign-then-anchor-kernel-terminal',
        phases: frames.map(frame => frame.phase),
        ancestry,
        semantics: 'terminated-task-without-executable-or-rss; no-ownership-inference',
      })
    }
  }
  return proofs
}
