import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { anchorForeignConfirmation, anchorForeignFrames, anchorForeignRows, summarizeAnchorForeignFrames } from './anchorForeignFixture'
import { entry, fixtureForeign, fixtureSelected } from './fixture'
import { setRowIdentity } from './postAnchorFixture'

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

describe('anchor foreign proof preserves cross-frame continuity and independent ancestry', () => {
  it.each([
    ['uid', false],
    ['uid', true],
    ['generation', false],
    ['generation', true],
    ['birth', false],
    ['birth', true],
  ] as const)('rejects internally consistent final %s drift with optional confirmation %s', (kind, confirmation) => {
    const frames = anchorForeignFrames()
    const final = anchorForeignRows(frames)[2]!
    if (confirmation) {
      anchorForeignConfirmation(final)
    }
    if (kind === 'birth') {
      for (const absolute of [final.absolute!, ...(final.confirmation ? [final.confirmation] : [])]) {
        absolute.birthBefore.birthTicks = absolute.birthAfter.birthTicks = '1951'
      }
    }
    else {
      const updates = kind === 'uid' ? { uid: 503 } : { startedMicroseconds: '654321' }
      setRowIdentity(final, updates)
      if (final.confirmation) {
        Object.assign(final.confirmation.before.identity!, updates)
        Object.assign(final.confirmation.after.identity!, updates)
      }
    }
    const report = summarizeAnchorForeignFrames(frames)
    expect(report).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      closureOwnership: { status: 'unavailable' },
      verifiedAnchorForeignProcesses: [],
      identityChangedProcesses: [{ pid: 22, reasons: ['credentials-changed'] }],
    })
    expect(report.nativeFrames!.at(-1)!.rows.find(row => row.pid === 22)!.credentials.mainStable).toBe(true)
    if (confirmation) {
      expect(report.nativeFrames!.at(-1)!.rows.find(row => row.pid === 22)!.confirmation!.credentialsStable).toBe(true)
    }
  })

  it.each(['anchor', 'closure1', 'closure2'] as const)('rejects the anchor certificate after absence at %s', (phase) => {
    const frames = anchorForeignFrames()
    const frame = frames.find(frame => frame.phase === phase)!
    frame.rows = frame.rows.filter(row => row.pid !== 22)
    const report = summarizeAnchorForeignFrames(frames)
    expect(report.verifiedAnchorForeignProcesses).toEqual([])
    if (phase !== 'anchor') {
      expect(report.installationRssBytes.status).toBe('unavailable')
      expect(report.closureOwnership.status).toBe('unavailable')
    }
  })

  it.each(['unknown', 'selected', 'changed', 'missing-birth', 'birth-drift', 'birth-exited', 'birth-outside-frame'] as const)('rejects %s ancestor evidence independently', (kind) => {
    const frames = anchorForeignFrames(kind === 'unknown' ? 77 : kind === 'selected' ? 11 : 33)
    const parent = frames[3]!.rows.find(row => row.pid === 33)
    if (kind === 'changed') {
      setRowIdentity(parent!, { uid: 503 })
    }
    else if (kind === 'missing-birth') {
      Reflect.deleteProperty(parent!, 'absolute')
    }
    else if (kind === 'birth-drift') {
      parent!.absolute!.birthBefore.birthTicks = parent!.absolute!.birthAfter.birthTicks = '501'
    }
    else if (kind === 'birth-exited') {
      parent!.absolute!.birthAfter.exitTicks = '4150'
    }
    else if (kind === 'birth-outside-frame') {
      parent!.absolute!.endedAtTicks = '5000'
    }
    expect(summarizeAnchorForeignFrames(frames)).toMatchObject({ installationRssBytes: { status: 'unavailable' }, closureOwnership: { status: 'unavailable' }, verifiedAnchorForeignProcesses: [] })
  })

  it('does not let a separately certified candidate provide ancestry for another candidate', () => {
    const frames = anchorForeignFrames(44)
    for (const frame of frames.slice(1)) {
      const parent = structuredClone(frame.rows.find(row => row.pid === 22)!)
      parent.pid = 44
      setRowIdentity(parent, { pid: 44, parentPid: 1 })
      if (frame.phase === 'anchor') {
        parent.enumeratedIdentity.uid = 501
      }
      frame.rows.push(parent)
    }
    const report = summarizeAnchorForeignFrames(frames)
    expect(report.verifiedAnchorForeignProcesses!.map(proof => proof.process.pid)).toEqual([44])
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.closureOwnership.status).toBe('unavailable')
  })

  it('retains unrelated unknown closure ownership even when the anchor candidate is certified', () => {
    const frames = anchorForeignFrames()
    frames[3]!.rows.push(entry(44, { executable: null, parentPid: 77 }))
    expect(summarizeAnchorForeignFrames(frames)).toMatchObject({
      verifiedAnchorForeignProcessCount: 1,
      installationRssBytes: { status: 'unavailable' },
      closureOwnership: { status: 'unavailable' },
      uninspectedNewProcessCount: 1,
    })
  })

  it('rejects a selected historical image even after all later raw paths are foreign', () => {
    const frames = anchorForeignFrames()
    const [anchor] = anchorForeignRows(frames)
    anchor!.pathBefore = anchor!.pathAfter = { count: fixtureSelected.length, errno: 0, executable: fixtureSelected }
    const report = summarizeAnchorForeignFrames(frames)
    expect(report.verifiedAnchorForeignProcesses).toEqual([])
    expect(report.missingIdentities.some(identity => identity.pid === 22)).toBe(true)
    expect(report.nativeFrames!.at(-1)!.rows.find(row => row.pid === 22)!.pathAfter.image!.scope).toBe('outside-installation')
    expect(JSON.stringify(report)).not.toContain(fixtureForeign)
  })
})
