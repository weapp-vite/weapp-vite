import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { anchorForeignConfirmation, anchorForeignFrames, anchorForeignRows, summarizeAnchorForeignFrames } from './anchorForeignFixture'
import { entry, fixtureForeign, fixtureSelected } from './fixture'
import { normalizeNativeFrame } from './model'

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

describe('original anchor foreign brackets after complete preparation', () => {
  it.each([1, 33])('proves foreign ancestry %s without restoring normalized RSS or changing history', (parentPid) => {
    const frames = anchorForeignFrames(parentPid)
    const original = structuredClone(frames)
    const normalized = normalizeNativeFrame(frames[1]!).rows.get(22)!
    expect(normalized).toMatchObject({ images: null, rssBytes: null, identityChanged: true })
    const report = summarizeAnchorForeignFrames(frames)
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      closureOwnership: { status: 'observed', value: 'verified' },
      verifiedMemberRssBytes: 1000,
      verifiedAnchorForeignProcessCount: 1,
      verifiedNewForeignProcessCount: 1,
      identityChangedProcessCount: 1,
      identityChangedProcesses: [{ pid: 22, reasons: ['credentials-changed'] }],
      verifiedAnchorForeignProcesses: [{
        process: { pid: 22, causes: expect.arrayContaining([
          { reason: 'enumeration-identity-changed', firstObserved: { round: 1, phase: 'anchor' } },
          { reason: 'image-changed', firstObserved: { round: 2, phase: 'closure1' } },
        ]) },
        proof: 'complete-anchor-foreign-brackets-after-preparation',
        birthTicks: '1950',
        prepareEndedAtTicks: '1900',
        anchorRowStartedAtTicks: '2100',
        phases: ['anchor', 'closure1', 'closure2'],
        crossFrameGenerationStable: true,
        crossFrameBirthStable: true,
        crossFrameMainCredentialsStable: true,
        enumerationCredentialsChanged: true,
        ancestry: parentPid === 33 ? [{ pid: 33 }] : [],
        semantics: 'anchor-foreign-only; original-rss-anchor-and-history-preserved',
      }],
    })
    const proof = report.verifiedAnchorForeignProcesses![0]!
    expect(proof.images[0]!.image.sha256).not.toBe(proof.images[1]!.image.sha256)
    expect(proof.images[1]!.image).toEqual(proof.images[2]!.image)
    expect(report.processes.map(process => [process.pid, process.rssBytes])).toEqual([[11, 1000]])
    expect(report.nativeFrames!.slice(1).map(frame => frame.rows.find(row => row.pid === 22)!.confirmation)).toEqual([null, null, null])
    expect(report.atomicity).toBe('non-atomic-sysctl-identity-and-image-brackets; observed-continuity-does-not-prove-no-unobserved-exec')
    expect(frames).toEqual(original)
    expect(JSON.stringify(report)).not.toContain('"uid"')
  })

  it('validates an optional confirmation while retaining the same original anchor', () => {
    const frames = anchorForeignFrames()
    anchorForeignConfirmation(anchorForeignRows(frames)[2]!)
    expect(summarizeAnchorForeignFrames(frames)).toMatchObject({ verifiedAnchorForeignProcessCount: 1, installationRssBytes: { status: 'observed', value: 1000 } })
  })

  it.each([
    'legacy-wire',
    'legacy-row',
    'wrong-domain',
    'frame-overlap',
    'row-outside-frame',
    'birth-at-prepare-end',
    'birth-before-prepare-end',
    'birth-after-row-start',
    'zero-birth',
    'birth-read-mismatch',
    'birth-exited',
    'birth-denied',
    'enumeration-start',
    'enumeration-parent',
    'enumeration-zombie',
    'main-uid',
    'task-uid',
    'main-start',
    'task-denied',
    'identity-error',
    'extra-gap',
    'missing-enumeration-gap',
    'path-denied',
    'path-count-zero',
    'path-mismatch',
    'selected-before',
    'selected-after',
    'selected-confirmation',
    'confirmation-error',
    'confirmation-overlap',
    'confirmation-outside',
    'confirmation-uid',
    'confirmation-birth',
    'prepare-seen',
    'text-conflict',
  ] as const)('rejects %s without replacing the failed anchor', (kind) => {
    const frames = anchorForeignFrames()
    const rows = anchorForeignRows(frames)
    const anchor = rows[0]!
    const final = rows[2]!
    anchorForeignConfirmation(final)
    const confirmation = final.confirmation!
    if (kind === 'legacy-wire') {
      frames.forEach(frame => Reflect.deleteProperty(frame, 'absolute'))
    }
    else if (kind === 'legacy-row') {
      Reflect.deleteProperty(anchor, 'absolute')
    }
    else if (kind === 'wrong-domain') {
      Reflect.set(anchor.absolute!, 'clockDomain', 'monotonic-nanoseconds')
    }
    else if (kind === 'frame-overlap') {
      frames[1]!.absolute!.startedAtTicks = '1899'
    }
    else if (kind === 'row-outside-frame') {
      anchor.absolute!.endedAtTicks = '3000'
    }
    else if (kind === 'birth-at-prepare-end' || kind === 'birth-before-prepare-end' || kind === 'birth-after-row-start' || kind === 'zero-birth') {
      const birth = kind === 'zero-birth' ? '0' : kind === 'birth-at-prepare-end' ? '1900' : kind === 'birth-before-prepare-end' ? '1800' : '2101'
      for (const absolute of [...rows.map(row => row.absolute!), confirmation]) {
        absolute.birthBefore.birthTicks = absolute.birthAfter.birthTicks = birth
      }
    }
    else if (kind === 'birth-read-mismatch') {
      anchor.absolute!.birthAfter.birthTicks = '1951'
    }
    else if (kind === 'birth-exited') {
      anchor.absolute!.birthAfter.exitTicks = '2150'
    }
    else if (kind === 'birth-denied') {
      anchor.absolute!.birthBefore.result = -1
      anchor.absolute!.birthBefore.errno = 1
    }
    else if (kind === 'enumeration-start' || kind === 'enumeration-parent' || kind === 'enumeration-zombie') {
      Object.assign(anchor.enumeratedIdentity, kind === 'enumeration-start' ? { startedMicroseconds: '654321' } : kind === 'enumeration-parent' ? { parentPid: 77 } : { zombie: true })
    }
    else if (kind === 'main-uid' || kind === 'task-uid' || kind === 'main-start') {
      Object.assign(anchor[kind === 'task-uid' ? 'task' : 'after'].identity!, kind === 'main-start' ? { startedMicroseconds: '654321' } : { uid: 503 })
    }
    else if (kind === 'task-denied') {
      anchor.task = { count: 0, errno: 1, identity: null, rssBytes: null }
    }
    else if (kind === 'identity-error') {
      anchor.before.result = -1
    }
    else if (kind === 'extra-gap') {
      anchor.gaps.push('rss-identity-mismatch')
    }
    else if (kind === 'missing-enumeration-gap') {
      anchor.gaps = []
    }
    else if (kind === 'path-denied' || kind === 'path-count-zero') {
      anchor.pathBefore = { count: 0, errno: kind === 'path-denied' ? 1 : 0, executable: fixtureForeign }
    }
    else if (kind === 'path-mismatch') {
      anchor.pathAfter = { count: fixtureForeign.length, errno: 0, executable: fixtureForeign }
    }
    else if (kind === 'selected-before' || kind === 'selected-after' || kind === 'selected-confirmation') {
      const read = kind === 'selected-confirmation' ? confirmation.pathBefore : kind === 'selected-before' ? anchor.pathBefore : anchor.pathAfter
      read.executable = fixtureSelected
    }
    else if (kind === 'confirmation-error') {
      confirmation.before.errno = 1
    }
    else if (kind === 'confirmation-overlap' || kind === 'confirmation-outside') {
      if (kind === 'confirmation-overlap') {
        confirmation.startedAtTicks = '4189'
      }
      else {
        confirmation.endedAtTicks = '5000'
      }
    }
    else if (kind === 'confirmation-uid') {
      confirmation.after.identity!.uid = 503
    }
    else if (kind === 'confirmation-birth') {
      confirmation.birthBefore.birthTicks = confirmation.birthAfter.birthTicks = '1951'
    }
    else if (kind === 'prepare-seen') {
      frames[0]!.rows.push(entry(22))
    }
    const original = structuredClone(frames)
    const report = summarizeAnchorForeignFrames(frames, kind === 'text-conflict')
    expect(report).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      closureOwnership: { status: 'unavailable' },
      verifiedAnchorForeignProcessCount: 0,
      verifiedAnchorForeignProcesses: [],
    })
    expect(report.identityChangedProcessCount).toBeGreaterThan(0)
    expect(frames).toEqual(original)
  })
})
