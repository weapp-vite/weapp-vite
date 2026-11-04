import type { DarwinProcessEntry, DarwinProcessFrame } from '../processInventory/darwinInspector/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNativeInventory } from './closure'
import { fixtureForeign, fixtureInstallation, fixtureSelected } from './fixture'
import { createForeignBracketProver } from './foreignBrackets'
import { foreignCredentialFrames, foreignCredentialRows, summarizeForeignCredentialFrames } from './foreignCredentialFixture'
import { normalizeNativeFrame } from './model'
import { processAbsolute, setRowIdentity } from './postAnchorFixture'
import { summarizeNativeInventory } from './summary'

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

type Mutation = (frames: DarwinProcessFrame[], rows: DarwinProcessEntry[]) => void

const mutations: Record<string, Mutation> = {
  'enumeration-pid': (_frames, rows) => { rows[0]!.enumeratedIdentity.pid = 23 },
  'enumeration-start': (_frames, rows) => { rows[0]!.enumeratedIdentity.startedMicroseconds = '654321' },
  'enumeration-parent': (_frames, rows) => { rows[0]!.enumeratedIdentity.parentPid = 77 },
  'enumeration-zombie': (_frames, rows) => { rows[0]!.enumeratedIdentity.zombie = true },
  'enumeration-to-task': (_frames, rows) => {
    rows[0]!.enumeratedIdentity.uid = 502
    rows[0]!.task.identity!.uid = 503
  },
  'enumeration-to-after': (_frames, rows) => {
    rows[0]!.enumeratedIdentity.uid = 502
    rows[0]!.after.identity!.uid = 503
  },
  'main-uid': (_frames, rows) => { rows[0]!.after.identity!.uid = 503 },
  'task-uid': (_frames, rows) => { rows[0]!.task.identity!.uid = 503 },
  'cross-frame-main-uid': (_frames, rows) => { setRowIdentity(rows[2]!, { uid: 503 }) },
  'repeated-enumeration-uid': (_frames, rows) => {
    rows[2]!.enumeratedIdentity.uid = 501
    rows[2]!.gaps = ['enumeration-identity-changed']
  },
  'later-generation': (_frames, rows) => { setRowIdentity(rows[2]!, { startedMicroseconds: '654321' }) },
  'redacted-main-uids': (_frames, rows) => {
    rows.forEach((row, index) => {
      for (const identity of [row.before.identity!, row.task.identity!, row.after.identity!, ...(index ? [row.enumeratedIdentity] : [])]) {
        Reflect.deleteProperty(identity, 'uid')
      }
    })
  },
  'later-parent': (_frames, rows) => { setRowIdentity(rows[2]!, { parentPid: 77 }) },
  'missing-enumeration-gap': (_frames, rows) => { rows[0]!.gaps = [] },
  'extra-gap': (_frames, rows) => { rows[0]!.gaps.push('rss-unavailable') },
  'identity-read-error': (_frames, rows) => { rows[0]!.before.result = -1 },
  'identity-read-empty': (_frames, rows) => { rows[0]!.after.length = 0 },
  'task-denied': (_frames, rows) => { rows[0]!.task = { count: 0, errno: 1, identity: null, rssBytes: null } },
  'task-unsafe-rss': (_frames, rows) => { rows[0]!.task.rssBytes = '9007199254740992' },
  'birth-missing': (_frames, rows) => { Reflect.deleteProperty(rows[0]!, 'absolute') },
  'birth-zero': (_frames, rows) => { rows[0]!.absolute!.birthBefore.birthTicks = rows[0]!.absolute!.birthAfter.birthTicks = '0' },
  'birth-read-mismatch': (_frames, rows) => { rows[0]!.absolute!.birthAfter.birthTicks = '501' },
  'birth-cross-frame-drift': (_frames, rows) => { rows[2]!.absolute!.birthBefore.birthTicks = rows[2]!.absolute!.birthAfter.birthTicks = '501' },
  'birth-future': (_frames, rows) => { rows[0]!.absolute!.birthBefore.birthTicks = rows[0]!.absolute!.birthAfter.birthTicks = '1101' },
  'birth-denied': (_frames, rows) => { rows[0]!.absolute!.birthBefore.result = -1 },
  'birth-exited': (_frames, rows) => { rows[0]!.absolute!.birthAfter.exitTicks = '1150' },
  'birth-reversed': (_frames, rows) => { rows[0]!.absolute!.birthAfter.startedAtTicks = '1100' },
  'wrong-clock-domain': (_frames, rows) => { Reflect.set(rows[0]!.absolute!, 'clockDomain', 'monotonic-nanoseconds') },
  'row-outside-frame': (_frames, rows) => { rows[0]!.absolute!.endedAtTicks = '2000' },
  'frame-overlap': (frames) => { frames[1]!.absolute!.startedAtTicks = '1899' },
  'frame-calibration': (frames) => { frames[0]!.absolute!.startCalibration.absoluteTicks = '1001' },
  'calibration-outside-frame': (frames) => { frames[0]!.absolute!.startCalibration.monotonicBeforeNanoseconds = '49' },
  'legacy-frame-clock': (frames) => { Reflect.deleteProperty(frames[0]!, 'absolute') },
  'path-denied': (_frames, rows) => { rows[0]!.pathBefore = { count: 0, errno: 1, executable: null } },
  'path-relative': (_frames, rows) => { rows[0]!.pathBefore.executable = rows[0]!.pathAfter.executable = 'relative-foreign' },
  'path-count-zero': (_frames, rows) => { rows[0]!.pathBefore.count = 0 },
  'path-same-frame-exec': (_frames, rows) => { rows[0]!.pathAfter.executable = fixtureForeign },
  'selected-before': (_frames, rows) => { rows[0]!.pathBefore.executable = fixtureSelected },
  'selected-after': (_frames, rows) => { rows[0]!.pathAfter.executable = fixtureSelected },
  'confirmation-error': (_frames, rows) => { rows[0]!.confirmation!.before.errno = 1 },
  'confirmation-uid': (_frames, rows) => { rows[0]!.confirmation!.after.identity!.uid = 503 },
  'confirmation-birth': (_frames, rows) => { rows[0]!.confirmation!.birthAfter.birthTicks = '501' },
  'confirmation-overlap': (_frames, rows) => { rows[0]!.confirmation!.startedAtTicks = '1189' },
  'confirmation-selected': (_frames, rows) => { rows[0]!.confirmation!.pathBefore.executable = fixtureSelected },
}

