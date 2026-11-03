import type { DarwinProcessEntry, DarwinProcessIdentity } from '../processInventory/darwinInspector/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNativeInventory } from './closure'
import { entry, fixtureInstallation, frame } from './fixture'
import { normalizeNativeFrame } from './model'
import { summarizeNativeInventory } from './summary'

const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const

function absent(pid: number, identity: Partial<DarwinProcessIdentity> = {}): DarwinProcessEntry {
  return {
    ...entry(pid, { identity }),
    before: { result: 0, length: 0, errno: 0, identity: null },
    after: { result: 0, length: 0, errno: 0, identity: null },
    pathBefore: { count: 0, errno: 3, executable: null },
    pathAfter: { count: 0, errno: 3, executable: null },
    task: { count: 0, errno: 3, identity: null, rssBytes: null },
    gaps: ['identity-before-unavailable', 'identity-after-unavailable', 'image-before-unavailable', 'image-after-unavailable', 'rss-unavailable'],
  }
}

function summarize(rows: DarwinProcessEntry[][]) {
  const inventory = createNativeInventory(fixtureInstallation)
  rows.forEach((values, index) => inventory.observe(normalizeNativeFrame(frame(phases[index]!, values))))
  return summarizeNativeInventory({ inventory, installationRoot: fixtureInstallation, samplingStartedAt: 'fixture', deadline: 10_000, textProofs: [], textObservations: [] })
}

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

