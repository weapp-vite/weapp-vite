import type { VerifiedAnchorForeignProcess } from '../types'
import type { NativeInventory } from './closure'
import type { NativeRow } from './model'
import { imageEvidence } from './evidence'
import { completeForeignConfirmation, completeForeignProofFrames, foreignAncestry, foreignPaths } from './foreignProof'
import { absoluteTicks, absoluteWithin, completePostAnchorRow, postAnchorBirth, sameCredentials } from './postAnchorBirth'

/** 枚举凭据可在逐行采样前改变；实际 RSS 读取两侧的身份、凭据与映像必须完整稳定。 */
function completeAnchorForeignBracket(row: NativeRow, installationRoot: string) {
  const { before, enumeratedIdentity, gaps, pathBefore, pathAfter } = row.entry
  const credentialsChanged = enumeratedIdentity.uid !== before.identity?.uid
  return completePostAnchorRow(row) && foreignPaths(row.entry, installationRoot)
    && pathBefore.executable === pathAfter.executable
    && (credentialsChanged ? gaps.length === 1 && gaps[0] === 'enumeration-identity-changed' : gaps.length === 0)
}

/** 只证明原锚点行的外来归属；三帧独立读取不替换锚点，也不清除任何变化历史。 */
export function verifiedAnchorForeignProcesses(inventory: NativeInventory, installationRoot: string): VerifiedAnchorForeignProcess[] {
  if (!completeForeignProofFrames(inventory)) {
    return []
  }
  const { frames, tracked, selectedSeen } = inventory
  const prepareEnd = absoluteTicks(frames[0]!.wire.absolute!.endedAtTicks)!
  const proofs: VerifiedAnchorForeignProcess[] = []
  for (const [pid, entry] of tracked) {
    if (entry.firstPhase !== 'anchor' || frames[0]!.rows.has(pid) || entry.absent || !entry.changed
      || selectedSeen.has(pid) || entry.textImageEvidenceConflict || entry.closureIdentityUnverifiable
      || !entry.causes.length || entry.causes.some(cause => !['enumeration-identity-changed', 'identity-changed', 'image-changed'].includes(cause.reason))) {
      continue
    }
    const change = inventory.changes.get(pid)
    if (!change || change.reasons.length !== 1 || change.reasons[0] !== 'credentials-changed'
      || change.boundary?.from.phase !== 'anchor' || change.boundary.from.position !== 'enumeration'
      || change.boundary.to.phase !== 'anchor' || change.boundary.to.position !== 'before') {
      continue
    }
    const rows = frames.slice(1).map(frame => frame.rows.get(pid))
    const first = rows[0]
    let birth: bigint | undefined
    let valid = Boolean(first)
    for (const [index, row] of rows.entries()) {
      if (!row || !first || !completeAnchorForeignBracket(row, installationRoot)
        || !sameCredentials(first.identity, row.identity)
        || !absoluteWithin(row.entry.absolute, frames[index + 1]!.wire.absolute)) {
        valid = false
        break
      }
      const value = postAnchorBirth(row.entry.absolute, prepareEnd, birth)
      const rowStart = absoluteTicks(row.entry.absolute?.startedAtTicks)
      if (value === null || rowStart === null || value > rowStart
        || (row.entry.confirmation && !completeForeignConfirmation(row, first.identity!, value, prepareEnd, frames[index + 1]!, installationRoot))) {
        valid = false
        break
      }
      birth = value
    }
    if (!valid || !first || birth === undefined) {
      continue
    }
    const ancestry = foreignAncestry(inventory, installationRoot, first.identity!.parentPid, 1, new Set([pid]), true)
    if (ancestry === null) {
      continue
    }
    proofs.push({
      process: inventory.gap(entry),
      proof: 'complete-anchor-foreign-brackets-after-preparation',
      clockDomain: 'mach-absolute-ticks',
      birthTicks: String(birth),
      prepareEndedAtTicks: String(prepareEnd),
      anchorRowStartedAtTicks: first.entry.absolute!.startedAtTicks,
      phases: ['anchor', 'closure1', 'closure2'],
      crossFrameGenerationStable: true,
      crossFrameBirthStable: true,
      crossFrameMainCredentialsStable: true,
      enumerationCredentialsChanged: true,
      ancestry,
      images: rows.map((row, index) => ({ phase: frames[index + 1]!.phase as 'anchor' | 'closure1' | 'closure2', image: imageEvidence(row!.entry.pathBefore.executable!, installationRoot) })),
      semantics: 'anchor-foreign-only; original-rss-anchor-and-history-preserved',
    })
  }
  return proofs
}
