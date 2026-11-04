import type { DarwinProcessFrame } from '../processInventory/darwinInspector/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtureSelected } from './fixture'
import { foreignCredentialFrames, summarizeForeignCredentialFrames } from './foreignCredentialFixture'
import { processAbsolute } from './postAnchorFixture'

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

function twoMainFrames(confirmation: boolean): DarwinProcessFrame[] {
  const frames = foreignCredentialFrames()
  frames.forEach((frame, index) => {
    if (index < 2) {
      frame.rows = frame.rows.filter(row => row.pid !== 22)
      return
    }
    const row = frame.rows.find(row => row.pid === 22)!
    row.absolute = processAbsolute((index + 1) * 1000 + 100, '2950')
    if (index === 2) {
      row.enumeratedIdentity.uid = 501
      row.gaps = ['enumeration-identity-changed']
    }
  })
  if (confirmation) {
    const final = frames[3]!.rows.find(row => row.pid === 22)!
    final.confirmation = {
      ...processAbsolute(4300, '2950'),
      before: structuredClone(final.before),
      after: structuredClone(final.after),
      pathBefore: { ...final.pathBefore },
      pathAfter: { ...final.pathAfter },
    }
  }
  return frames
}

describe('two observed main brackets require independent final confirmation', () => {
  it('keeps two complete main brackets blocked without independent final confirmation', () => {
    expect(summarizeForeignCredentialFrames(twoMainFrames(false))).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      closureOwnership: { status: 'unavailable' },
      verifiedForeignCredentialProcesses: [],
    })
  })

  it('accepts the same two main brackets with complete original final confirmation', () => {
    const frames = twoMainFrames(true)
    const original = structuredClone(frames)
    expect(summarizeForeignCredentialFrames(frames)).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      closureOwnership: { status: 'observed', value: 'verified' },
      verifiedForeignCredentialProcessCount: 1,
      verifiedForeignCredentialProcesses: [{ phases: ['closure1', 'closure2'], birthTicks: '2950', previousFrameEndedAtTicks: '2900' }],
      identityChangedProcessCount: 1,
    })
    expect(frames).toEqual(original)
  })

  it.each(['identity-error', 'uid', 'birth', 'exited', 'selected', 'path-error', 'overlap', 'outside-frame', 'earlier-row-only'] as const)('rejects %s independent confirmation without borrowing main-bracket success', (kind) => {
    const frames = twoMainFrames(true)
    const final = frames[3]!.rows.find(row => row.pid === 22)!
    const confirmation = final.confirmation!
    if (kind === 'identity-error') {
      confirmation.before.result = -1
    }
    else if (kind === 'uid') {
      confirmation.after.identity!.uid = 503
    }
    else if (kind === 'birth') {
      confirmation.birthAfter.birthTicks = '2951'
    }
    else if (kind === 'exited') {
      confirmation.birthAfter.exitTicks = '4350'
    }
    else if (kind === 'selected') {
      confirmation.pathAfter.executable = fixtureSelected
    }
    else if (kind === 'path-error') {
      confirmation.pathBefore.errno = 1
    }
    else if (kind === 'overlap') {
      confirmation.startedAtTicks = '4189'
    }
    else if (kind === 'outside-frame') {
      confirmation.endedAtTicks = '5000'
    }
    else {
      const earlier = frames[2]!.rows.find(row => row.pid === 22)!
      earlier.confirmation = { ...confirmation, ...processAbsolute(3300, '2950') }
      final.confirmation = null
    }
    expect(summarizeForeignCredentialFrames(frames)).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      closureOwnership: { status: 'unavailable' },
      verifiedForeignCredentialProcesses: [],
    })
  })
})