describe('strict foreign credential proof rejects incomplete original main brackets', () => {
  it.each(Object.entries(mutations))('rejects %s while preserving the first change and raw frames', (_name, mutate) => {
    const frames = foreignCredentialFrames()
    const rows = foreignCredentialRows(frames)
    rows[0]!.confirmation = {
      ...processAbsolute(1300, '500'),
      before: structuredClone(rows[0]!.before),
      after: structuredClone(rows[0]!.after),
      pathBefore: { ...rows[0]!.pathBefore },
      pathAfter: { ...rows[0]!.pathAfter },
    }
    mutate(frames, rows)
    const original = structuredClone(frames)
    const report = summarizeForeignCredentialFrames(frames)
    expect(report).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      closureOwnership: { status: 'unavailable' },
      verifiedForeignCredentialProcessCount: 0,
      verifiedForeignCredentialProcesses: [],
    })
    expect(report.identityChangedProcessCount).toBeGreaterThan(0)
    expect(frames).toEqual(original)
  })

  it.each(['prepare', 'anchor', 'closure1', 'closure2'] as const)('never truncates the observed certificate after a missing %s row', (phase) => {
    const frames = foreignCredentialFrames()
    const frame = frames.find(frame => frame.phase === phase)!
    frame.rows = frame.rows.filter(row => row.pid !== 22)
    expect(summarizeForeignCredentialFrames(frames).verifiedForeignCredentialProcesses).toEqual([])
  })

  it.each([0, 1, 2, 3])('requires every original frame, including missing index %s', (missing) => {
    const inventory = createNativeInventory(fixtureInstallation)
    foreignCredentialFrames().forEach((frame, index) => {
      if (index !== missing) {
        inventory.observe(normalizeNativeFrame(frame))
      }
    })
    expect(createForeignBracketProver(inventory, fixtureInstallation)(22, 'enumeration-credentials')).toBeNull()
  })

  it('rejects independent text-image conflicts without concealing the original native paths', () => {
    const report = summarizeForeignCredentialFrames(foreignCredentialFrames(), { textConflict: true })
    expect(report.verifiedForeignCredentialProcesses).toEqual([])
    expect(report.closureOwnership.status).toBe('unavailable')
    expect(report.nativeFrames).toHaveLength(4)
  })

  it('retains fallback-budget exhaustion instead of treating a valid main bracket as a budget exemption', () => {
    const inventory = createNativeInventory(fixtureInstallation)
    for (const frame of foreignCredentialFrames()) {
      inventory.observe(normalizeNativeFrame(frame))
    }
    inventory.cause(inventory.tracked.get(22)!, 'fallback-budget-exhausted', 'closure1')
    const report = summarizeNativeInventory({ inventory, installationRoot: fixtureInstallation, samplingStartedAt: 'fixture', deadline: 10_000, textProofs: [], textObservations: [] })
    expect(report).toMatchObject({ fallbackBudgetExhausted: true, installationRssBytes: { status: 'unavailable' }, verifiedForeignCredentialProcesses: [] })
  })
})
