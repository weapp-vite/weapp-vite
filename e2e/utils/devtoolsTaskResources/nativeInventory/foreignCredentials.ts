import type { VerifiedForeignCredentialProcess } from '../types'
import type { NativeInventory } from './closure'
import type { ForeignBracketProver } from './foreignBrackets'
import { imageEvidence } from './evidence'
import { createForeignBracketProver } from './foreignBrackets'

/** 证书仅描述原主读取括号，不推断未读取的枚举映像或帧间执行历史。 */
export function verifiedForeignCredentialProcesses(inventory: NativeInventory, installationRoot: string, prove: ForeignBracketProver = createForeignBracketProver(inventory, installationRoot)): VerifiedForeignCredentialProcess[] {
  const results: VerifiedForeignCredentialProcess[] = []
  for (const [pid, entry] of inventory.tracked) {
    const proof = prove(pid, 'enumeration-credentials')
    if (!proof) {
      continue
    }
    const { firstIndex, rows, ancestry, birthTicks, previousFrameEndedAtTicks } = proof
    if (birthTicks === undefined || previousFrameEndedAtTicks === undefined) {
      continue
    }
    results.push({
      process: inventory.gap(entry),
      proof: 'complete-foreign-main-brackets-after-enumeration-credentials-change',
      clockDomain: 'mach-absolute-ticks',
      birthTicks: String(birthTicks),
      previousFrameEndedAtTicks: firstIndex === 0 ? null : String(previousFrameEndedAtTicks),
      phases: inventory.frames.slice(firstIndex).map(frame => frame.phase),
      enumerationChange: inventory.changes.get(pid)!.boundary!,
      crossFrameGenerationStable: true,
      crossFrameBirthStable: true,
      crossFrameMainCredentialsStable: true,
      ancestry,
      brackets: rows.map((row, index) => ({
        phase: inventory.frames[firstIndex + index]!.phase,
        startedAtTicks: row.entry.absolute!.startedAtTicks,
        endedAtTicks: row.entry.absolute!.endedAtTicks,
        image: imageEvidence(row.entry.pathBefore.executable!, installationRoot),
      })),
      semantics: 'foreign-main-brackets-only; enumeration-image-unobserved; original-rss-anchor-and-history-preserved',
    })
  }
  return results
}
