import type { DarwinProcessEntry, DarwinProcessFrame } from '../processInventory/darwinInspector/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNativeInventory } from './closure'
import { entry, fixtureInstallation, frame } from './fixture'
import { normalizeNativeFrame } from './model'
import { summarizeNativeInventory } from './summary'

const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const
const uidCases = [11, 22].flatMap(pid => (['before', 'after'] as const).map(field => ({ pid, field })))

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

function changeUid(row: DarwinProcessEntry, field: 'before' | 'task' | 'after') {
  row[field].identity!.uid++
  row.gaps = field === 'before' ? ['enumeration-identity-changed'] : []
  return row
}

function summarize(frames: DarwinProcessFrame[]) {
  const inventory = createNativeInventory(fixtureInstallation)
  for (const wire of frames) {
    inventory.observe(normalizeNativeFrame(wire))
  }
  return summarizeNativeInventory({ inventory, installationRoot: fixtureInstallation, samplingStartedAt: new Date(0).toISOString(), deadline: 10_000, textProofs: [], textObservations: [] })
}

describe('native process generation and credentials are observed separately', () => {
  it.each(uidCases)('retains PID $pid $field UID drift while assigning RSS to its stable generation', ({ pid, field }) => {
    const changed = changeUid(entry(pid), field)
    const normalized = normalizeNativeFrame(frame('anchor', [changed])).rows.get(pid)!

    expect(normalized).toMatchObject({ identityChanged: false, changedIdentity: null, rssBytes: 1000, imageSource: 'kernel-path' })
    expect(normalized.images).toHaveLength(1)
    expect(normalized.enumerationIdentityChange).toMatchObject({ position: field })
    expect(normalized.entry.gaps).toEqual(field === 'before' ? ['enumeration-identity-changed'] : [])
  })

  it.each(uidCases)('keeps the installation total complete after PID $pid $field UID drift', ({ pid, field }) => {
    const frames = phases.map(phase => frame(phase, [11, 22].map(candidate => phase === 'anchor' && candidate === pid ? changeUid(entry(candidate), field) : entry(candidate))))
    const report = summarize(frames)

    expect(report.installationRssBytes.status).toBe(pid === 22 && field === 'before' ? 'unavailable' : 'observed')
    expect(report.identityChangedProcesses).toEqual([expect.objectContaining({ pid })])
    expect(report.processes.some(process => process.pid === pid)).toBe(pid === 11)
    expect(report.verifiedMemberRssBytes).toBe(1000)
    expect(report.nativeFrames?.find(value => value.phase === 'anchor')?.rows.find(row => row.pid === pid)?.gaps)
      .toEqual(field === 'before' ? ['enumeration-identity-changed'] : [])
  })

  it.each(['before', 'after', 'claimed-owner'] as const)('rejects an owned helper with a different sysctl %s UID', (field) => {
    const wire = frame('anchor')
    wire.ownedHelper.identity = { ...wire.ownedHelper.identity }
    if (field === 'claimed-owner') {
      wire.ownedHelper.identity.uid++
    }
    else {
      changeUid(wire.ownedHelper.row, field)
    }

    expect(() => normalizeNativeFrame(wire)).toThrow('Resource sampling cannot verify its exact owned native inspector.')
  })

  it.each([11, 22])('allows ordinary scheduling changes within and between PID %s frames', (pid) => {
    const frames = phases.map((phase, index) => {
      const row = entry(pid)
      row.before.identity!.status = index % 2 ? 3 : 2
      row.task.identity!.status = index % 2 ? 2 : 3
      row.after.identity!.status = row.before.identity!.status
      return frame(phase, [row, entry(pid === 11 ? 22 : 11)])
    })
    const anchor = normalizeNativeFrame(frames[1]!).rows.get(pid)!

    expect(anchor).toMatchObject({ identityChanged: false, rssBytes: 1000, imageSource: 'kernel-path' })
    expect(anchor.images).toHaveLength(1)
    expect(summarize(frames)).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, identityChangedProcesses: [] })
  })

  it.each([11, 22])('keeps task UID observations separate from sysctl credentials for PID %s', (pid) => {
    const row = entry(pid)
    row.task.identity!.uid++
    const normalized = normalizeNativeFrame(frame('anchor', [row])).rows.get(pid)!
    const frames = phases.map(phase => frame(phase, [phase === 'anchor' ? row : entry(pid), entry(pid === 11 ? 22 : 11)]))

    expect(normalized).toMatchObject({ identityChanged: false, rssBytes: 1000, imageSource: 'kernel-path', enumerationIdentityChange: null })
    expect(summarize(frames)).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, identityChangedProcesses: [] })
  })

  it('keeps separately complete cross-frame foreign credential changes distinct from a same-frame mismatch', () => {
    const frames = phases.map((phase, index) => {
      const foreign = entry(22)
      foreign.enumeratedIdentity.uid += index
      for (const observation of [foreign.before, foreign.task, foreign.after]) {
        observation.identity!.uid += index
      }
      return frame(phase, [entry(11), foreign])
    })

    expect(summarize(frames)).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, identityChangedProcesses: [] })
  })
})

it('keeps a new live identity without path or task proof unclassified after it disappears', () => {
  const unknown = entry(33, { parentPid: 22, executable: null, rssBytes: null })
  unknown.pathBefore.errno = 3
  unknown.pathAfter.errno = 3
  unknown.task.errno = 3
  unknown.gaps = ['image-before-unavailable', 'image-after-unavailable', 'rss-unavailable']
  const frames = phases.map(phase => frame(phase, [entry(11), entry(22), ...(phase === 'closure1' ? [unknown] : [])]))
  const report = summarize(frames)

  expect(report).toMatchObject({
    installationRssBytes: { status: 'unavailable' },
    unclassifiedProcessCount: 0,
    missingIdentityCount: 0,
    identityChangedProcessCount: 0,
    newSelectedProcessCount: 0,
    uninspectedNewProcessCount: 1,
    newProcesses: [{ pid: 33, parentPid: 22, classification: 'unclassified', imageSource: 'not-verified', final: null }],
  })
  expect(report.nativeFrames?.find(value => value.phase === 'closure1')?.rows.find(row => row.pid === 33))
    .toMatchObject({ before: { pid: 33 }, after: { pid: 33 }, pathBefore: { count: 0, errno: 3, image: null }, pathAfter: { count: 0, errno: 3, image: null }, rss: { count: 0, errno: 3, identity: null, bytes: null }, gaps: unknown.gaps })
})
