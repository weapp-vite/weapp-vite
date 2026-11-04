import type { VerifiedForeignImageTransition } from '../types'
import type { NativeInventory } from './closure'
import type { ForeignBracketProver } from './foreignBrackets'
import { imageEvidence } from './evidence'
import { createForeignBracketProver } from './foreignBrackets'

/** 从共用的旧模式证明投影实际映像转换，保留跨帧凭据变化的原契约。 */
export function verifiedForeignImageTransitions(inventory: NativeInventory, installationRoot: string, prove: ForeignBracketProver = createForeignBracketProver(inventory, installationRoot)): VerifiedForeignImageTransition[] {
  const { frames, tracked } = inventory
  const transitions: VerifiedForeignImageTransition[] = []
  for (const [pid, entry] of tracked) {
    if (!entry.changed || !entry.causes.some(cause => cause.reason === 'image-changed')) {
      continue
    }
    const proof = prove(pid, 'image-transition')
    if (!proof) {
      continue
    }
    const { firstIndex, ancestry, rows } = proof
    for (let index = 1; index < rows.length; index++) {
      const previous = rows[index - 1]!.images![0]!
      const current = rows[index]!.images![0]!
      if (previous !== current) {
        transitions.push({
          process: inventory.gap(entry),
          from: { phase: frames[firstIndex + index - 1]!.phase, image: imageEvidence(previous, installationRoot) },
          to: { phase: frames[firstIndex + index]!.phase, image: imageEvidence(current, installationRoot) },
          ancestry,
          proof: firstIndex === 0 ? 'four-complete-native-foreign-frames' : 'complete-native-foreign-frames-since-first-observation',
          phases: frames.slice(firstIndex).map(frame => frame.phase),
        })
      }
    }
  }
  return transitions
}
