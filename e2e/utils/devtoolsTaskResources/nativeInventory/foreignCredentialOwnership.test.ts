import type { DarwinProcessFrame } from '../processInventory/darwinInspector/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entry, fixtureForeign, fixtureSelected } from './fixture'
import { foreignCredentialFrames, foreignCredentialRows, summarizeForeignCredentialFrames } from './foreignCredentialFixture'
import { processAbsolute, setRowIdentity } from './postAnchorFixture'

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

function withParent(frames: DarwinProcessFrame[], parentPid: number) {
  for (const [index, frame] of frames.entries()) {
    const child = frame.rows.find(row => row.pid === 22)!
    for (const identity of [child.enumeratedIdentity, child.before.identity!, child.task.identity!, child.after.identity!]) {
      identity.parentPid = parentPid
    }
    if (parentPid === 33) {
      const parent = entry(33)
      parent.absolute = processAbsolute((index + 1) * 1000 + 200, '100')
      frame.rows.push(parent)
    }
  }
}

describe('foreign credential certificates preserve independent ownership and counting gates', () => {
  it.each([0, 501, 503])('accepts enumeration UID %s only through complete main UID evidence', (uid) => {
    const frames = foreignCredentialFrames()
    foreignCredentialRows(frames)[0]!.enumeratedIdentity.uid = uid
    expect(summarizeForeignCredentialFrames(frames).verifiedForeignCredentialProcessCount).toBe(1)
  })

  it('requires each foreign ancestor to carry independent UID, generation and birth evidence', () => {
    const frames = foreignCredentialFrames()
    withParent(frames, 33)
    expect(summarizeForeignCredentialFrames(frames)).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      verifiedForeignCredentialProcesses: [{ process: { pid: 22 }, ancestry: [{ pid: 33 }] }],
    })
  })

  it('rejects an ancestor when every original enumeration and main UID is missing', () => {
    const frames = foreignCredentialFrames()
    withParent(frames, 33)
    for (const frame of frames) {
      const parent = frame.rows.find(row => row.pid === 33)!
      for (const identity of [parent.enumeratedIdentity, parent.before.identity!, parent.task.identity!, parent.after.identity!]) {
        Reflect.deleteProperty(identity, 'uid')
      }
    }
    expect(summarizeForeignCredentialFrames(frames)).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      closureOwnership: { status: 'unavailable' },
      verifiedForeignCredentialProcesses: [],
    })
  })

  it.each(['unknown', 'selected', 'late', 'missing', 'uid', 'generation', 'birth', 'birth-missing', 'path', 'cycle'] as const)('rejects an independently %s ancestor', (kind) => {
    const frames = foreignCredentialFrames()
    withParent(frames, kind === 'unknown' ? 77 : kind === 'selected' ? 11 : 33)
    const parent = frames[3]!.rows.find(row => row.pid === 33)
    if (kind === 'late') {
      frames[0]!.rows = frames[0]!.rows.filter(row => row.pid !== 33)
    }
    else if (kind === 'missing') {
      frames[2]!.rows = frames[2]!.rows.filter(row => row.pid !== 33)
    }
    else if (kind === 'uid' || kind === 'generation') {
      setRowIdentity(parent!, kind === 'uid' ? { uid: 503 } : { startedMicroseconds: '654321' })
    }
    else if (kind === 'birth') {
      parent!.absolute!.birthBefore.birthTicks = parent!.absolute!.birthAfter.birthTicks = '101'
    }
    else if (kind === 'birth-missing') {
      Reflect.deleteProperty(parent!, 'absolute')
    }
    else if (kind === 'path') {
      parent!.pathBefore = { count: 0, errno: 1, executable: null }
    }
    else if (kind === 'cycle') {
      for (const frame of frames) {
        setRowIdentity(frame.rows.find(row => row.pid === 33)!, { parentPid: 22 })
      }
    }
    expect(summarizeForeignCredentialFrames(frames)).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      closureOwnership: { status: 'unavailable' },
      verifiedForeignCredentialProcesses: [],
    })
  })

  it('does not use another credential candidate as foreign ancestry', () => {
    const frames = foreignCredentialFrames()
    withParent(frames, 44)
    for (const frame of frames) {
      const parent = structuredClone(frame.rows.find(row => row.pid === 22)!)
      parent.pid = 44
      for (const identity of [parent.enumeratedIdentity, parent.before.identity!, parent.task.identity!, parent.after.identity!]) {
        identity.pid = 44
        identity.parentPid = 1
      }
      frame.rows.push(parent)
    }
    const report = summarizeForeignCredentialFrames(frames)
    expect(report.verifiedForeignCredentialProcesses!.map(proof => proof.process.pid)).toEqual([44])
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.identityChangedProcessCount).toBe(2)
  })

  it('retains selected ancestry after a later foreign path and reparenting', () => {
    const frames = foreignCredentialFrames()
    withParent(frames, 11)
    for (const row of foreignCredentialRows(frames).slice(1)) {
      setRowIdentity(row, { parentPid: 1 })
    }
    const report = summarizeForeignCredentialFrames(frames)
    expect(report.verifiedForeignCredentialProcesses).toEqual([])
    expect(report.missingIdentities.some(identity => identity.pid === 22)).toBe(true)
  })

  it('retains a directly selected historical image after all later images are foreign', () => {
    const frames = foreignCredentialFrames()
    const first = foreignCredentialRows(frames)[0]!
    first.pathBefore.executable = first.pathAfter.executable = fixtureSelected
    const report = summarizeForeignCredentialFrames(frames)
    expect(report.verifiedForeignCredentialProcesses).toEqual([])
    expect(report.missingIdentities.some(identity => identity.pid === 22)).toBe(true)
  })

  it('proves stable foreign images without requiring an incidental image transition', () => {
    const frames = foreignCredentialFrames()
    for (const row of foreignCredentialRows(frames)) {
      row.pathBefore = row.pathAfter = { count: fixtureForeign.length, errno: 0, executable: fixtureForeign }
    }
    expect(summarizeForeignCredentialFrames(frames)).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      verifiedForeignCredentialProcessCount: 1,
      verifiedForeignImageTransitionCount: 0,
      identityChangedProcessCount: 1,
    })
  })

  it.each([1, 2])('keeps the prior whole-frame birth boundary for first observation at index %s', (firstIndex) => {
    const frames = foreignCredentialFrames()
    frames.forEach((frame, index) => {
      if (index < firstIndex) {
        frame.rows = frame.rows.filter(row => row.pid !== 22)
      }
      else {
        const row = frame.rows.find(row => row.pid === 22)!
        row.absolute = processAbsolute((index + 1) * 1000 + 100, String(firstIndex * 1000 + 950))
        if (index === firstIndex) {
          row.enumeratedIdentity.uid = 501
          row.gaps = ['enumeration-identity-changed']
        }
      }
    })
    if (firstIndex === 2) {
      const final = frames[3]!.rows.find(row => row.pid === 22)!
      final.confirmation = {
        ...processAbsolute(4300, String(firstIndex * 1000 + 950)),
        before: structuredClone(final.before),
        after: structuredClone(final.after),
        pathBefore: { ...final.pathBefore },
        pathAfter: { ...final.pathAfter },
      }
    }
    const report = summarizeForeignCredentialFrames(frames)
    expect(report.verifiedForeignCredentialProcesses).toHaveLength(1)
    expect(report.verifiedForeignCredentialProcesses![0]!.previousFrameEndedAtTicks).toBe(String(firstIndex * 1000 + 900))
    for (const frame of frames.slice(firstIndex)) {
      const absolute = frame.rows.find(row => row.pid === 22)!.absolute!
      absolute.birthBefore.birthTicks = absolute.birthAfter.birthTicks = String(firstIndex * 1000 + 900)
    }
    expect(summarizeForeignCredentialFrames(frames).verifiedForeignCredentialProcesses).toEqual([])
  })

  it.each(['unknown', 'new-selected', 'budget'] as const)('retains the independent %s inventory gate after certifying a foreign process', (kind) => {
    const frames = foreignCredentialFrames()
    if (kind !== 'budget') {
      frames[3]!.rows.push(entry(44, kind === 'unknown' ? { executable: null, parentPid: 77 } : { parentPid: 11 }))
    }
    const report = summarizeForeignCredentialFrames(frames, { deadline: kind === 'budget' ? 0 : 10_000 })
    expect(report.verifiedForeignCredentialProcessCount).toBe(1)
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.closureOwnership.status).toBe('unavailable')
    expect(report.inventoryBudgetExhausted).toBe(kind === 'budget')
  })

  it('counts certificates by unique PID and never includes any foreign or non-anchor RSS', () => {
    const frames = foreignCredentialFrames()
    for (const frame of frames) {
      const another = structuredClone(frame.rows.find(row => row.pid === 22)!)
      another.pid = 44
      for (const identity of [another.enumeratedIdentity, another.before.identity!, another.task.identity!, another.after.identity!]) {
        identity.pid = 44
      }
      frame.rows.push(another)
    }
    const report = summarizeForeignCredentialFrames(frames)
    expect(report).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, verifiedForeignCredentialProcessCount: 2, identityChangedProcessCount: 2 })
    expect(report.processes.map(process => [process.pid, process.rssBytes])).toEqual([[11, 1000]])
  })

  it('keeps the selected RSS safe-integer sum gate after proving a separate foreign process', () => {
    const frames = foreignCredentialFrames()
    for (const frame of frames) {
      frame.rows.find(row => row.pid === 11)!.task.rssBytes = '9007199254740991'
      frame.rows.push(entry(55, { parentPid: 11, rssBytes: '1' }))
    }
    expect(() => summarizeForeignCredentialFrames(frames)).toThrow('safely')
  })
})
