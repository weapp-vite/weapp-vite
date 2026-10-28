import type { DarwinProcessEntry, DarwinProcessIdentity } from '../processInventory/darwinInspector/types'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNativeInventory } from './closure'
import { entry, fixtureForeign, fixtureInstallation, fixtureSelected, frame } from './fixture'
import { normalizeNativeFrame } from './model'
import { summarizeNativeInventory } from './summary'

const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const
const foreignBootstrap = '/usr/libexec/xpcproxy'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

function newExecRows(parentPid = 1): DarwinProcessEntry[][] {
  const values = phases.map((_, index) => [
    entry(11),
    ...(parentPid === 33 ? [entry(33)] : []),
    ...(index >= 2 ? [entry(22, { parentPid, rssBytes: index === 2 ? '7000' : '9000' })] : []),
  ])
  const first = values[2]!.find(row => row.pid === 22)!
  first.pathBefore = { count: foreignBootstrap.length, errno: 0, executable: foreignBootstrap }
  first.gaps = ['image-changed']
  return values
}

function setIdentity(row: DarwinProcessEntry, updates: Partial<DarwinProcessIdentity>) {
  for (const read of [row.before, row.task, row.after]) {
    Object.assign(read.identity!, updates)
  }
}

function summarize(values: DarwinProcessEntry[][], conflictingTextPid?: number) {
  const inventory = createNativeInventory(fixtureInstallation)
  values.forEach((rows, index) => inventory.observe(normalizeNativeFrame(frame(phases[index]!, rows))))
  if (conflictingTextPid !== undefined) {
    inventory.observeTextImages(conflictingTextPid, ['/System/Library/ConflictingForeign'], 'closure1')
  }
  return summarizeNativeInventory({ inventory, installationRoot: fixtureInstallation, samplingStartedAt: 'fixture', deadline: 10_000, textProofs: [], textObservations: [] })
}

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

