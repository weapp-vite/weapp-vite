import type { DarwinProcessFrame } from '../processInventory/darwinInspector/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNativeInventory } from './closure'
import { entry, fixtureInstallation, fixtureSelected } from './fixture'
import { normalizeNativeFrame } from './model'
import { postAnchorFrames, setRowIdentity } from './postAnchorFixture'
import { summarizeNativeInventory } from './summary'

function summarize(frames: DarwinProcessFrame[], textConflict = false) {
  const inventory = createNativeInventory(fixtureInstallation)
  for (const frame of frames) {
    inventory.observe(normalizeNativeFrame(frame))
  }
  if (textConflict) {
    inventory.observeTextImages(22, ['/System/Library/ConflictingForeign'], 'closure1')
  }
  return summarizeNativeInventory({ inventory, installationRoot: fixtureInstallation, samplingStartedAt: 'fixture', deadline: 10_000, textProofs: [], textObservations: [] })
}

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

describe('post-anchor foreign process requires birth and final independent native confirmation', () => {
  it.each([
    ['closure1', 1],
    ['closure2', 1],
    ['closure2', 33],
  ] as const)('proves a %s birth with foreign parent %s without changing RSS or original gaps', (firstPhase, parentPid) => {
    const frames = postAnchorFrames(firstPhase, parentPid)
    const original = structuredClone(frames)
    const report = summarize(frames)
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      closureOwnership: { status: 'observed', value: 'verified' },
      verifiedMemberRssBytes: 1000,
      verifiedNewForeignProcessCount: 1,
      identityChangedProcessCount: 1,
      identityChangedProcesses: [{ pid: 22, reasons: ['credentials-changed'] }],
      verifiedPostAnchorForeignProcessCount: 1,
      verifiedPostAnchorForeignProcesses: [{
        process: { pid: 22, causes: expect.arrayContaining([{ reason: 'enumeration-identity-changed', firstObserved: { round: 3, phase: 'closure2' } }, { reason: 'image-changed', firstObserved: { round: 3, phase: 'closure2' } }]) },
        birthTicks: '3001',
        anchorEndedAtTicks: '2900',
        clockDomain: 'mach-absolute-ticks',
        proof: 'mach-birth-after-entire-anchor-and-complete-foreign-confirmation',
        confirmationPhase: 'closure2',
        enumerationCredentialsChanged: true,
        ancestry: parentPid === 33 ? [{ pid: 33 }] : [],
      }],
    })
    expect(report.processes.map(process => process.pid)).toEqual([11])
    expect(report.nativeFrames!.at(-1)!.rows.find(row => row.pid === 22)).toMatchObject({
      credentials: { mainStable: true, enumerationMatchesMain: false },
      confirmation: { credentialsStable: true, absolute: { birthBefore: { birthTicks: '3001' } } },
      rss: { bytes: '99999' },
      gaps: ['enumeration-identity-changed', 'image-changed'],
    })
    expect(frames).toEqual(original)
    expect(JSON.stringify(report)).not.toContain('"uid"')
  })

  it.each([
    'legacy-wire',
    'legacy-row',
    'wrong-domain',
    'mach-reversed',
    'birth-at-anchor-end',
    'birth-before-anchor-end',
    'zero-birth',
    'different-birth',
    'exited',
    'rusage-denied',
    'birth-during-call',
    'row-outside-frame',
    'enumeration-start',
    'enumeration-parent',
    'enumeration-zombie',
    'main-uid',
    'task-uid',
    'main-start',
    'task-denied',
    'identity-error',
    'extra-gap',
    'no-confirmation',
    'confirmation-uid',
    'confirmation-start',
    'confirmation-error',
    'confirmation-image',
    'confirmation-overlap',
    'confirmation-outside-frame',
    'selected-before',
    'selected-after',
    'selected-confirmation',
    'unknown-parent',
    'selected-parent',
    'text-conflict',
    'prepare-seen',
    'anchor-seen',
  ] as const)('rejects %s while retaining all observations', (kind) => {
    const frames = postAnchorFrames('closure2', kind === 'unknown-parent' ? 77 : kind === 'selected-parent' ? 11 : 1)
    const row = frames[3]!.rows.find(row => row.pid === 22)!
    const confirmation = row.confirmation!
    if (kind === 'legacy-wire') {
      frames.forEach(frame => Reflect.deleteProperty(frame, 'absolute'))
    }
    else if (kind === 'legacy-row') {
      Reflect.deleteProperty(row, 'absolute')
    }
    else if (kind === 'wrong-domain') {
      Reflect.set(row.absolute!, 'clockDomain', 'monotonic-nanoseconds')
    }
    else if (kind === 'mach-reversed') {
      frames[2]!.absolute!.startedAtTicks = '2899'
    }
    else if (kind === 'birth-at-anchor-end' || kind === 'birth-before-anchor-end') {
      const value = kind === 'birth-at-anchor-end' ? '2900' : '2800'
      for (const absolute of [row.absolute!, confirmation]) {
        absolute.birthBefore.birthTicks = absolute.birthAfter.birthTicks = value
      }
    }
    else if (kind === 'zero-birth' || kind === 'different-birth' || kind === 'birth-during-call') {
      row.absolute!.birthBefore.birthTicks = kind === 'zero-birth' ? '0' : kind === 'different-birth' ? '3002' : '4102'
    }
    else if (kind === 'exited') {
      row.absolute!.birthAfter.exitTicks = '4150'
    }
    else if (kind === 'rusage-denied') {
      row.absolute!.birthBefore.result = -1
      row.absolute!.birthBefore.errno = 1
    }
    else if (kind === 'row-outside-frame') {
      row.absolute!.endedAtTicks = '5000'
    }
    else if (kind === 'enumeration-start' || kind === 'enumeration-parent' || kind === 'enumeration-zombie') {
      Object.assign(row.enumeratedIdentity, kind === 'enumeration-start' ? { startedMicroseconds: '654321' } : kind === 'enumeration-parent' ? { parentPid: 77 } : { zombie: true })
    }
    else if (kind === 'main-uid' || kind === 'task-uid' || kind === 'main-start') {
      Object.assign(row[kind === 'task-uid' ? 'task' : 'after'].identity!, kind === 'main-start' ? { startedMicroseconds: '654321' } : { uid: 503 })
    }
    else if (kind === 'task-denied') {
      row.task = { count: 0, errno: 1, identity: null, rssBytes: null }
    }
    else if (kind === 'identity-error') {
      row.before.result = -1
    }
    else if (kind === 'extra-gap') {
      row.gaps.push('rss-identity-mismatch')
    }
    else if (kind === 'no-confirmation') {
      row.confirmation = null
    }
    else if (kind === 'confirmation-uid' || kind === 'confirmation-start') {
      Object.assign(confirmation.after.identity!, kind === 'confirmation-uid' ? { uid: 503 } : { startedMicroseconds: '654321' })
    }
    else if (kind === 'confirmation-error') {
      confirmation.before.errno = 1
    }
    else if (kind === 'confirmation-image') {
      confirmation.pathAfter.executable = '/System/Library/AnotherForeign'
    }
    else if (kind === 'confirmation-overlap' || kind === 'confirmation-outside-frame') {
      if (kind === 'confirmation-overlap') {
        confirmation.startedAtTicks = '4189'
      }
      else {
        confirmation.endedAtTicks = '5000'
      }
    }
    else if (kind.startsWith('selected-') && kind !== 'selected-parent') {
      const path = kind === 'selected-confirmation' ? confirmation.pathBefore : kind === 'selected-before' ? row.pathBefore : row.pathAfter
      path.executable = fixtureSelected
    }
    else if (kind === 'prepare-seen' || kind === 'anchor-seen') {
      frames[kind === 'prepare-seen' ? 0 : 1]!.rows.push(entry(22))
    }
    const original = structuredClone(frames)
    const report = summarize(frames, kind === 'text-conflict')
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.closureOwnership.status).toBe('unavailable')
    expect(report.verifiedPostAnchorForeignProcesses).toEqual([])
    expect(report.identityChangedProcessCount).toBeGreaterThan(0)
    expect(frames).toEqual(original)
  })

  it.each(['absent-final', 'changed-generation-after-first-credential-gap', 'changed-birth', 'changed-uid'] as const)('rejects a closure1 process with %s', (kind) => {
    const frames = postAnchorFrames('closure1')
    const first = frames[2]!.rows.find(row => row.pid === 22)!
    const final = frames[3]!.rows.find(row => row.pid === 22)!
    first.enumeratedIdentity.uid = 501
    first.gaps = ['enumeration-identity-changed']
    if (kind === 'absent-final') {
      frames[3]!.rows = frames[3]!.rows.filter(row => row.pid !== 22)
    }
    else if (kind === 'changed-generation-after-first-credential-gap') {
      setRowIdentity(final, { startedMicroseconds: '654321' })
      final.confirmation!.before.identity!.startedMicroseconds = final.confirmation!.after.identity!.startedMicroseconds = '654321'
    }
    else if (kind === 'changed-birth') {
      final.absolute!.birthBefore.birthTicks = final.absolute!.birthAfter.birthTicks = '3002'
      final.confirmation!.birthBefore.birthTicks = final.confirmation!.birthAfter.birthTicks = '3002'
    }
    else {
      setRowIdentity(final, { uid: 503 })
      final.confirmation!.before.identity!.uid = final.confirmation!.after.identity!.uid = 503
    }
    const report = summarize(frames)
    expect(report.closureOwnership.status).toBe('unavailable')
    expect(report.verifiedPostAnchorForeignProcesses).toEqual([])
    expect(report.identityChangedProcesses[0]!.reasons).toEqual(['credentials-changed'])
  })

  it('keeps a closure1 credential transition blocked when the stable final row has no independent confirmation', () => {
    const frames = postAnchorFrames('closure1')
    const first = frames[2]!.rows.find(row => row.pid === 22)!
    first.enumeratedIdentity.uid = 501
    first.gaps = ['enumeration-identity-changed']
    const final = frames[3]!.rows.find(row => row.pid === 22)!
    final.enumeratedIdentity.uid = 502
    final.pathBefore = final.pathAfter = { ...first.pathAfter }
    final.gaps = []
    final.confirmation = null
    expect(summarize(frames)).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      closureOwnership: { status: 'unavailable' },
      verifiedPostAnchorForeignProcesses: [],
    })
  })
})
