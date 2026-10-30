import type { NativeSelectorAttachmentSnapshot } from './nativeSelectorAttachment'
import { expect } from 'vitest'
import { nativeSelectorAttachmentLeafIds } from './nativeSelectorAttachment'

export function assertNativeSelectorAttachment(
  snapshot: NativeSelectorAttachmentSnapshot,
  phases: Array<{ phase: string, open: boolean }>,
) {
  expect(phases.length).toBeGreaterThan(0)
  expect(phases[0]).toEqual({ phase: 'attached', open: false })
  expect(new Set(phases.map(item => item.phase)).size).toBe(phases.length)
  const sequence = ['attached']
  for (const [index, { phase }] of phases.entries()) {
    sequence.push(`${phase}:start`, `${phase}:end`)
    if (index === 0) {
      sequence.push('ready')
    }
    sequence.push(`${phase}:rect`, `${phase}:missing`, `${phase}:missingAll`, `${phase}:exec`)
  }
  const leaves = Object.fromEntries(nativeSelectorAttachmentLeafIds.map(id => [id, {
    label: id,
    sequence,
    queries: phases.map(({ phase, open }) => {
      const projected = open || id.startsWith('visible-')
      return {
        phase,
        rootFound: true,
        rootId: id,
        width: projected ? 40 : 0,
        height: projected ? 20 : 0,
        missing: null,
        missingAll: [],
      }
    }),
  }]))
  expect(snapshot).toEqual({ open: phases.at(-1)!.open, leaves })
}