describe('new foreign native exec has an explicit complete bracket proof', () => {
  it.each([1, 33])('proves a new closure process with continuous foreign parent %s without replacing anchor RSS', (parentPid) => {
    const values = newExecRows(parentPid)
    const original = structuredClone(values)
    const report = summarize(values)
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      verifiedMemberRssBytes: 1000,
      verifiedNewForeignProcessCount: 1,
      newSelectedProcessCount: 0,
      inventoryRoundCount: 3,
      inventoryBudgetExhausted: false,
      samplingBudgetMs: 10_000,
      rssAnchor: 'single-native-anchor-frame; preparation-and-closure-rss-never-contribute',
      newProcesses: [{ pid: 22, firstSeenRound: 2, classification: 'verified-foreign', causes: [{ reason: 'image-changed', firstObserved: { round: 2, phase: 'closure1' } }] }],
      verifiedForeignNativeExecCount: 1,
      verifiedForeignNativeExecs: [{
        process: { pid: 22, causes: [{ reason: 'image-changed', firstObserved: { round: 2, phase: 'closure1' } }] },
        from: { phase: 'closure1', position: 'path-before', image: { scope: 'outside-installation', sha256: hash(foreignBootstrap) } },
        to: { phase: 'closure1', position: 'path-after', image: { scope: 'outside-installation', sha256: hash(fixtureForeign) } },
        confirmationPhase: 'closure2',
        ancestry: parentPid === 33 ? [{ pid: 33, parentPid: 1 }] : [],
        proof: 'complete-native-foreign-exec-brackets-since-first-observation',
        phases: ['closure1', 'closure2'],
      }],
    })
    expect(report.processes.map(process => process.pid)).toEqual([11])
    expect(report.nativeFrames?.map(value => value.rows.some(row => row.pid === 22))).toEqual([false, false, true, true])
    expect(report.nativeFrames?.[2]?.rows.find(row => row.pid === 22)).toMatchObject({
      pathBefore: { image: { sha256: hash(foreignBootstrap) } },
      pathAfter: { image: { sha256: hash(fixtureForeign) } },
      rss: { bytes: '7000' },
      gaps: ['image-changed'],
    })
    expect(values).toEqual(original)
    expect(JSON.stringify(report)).not.toContain('"uid"')
  })

  it.each(['selected-before', 'selected-after', 'unknown-parent', 'task-identity', 'uid-mismatch', 'path-error', 'no-confirmation', 'text-conflict'] as const)('keeps a new %s exec incomplete', (kind) => {
    const values = newExecRows(kind === 'unknown-parent' ? 77 : 1)
    const first = values[2]!.find(row => row.pid === 22)!
    if (kind === 'selected-before' || kind === 'selected-after') {
      first[kind === 'selected-before' ? 'pathBefore' : 'pathAfter'] = { count: fixtureSelected.length, errno: 0, executable: fixtureSelected }
    }
    else if (kind === 'task-identity') {
      first.task.identity!.startedMicroseconds = '654321'
    }
    else if (kind === 'uid-mismatch') {
      first.after.identity!.uid++
    }
    else if (kind === 'path-error') {
      const final = values[3]!.find(row => row.pid === 22)!
      final.pathBefore = { count: 0, errno: 1, executable: null }
      final.gaps = ['image-before-unavailable']
    }
    else if (kind === 'no-confirmation') {
      values[3] = values[3]!.filter(row => row.pid !== 22)
    }
    const report = summarize(values, kind === 'text-conflict' ? 22 : undefined)
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(Reflect.get(report, 'verifiedForeignNativeExecCount') ?? 0).toBe(0)
    expect(Reflect.get(report, 'verifiedForeignNativeExecs') ?? []).toEqual([])
  })

  it.each([
    'prepare-seen',
    'anchor-seen',
    'confirmation-exec',
    'confirmation-revert',
    'task-uid',
    'cross-frame-uid',
    'cross-frame-start',
    'cross-frame-parent',
    'selected-parent',
    'task-permission',
    'task-error',
    'extra-gap',
    'identity-before-error',
    'identity-after-error',
    'confirmation-task-uid',
    'confirmation-gap',
  ] as const)('rejects %s without changing the original exec evidence', (kind) => {
    const values = newExecRows()
    const first = values[2]!.find(row => row.pid === 22)!
    const final = values[3]!.find(row => row.pid === 22)!
    if (kind === 'prepare-seen' || kind === 'anchor-seen') {
      values[1]!.push(entry(22))
      if (kind === 'prepare-seen') {
        values[0]!.push(entry(22))
      }
    }
    else if (kind === 'confirmation-exec') {
      final.pathAfter.executable = '/System/Library/AnotherForeign'
      final.gaps = ['image-changed']
    }
    else if (kind === 'confirmation-revert') {
      final.pathBefore.executable = final.pathAfter.executable = foreignBootstrap
    }
    else if (kind === 'task-uid' || kind === 'confirmation-task-uid') {
      const row = kind === 'task-uid' ? first : final
      row.task.identity!.uid++
    }
    else if (kind === 'cross-frame-uid') {
      setIdentity(final, { uid: 502 })
    }
    else if (kind === 'cross-frame-start') {
      setIdentity(final, { startedMicroseconds: '654321' })
    }
    else if (kind === 'cross-frame-parent') {
      setIdentity(final, { parentPid: 77 })
    }
    else if (kind === 'selected-parent') {
      setIdentity(first, { parentPid: 11 })
      setIdentity(final, { parentPid: 11 })
    }
    else if (kind === 'task-permission' || kind === 'task-error') {
      first.task = { count: 0, errno: kind === 'task-permission' ? 1 : 3, identity: null, rssBytes: null }
      first.gaps.push('rss-unavailable')
    }
    else if (kind === 'identity-before-error' || kind === 'identity-after-error') {
      first[kind === 'identity-before-error' ? 'before' : 'after'].length = 0
    }
    else {
      const row = kind === 'confirmation-gap' ? final : first
      row.gaps.push('rss-identity-mismatch')
    }
    const original = structuredClone(values)
    const report = summarize(values)
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.verifiedForeignNativeExecCount).toBe(0)
    expect(report.verifiedForeignNativeExecs).toEqual([])
    const observations = [...report.newProcesses, ...report.unclassifiedProcesses]
    expect(observations.find(row => row.pid === 22)?.causes).toContainEqual({ reason: 'image-changed', firstObserved: { round: 2, phase: 'closure1' } })
    expect(values).toEqual(original)
  })

  it.each([
    'late',
    'gap',
    'selected',
    'cycle',
    'text-conflict',
    'uid',
    'task-uid',
    'start',
    'parent',
    'permission',
    'extra-gap',
    'unknown-parent',
    'final-absent',
    'same-frame-exec',
  ] as const)('rejects an ancestor with %s evidence', (kind) => {
    const values = newExecRows(33)
    const ancestors = values.map(rows => rows.find(row => row.pid === 33)!)
    if (kind === 'late') {
      for (let index = 0; index < 3; index++) {
        values[index] = values[index]!.filter(row => row.pid !== 33)
      }
    }
    else if (kind === 'gap' || kind === 'final-absent') {
      const index = kind === 'gap' ? 1 : 3
      values[index] = values[index]!.filter(row => row.pid !== 33)
    }
    else if (kind === 'selected') {
      ancestors[0]!.pathBefore.executable = ancestors[0]!.pathAfter.executable = fixtureSelected
    }
    else if (kind === 'cycle' || kind === 'unknown-parent') {
      ancestors.forEach(row => setIdentity(row, { parentPid: kind === 'cycle' ? 22 : 77 }))
    }
    else if (kind === 'uid' || kind === 'start' || kind === 'parent') {
      setIdentity(ancestors[3]!, kind === 'uid' ? { uid: 502 } : kind === 'start' ? { startedMicroseconds: '654321' } : { parentPid: 77 })
    }
    else if (kind === 'task-uid') {
      ancestors[0]!.task.identity!.uid++
    }
    else if (kind === 'permission') {
      ancestors[0]!.task = { count: 0, errno: 1, identity: null, rssBytes: null }
      ancestors[0]!.gaps = ['rss-unavailable']
    }
    else if (kind === 'extra-gap') {
      ancestors[0]!.gaps = ['rss-identity-mismatch']
    }
    else if (kind === 'same-frame-exec') {
      ancestors[2]!.pathBefore.executable = foreignBootstrap
      ancestors[2]!.gaps = ['image-changed']
    }
    const report = summarize(values, kind === 'text-conflict' ? 33 : undefined)
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.verifiedForeignNativeExecCount).toBe(0)
    expect(report.verifiedForeignNativeExecs).toEqual([])
  })
})
