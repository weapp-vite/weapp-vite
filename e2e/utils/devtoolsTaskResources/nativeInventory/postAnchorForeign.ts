import type { VerifiedPostAnchorForeignProcess } from '../types'
import type { NativeInventory } from './closure'
import { imageEvidence } from './evidence'
import { completeForeignConfirmation, completeForeignProofFrames, foreignAncestry, foreignPaths } from './foreignProof'
import { absoluteTicks, absoluteWithin, completePostAnchorRow, postAnchorBirth, sameCredentials } from './postAnchorBirth'

/** 出生严格晚于整个 RSS 锚点；最终独立确认只证明闭合归属，绝不补采 RSS。 */
export function verifiedPostAnchorForeignProcesses(inventory: NativeInventory, installationRoot: string): VerifiedPostAnchorForeignProcess[] {
  const { frames, tracked, selectedSeen } = inventory
  if (!completeForeignProofFrames(inventory)) {
    return []
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
    if (!valid || !first || birth === undefined || !final
      || !completeForeignConfirmation(final, first.identity!, birth, anchorEnd, frames[3]!, installationRoot)) {
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
