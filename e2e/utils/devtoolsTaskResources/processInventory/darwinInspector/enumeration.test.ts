import type { WireFrame } from './fixture'
import { describe, expect, it } from 'vitest'
import { fixtureFrame, fixtureReady } from './fixture'
import { parseDarwinProcessFrame } from './protocol'

const parse = (frame: WireFrame) => parseDarwinProcessFrame(JSON.stringify(frame), 1, 'prepare', fixtureReady)

describe('Darwin enumeration identity and data-call boundary', () => {
  it('preserves monotonic enumeration boundaries beyond Number precision', () => {
    const frame = fixtureFrame()
    const start = 9007199254740993n
    frame.startedAtNanoseconds = String(start)
    frame.endedAtNanoseconds = String(start + 10n)
    frame.enumeration.startedAtNanoseconds = String(start + 1n)
    frame.enumeration.endedAtNanoseconds = String(start + 2n)
    frame.rows.forEach((row, index) => {
      row.startedAtNanoseconds = String(start + 3n + BigInt(index) * 3n)
      row.endedAtNanoseconds = String(start + 5n + BigInt(index) * 3n)
    })

    expect(parse(frame).enumeration).toEqual(frame.enumeration)
  })

  it('preserves the complete enumeration identity without filling subsequent absent native queries', () => {
    const frame = fixtureFrame()
    const row = frame.rows[1]!
    row.enumeratedIdentity.startedSeconds = '9007199254740993'
    row.before = row.after = { result: 0, length: 0, errno: 0, identity: null }
    row.pathBefore = row.pathAfter = { count: 0, errno: 3, executable: null }
    row.task = { count: 0, errno: 3, identity: null, rssBytes: null }
    const original = structuredClone(frame)
    const parsed = parse(frame)

    expect(parsed.enumeration).toEqual(frame.enumeration)
    expect(parsed.rows[1]!.enumeratedIdentity).toEqual(row.enumeratedIdentity)
    expect(parsed.rows[1]).toMatchObject({ before: { identity: null }, after: { identity: null }, task: { identity: null, rssBytes: null }, pathBefore: { executable: null }, pathAfter: { executable: null } })
    expect(parsed.rows[1]!.gaps).toEqual(['identity-before-unavailable', 'identity-after-unavailable', 'image-before-unavailable', 'image-after-unavailable', 'rss-unavailable'])
    expect(frame).toEqual(original)
  })

  it.each(['before', 'task', 'after'] as const)('retains a structurally valid enumeration-to-%s conflict instead of throwing away its raw evidence', (position) => {
    const frame = fixtureFrame()
    frame.rows[1]![position].identity!.startedMicroseconds = '123457'
    const original = structuredClone(frame)
    const row = parse(frame).rows[1]!

    expect(row.enumeratedIdentity.startedMicroseconds).toBe('123456')
    expect(row[position].identity!.startedMicroseconds).toBe('123457')
    expect(row.gaps).toContain('enumeration-identity-changed')
    expect(frame).toEqual(original)
  })

  it('accepts ordinary scheduling status changes without weakening exact same-frame credentials', () => {
    const frame = fixtureFrame()
    for (const row of frame.rows) {
      row.enumeratedIdentity.status = 3
      row.before.identity!.status = 2
      row.task.identity!.status = 4
    }
    expect(parse(frame).rows.every(row => row.gaps.length === 0)).toBe(true)
    frame.rows[1]!.enumeratedIdentity.uid++
    expect(parse(frame).rows[1]!.gaps).toContain('enumeration-identity-changed')
    frame.rows[0]!.enumeratedIdentity.uid++
    expect(() => parse(frame)).toThrow(/ownership/)
  })

  it.each(['missing-row-identity', 'missing-interval', 'extra-enumeration-field', 'other-pid', 'invalid-uid', 'invalid-microseconds', 'invalid-zombie'] as const)('rejects malformed %s without synthesizing fields for the old wire shape', (kind) => {
    const frame = fixtureFrame()
    const row = frame.rows[1]!
    if (kind === 'missing-row-identity') {
      Reflect.deleteProperty(row, 'enumeratedIdentity')
    }
    else if (kind === 'missing-interval') {
      Reflect.deleteProperty(frame.enumeration, 'endedAtNanoseconds')
    }
    else if (kind === 'extra-enumeration-field') {
      Reflect.set(frame.enumeration, 'snapshotInstant', '100')
    }
    else if (kind === 'other-pid') {
      row.enumeratedIdentity.pid++
    }
    else if (kind === 'invalid-uid') {
      row.enumeratedIdentity.uid = 0x100000000
    }
    else if (kind === 'invalid-microseconds') {
      row.enumeratedIdentity.startedMicroseconds = '1000000'
    }
    else {
      row.enumeratedIdentity.zombie = true
    }
    expect(() => parse(frame)).toThrow(/protocol/)
  })

  it.each([
    { startedAtNanoseconds: '99', endedAtNanoseconds: '100' },
    { startedAtNanoseconds: '101', endedAtNanoseconds: '100' },
    { startedAtNanoseconds: '100', endedAtNanoseconds: '111' },
    { startedAtNanoseconds: '100', endedAtNanoseconds: '102' },
    { startedAtNanoseconds: '1.5', endedAtNanoseconds: '101' },
    { startedAtNanoseconds: '100', endedAtNanoseconds: '18446744073709551616' },
  ])('rejects reversed, imprecise, out-of-frame or post-row enumeration boundaries %j', (interval) => {
    const frame = fixtureFrame()
    Object.assign(frame.enumeration, interval)
    expect(() => parse(frame)).toThrow(/protocol/)
  })

  it.each(['permission', 'partial'] as const)('keeps a %s native query unavailable despite a complete enumeration record', (kind) => {
    const frame = fixtureFrame()
    const row = frame.rows[1]!
    row.task = { count: kind === 'partial' ? fixtureReady.abi.taskSize - 1 : 0, errno: kind === 'permission' ? 1 : 0, identity: null, rssBytes: null }
    const value = parse(frame).rows[1]!

    expect(value.enumeratedIdentity).toEqual(row.enumeratedIdentity)
    expect(value.task).toEqual(row.task)
    expect(value.gaps).toContain('rss-unavailable')
  })
})
