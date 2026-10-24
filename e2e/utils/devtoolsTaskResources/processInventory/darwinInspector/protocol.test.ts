import { describe, expect, it } from 'vitest'
import { fixtureExecutable, fixtureFrame, fixtureReady } from './fixture'
import { parseDarwinInspectorReady, parseDarwinProcessFrame } from './protocol'

const parse = (frame = fixtureFrame()) => parseDarwinProcessFrame(JSON.stringify(frame), 1, 'prepare', fixtureReady)

describe('Darwin native frame protocol', () => {
  it('binds the held helper and preserves exact timestamps and RSS beyond Number precision', () => {
    const frame = fixtureFrame()
    frame.rows[1]!.task.rssBytes = '9007199254740993'
    for (const observation of [frame.rows[1]!.before, frame.rows[1]!.after, frame.rows[1]!.task]) {
      observation.identity!.startedSeconds = '9007199254740993'
    }
    const value = parse(frame)
    expect(value.rows[1]!.task.rssBytes).toBe('9007199254740993')
    expect(value.rows[1]!.before.identity!.startedSeconds).toBe('9007199254740993')
    expect(value.ownedHelper.row).toBe(value.rows[0])
  })
  it('retains a foreign-looking identity with unavailable RSS without inventing zero', () => {
    const frame = fixtureFrame()
    frame.rows[1]!.task = { count: 0, errno: 1, identity: null, rssBytes: null }
    const row = parse(frame).rows[1]!
    expect(row.gaps).toEqual(['rss-unavailable'])
    expect(row.task).toMatchObject({ errno: 1, rssBytes: null })
  })
  it('retains ordinary status evidence while accepting stable helper and RSS identities', () => {
    const frame = fixtureFrame()
    for (const row of frame.rows) {
      row.before.identity!.status = 3
      row.task.identity!.status = 2
      row.after.identity!.status = 4
    }
    const value = parse(frame)
    for (const row of value.rows) {
      expect(row.gaps).toEqual([])
      expect(row.before.identity!.status).toBe(3)
      expect(row.task.identity!.status).toBe(2)
      expect(row.after.identity!.status).toBe(4)
    }
    expect(value.ownedHelper.identity.status).toBe(fixtureReady.identity.status)
  })
  it('keeps zombie transitions distinct from ordinary status changes', () => {
    const frame = fixtureFrame()
    frame.rows[1]!.after.identity!.status = fixtureReady.abi.zombieStatus
    frame.rows[1]!.after.identity!.zombie = true
    expect(parse(frame).rows[1]!.gaps).toEqual(['identity-changed', 'rss-identity-mismatch', 'zombie'])
    frame.rows[0]!.after.identity!.status = fixtureReady.abi.zombieStatus
    frame.rows[0]!.after.identity!.zombie = true
    expect(() => parse(frame)).toThrow(/ownership/)
  })
  it('retains exits and exact same-second identity/image changes as explicit gaps', () => {
    const frame = fixtureFrame()
    frame.rows[1]!.after.identity!.startedMicroseconds = '123457'
    frame.rows[1]!.pathAfter.executable = fixtureExecutable
    expect(parse(frame).rows[1]!.gaps).toEqual(['identity-changed', 'image-changed', 'rss-identity-mismatch'])
    frame.rows[1]!.after = { result: 0, length: 0, errno: 0, identity: null }
    expect(parse(frame).rows[1]!.gaps).toContain('identity-after-unavailable')
  })
  it('rejects a matching process name with a different held child or exact identity', () => {
    expect(() => parseDarwinInspectorReady(JSON.stringify(fixtureReady), 98, fixtureExecutable)).toThrow()
    expect(() => parseDarwinInspectorReady(JSON.stringify(fixtureReady), 99, `${fixtureExecutable}-other`)).toThrow()
    const frame = fixtureFrame()
    frame.rows[0]!.before.identity!.startedMicroseconds = '123457'
    expect(() => parse(frame)).toThrow(/ownership/)
  })
  it('rejects incomplete, duplicate and extra cardinalities', () => {
    const missing = fixtureFrame()
    missing.rows.pop()
    expect(() => parse(missing)).toThrow()
    const duplicate = fixtureFrame()
    duplicate.enumeration.pids[1] = 99
    expect(() => parse(duplicate)).toThrow()
    const extra = fixtureFrame()
    extra.rows[1]!.pid = 12
    expect(() => parse(extra)).toThrow()
  })
  it('rejects wrong phases, stale intervals and imprecise wire integers', () => {
    const wrong = fixtureFrame()
    wrong.phase = 'anchor'
    expect(() => parse(wrong)).toThrow()
    const reversed = fixtureFrame()
    reversed.rows[1]!.endedAtNanoseconds = '99'
    expect(() => parse(reversed)).toThrow()
    const invalid = fixtureFrame()
    invalid.rows[1]!.before.identity!.startedMicroseconds = '1000000'
    expect(() => parse(invalid)).toThrow()
    const precision = fixtureFrame()
    precision.rows[1]!.task.rssBytes = '18446744073709551616'
    expect(() => parse(precision)).toThrow()
    expect(() => parseDarwinProcessFrame(JSON.stringify(fixtureFrame()), 2, 'prepare', fixtureReady)).toThrow(/phase\/request id/)
    expect(() => parseDarwinProcessFrame(JSON.stringify(fixtureFrame()), 1, 'anchor', fixtureReady)).toThrow(/phase\/request id/)
  })
  it('rejects copied RSS or identity after partial or denied native reads', () => {
    const partial = fixtureFrame()
    partial.rows[1]!.task.count--
    expect(() => parse(partial)).toThrow()
    const denied = fixtureFrame()
    denied.rows[1]!.before.errno = 1
    expect(() => parse(denied)).toThrow()
  })
})