describe('enumeration identity cannot be joined to another native row identity', () => {
  it.each([11, 22])('permanently blocks PID %s enumeration-to-row drift with the original direction and native values', (pid) => {
    const rows = phases.map(phase => [11, 22].map(candidate => entry(candidate, { identity: candidate === pid && phase === 'anchor' ? { startedMicroseconds: '123457' } : {} })))
    const changed = rows[1]!.find(row => row.pid === pid)!
    changed.enumeratedIdentity.startedMicroseconds = '123456'
    const original = structuredClone(rows)
    const report = summarize(rows)

    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.processes.some(row => row.pid === pid)).toBe(false)
    expect(report.verifiedMemberRssBytes).toBe(pid === 11 ? 0 : 1000)
    expect(report.identityChangedProcesses).toEqual([expect.objectContaining({
      pid,
      startedMicroseconds: '123456',
      changedTo: expect.objectContaining({ startedMicroseconds: '123457' }),
      reasons: ['started-changed'],
      firstObserved: { round: 1, phase: 'anchor' },
      boundary: { from: { phase: 'anchor', position: 'enumeration' }, to: { phase: 'anchor', position: 'before' } },
    })])
    const captured = report.nativeFrames![1]!.rows.find(row => row.pid === pid)!
    expect(captured).toMatchObject({
      enumeratedIdentity: { startedMicroseconds: '123456' },
      enumerationIdentityChange: { from: { startedMicroseconds: '123456' }, to: { startedMicroseconds: '123457' }, position: 'before' },
      before: { startedMicroseconds: '123457' },
      after: { startedMicroseconds: '123457' },
      rss: { identity: { startedMicroseconds: '123457' }, bytes: '1000' },
    })
    expect(report.unclassifiedProcesses.find(row => row.pid === pid)?.causes).toContainEqual({ reason: 'enumeration-identity-changed', firstObserved: { round: 1, phase: 'anchor' } })
    expect(rows).toEqual(original)
  })

  it.each(['before', 'task', 'after'] as const)('keeps same-frame %s credentials strict and rejects an unverified helper enumeration', (position) => {
    const changed = entry(22)
    changed[position].identity!.uid++
    const row = normalizeNativeFrame(frame('anchor', [entry(11), changed])).rows.get(22)!
    expect(row).toMatchObject({ identityChanged: true, rssBytes: null, images: null, imageSource: 'not-verified' })
    expect(row.enumerationIdentityChange).toMatchObject({ position, from: { uid: 501 }, to: { uid: 502 } })
    const helper = frame('anchor')
    helper.ownedHelper.row.enumeratedIdentity.uid++
    expect(() => normalizeNativeFrame(helper)).toThrow(/owned native inspector/)
  })

  it('keeps an enumeration-only anchor PID unclassified without filling its ancestry, queries or RSS', () => {
    const gone = absent(33, { parentPid: 11 })
    const rows = phases.map(phase => [entry(11), entry(22), ...(phase === 'anchor' ? [gone] : [])])
    const report = summarize(rows)

    expect(report).toMatchObject({ installationRssBytes: { status: 'unavailable' }, unclassifiedProcessCount: 1, uninspectedNewProcessCount: 1, missingIdentityCount: 0, newSelectedProcessCount: 0, verifiedTerminalProcessCount: 0 })
    expect(report.newProcesses).toEqual([expect.objectContaining({ pid: 33, parentPid: 0, started: 'unverified', classification: 'unclassified', imageSource: 'not-verified' })])
    expect(report.nativeFrames![1]!.rows.find(row => row.pid === 33)).toMatchObject({ enumeratedIdentity: { parentPid: 11 }, enumerationIdentityChange: null, before: null, after: null, rss: { identity: null, bytes: null }, pathBefore: { image: null }, pathAfter: { image: null }, gaps: gone.gaps })
  })

  it.each([
    { name: 'start', identity: { startedMicroseconds: '123457' } },
    { name: 'parent', identity: { parentPid: 1 } },
  ])('does not attach a different anchor enumeration $name exit to the prepared foreign process', ({ identity }) => {
    const rows = phases.map(phase => [entry(11), entry(22), ...(phase === 'prepare' ? [entry(33, { parentPid: 22 })] : phase === 'anchor' ? [absent(33, { parentPid: 22, ...identity })] : [])])
    const report = summarize(rows)

    expect(report).toMatchObject({ installationRssBytes: { status: 'unavailable' }, verifiedTerminalProcessCount: 0, verifiedTerminalProcesses: [] })
    expect(report.identityChangedProcesses).toEqual([expect.objectContaining({ pid: 33, parentPid: 22, startedMicroseconds: '123456', changedTo: expect.objectContaining(identity), boundary: { from: { phase: 'prepare', position: 'before' }, to: { phase: 'anchor', position: 'enumeration' } } })])
    expect(report.nativeFrames![1]!.rows.find(row => row.pid === 33)).toMatchObject({ enumeratedIdentity: identity, before: null, after: null, rss: { bytes: null } })
  })

  it('retains different enumeration identities across phases even when no native query ever supplies an identity', () => {
    const rows = phases.map(phase => [entry(11), entry(22), absent(33, { startedMicroseconds: phase === 'anchor' ? '123457' : '123456' })])
    const report = summarize(rows)

    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.identityChangedProcesses).toEqual([expect.objectContaining({ pid: 33, startedMicroseconds: '123456', changedTo: expect.objectContaining({ startedMicroseconds: '123457' }), boundary: { from: { phase: 'prepare', position: 'enumeration' }, to: { phase: 'anchor', position: 'enumeration' } } })])
    expect(report.verifiedTerminalProcesses).toEqual([])
    expect(report.nativeFrames!.every(frame => frame.rows.find(row => row.pid === 33)!.before === null)).toBe(true)
  })

  it.each(['permission', 'partial', 'reappearance'] as const)('keeps the original %s gate after an enumeration-only anchor row', (kind) => {
    const gone = absent(33)
    if (kind === 'permission') {
      gone.before = { result: -1, length: 648, errno: 1, identity: null }
    }
    else if (kind === 'partial') {
      gone.task = { count: 1, errno: 0, identity: null, rssBytes: null }
    }
    const rows = phases.map(phase => [entry(11), entry(22), ...(phase === 'anchor' ? [gone] : kind === 'reappearance' && phase === 'closure1' ? [entry(33)] : [])])
    const original = structuredClone(rows)
    const report = summarize(rows)

    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.verifiedTerminalProcesses).toEqual([])
    expect(report.nativeFrames![1]!.rows.find(row => row.pid === 33)!.rss.bytes).toBeNull()
    expect(rows).toEqual(original)
  })

  it('allows scheduling status and complete cross-frame foreign credential changes under the existing rules', () => {
    const rows = phases.map((_, index) => {
      const foreign = entry(22, { identity: { uid: 501 + index } })
      foreign.enumeratedIdentity.status = 3
      foreign.before.identity!.status = 2
      foreign.task.identity!.status = 4
      return [entry(11), foreign]
    })
    expect(summarize(rows)).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, identityChangedProcessCount: 0 })
  })

  it('preserves a same-instance live-to-zombie proof instead of treating its state change as PID reuse', () => {
    const rows = phases.map((phase) => {
      const terminal = entry(33, { parentPid: 22, identity: { status: 5, zombie: true } })
      terminal.pathBefore = terminal.pathAfter = { count: 0, errno: 3, executable: null }
      terminal.task = { count: 0, errno: 3, identity: null, rssBytes: null }
      terminal.gaps = ['image-before-unavailable', 'image-after-unavailable', 'rss-unavailable', 'zombie']
      return [entry(11), entry(22), phase === 'prepare' ? entry(33, { parentPid: 22 }) : terminal]
    })
    const report = summarize(rows)

    expect(report).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, verifiedTerminalProcessCount: 1 })
    expect(report.verifiedTerminalProcesses![0]!.proof).toBe('prepare-proven-foreign-then-anchor-kernel-terminal')
    expect(report.identityChangedProcesses[0]!.reasons).toEqual(['zombie-changed'])
  })

  it('whitelists enumeration identities and exact intervals without leaking credentials or future raw metadata', () => {
    const sentinel = 'private-enumeration-metadata'
    const rows = phases.map(() => {
      const foreign = entry(22)
      Object.assign(foreign.enumeratedIdentity, { command: sentinel, argv: [sentinel], futureIdentityField: sentinel })
      return [entry(11), foreign]
    })
    const report = summarize(rows)
    const encoded = JSON.stringify(report)

    for (const forbidden of [sentinel, '"uid"', '"command"', '"argv"', 'futureIdentityField']) {
      expect(encoded).not.toContain(forbidden)
    }
    expect(report.nativeFrames![1]!.enumerationInterval).toEqual({ startedAtNanoseconds: '60', endedAtNanoseconds: '80' })
    expect(report.nativeFrames![1]!.rows.find(row => row.pid === 22)!.enumeratedIdentity).toEqual({ pid: 22, parentPid: 1, started: '1792800000.123456', startedSeconds: '1792800000', startedMicroseconds: '123456', status: 2, zombie: false })
  })
})
