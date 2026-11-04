import type { WireFrame } from './fixture'
import { describe, expect, it } from 'vitest'
import { fixtureAbsoluteFrame, fixtureAbsoluteReady, fixtureConfirmation, fixtureExecutable, fixtureFrame, fixtureReady } from './fixture'
import { parseDarwinInspectorReady, parseDarwinProcessFrame } from './protocol'

function parse(frame = fixtureAbsoluteFrame()) {
  return parseDarwinProcessFrame(JSON.stringify(frame), frame.requestId, frame.phase, fixtureAbsoluteReady)
}

describe('Darwin Mach absolute evidence protocol', () => {
  it('preserves raw Mach ticks and timebase without converting them to monotonic nanoseconds', () => {
    const frame = fixtureAbsoluteFrame()
    const original = structuredClone(frame)
    expect(parseDarwinInspectorReady(JSON.stringify(fixtureAbsoluteReady), 99, fixtureExecutable).absoluteClock).toEqual(fixtureAbsoluteReady.absoluteClock)
    expect(parse(frame).absolute).toEqual(frame.absolute)
    expect(parse(frame).rows[1]!.absolute).toEqual(frame.rows[1]!.absolute)
    expect(parse(frame).rows[1]!.confirmation).toBeNull()
    expect(BigInt(parse(frame).absolute!.startedAtTicks)).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER))
    expect(frame).toEqual(original)
  })

  it('does not fabricate absolute or birth evidence for historical wire frames', () => {
    const frame = parseDarwinProcessFrame(JSON.stringify(fixtureFrame()), 1, 'prepare', fixtureReady)
    expect(frame).not.toHaveProperty('absolute')
    expect(frame.rows[1]).not.toHaveProperty('absolute')
    expect(frame.rows[1]).not.toHaveProperty('confirmation')
    expect(() => parse(fixtureFrame())).toThrow(/clock evidence/)
    expect(() => parseDarwinProcessFrame(JSON.stringify(fixtureAbsoluteFrame()), 1, 'prepare', fixtureReady)).toThrow(/clock evidence/)
  })

  it.each([1, 3])('retains a failed rusage query with errno %s instead of copying another birth token', (errno) => {
    const frame = fixtureAbsoluteFrame()
    Object.assign(frame.rows[1]!.absolute!.birthBefore, { result: -1, errno, birthTicks: null, exitTicks: null })
    const row = parse(frame).rows[1]!
    expect(row.absolute!.birthBefore).toEqual(frame.rows[1]!.absolute!.birthBefore)
    expect(row.absolute!.birthAfter.birthTicks).toBe('42')
  })

  it('preserves differing, zero and terminal birth observations as raw evidence for domain rejection', () => {
    const frame = fixtureAbsoluteFrame()
    frame.rows[1]!.absolute!.birthBefore.birthTicks = '0'
    frame.rows[1]!.absolute!.birthAfter.birthTicks = '43'
    frame.rows[1]!.absolute!.birthAfter.exitTicks = '44'
    expect(parse(frame).rows[1]!.absolute).toEqual(frame.rows[1]!.absolute)
  })

  it('retains a birth inside the syscall interval for strict generation proof to reject', () => {
    const frame = fixtureAbsoluteFrame()
    const birth = frame.rows[1]!.absolute!.birthBefore
    birth.birthTicks = birth.endedAtTicks
    expect(parse(frame).rows[1]!.absolute!.birthBefore).toEqual(birth)
  })

  it('retains an independent final confirmation and original credential and image changes', () => {
    const frame = fixtureAbsoluteFrame(4)
    const row = frame.rows[1]!
    row.enumeratedIdentity.uid++
    row.pathBefore.executable = '/first-foreign-image'
    row.confirmation = fixtureConfirmation(row)
    const original = structuredClone(frame)
    const value = parse(frame).rows[1]!
    expect(value.gaps).toEqual(['enumeration-identity-changed', 'image-changed'])
    expect(value.confirmation).toEqual(row.confirmation)
    expect(value.confirmation!.pathBefore.executable).toBe(row.pathAfter.executable)
    expect(frame).toEqual(original)
  })

  it('keeps failed confirmation reads and generation changes visible instead of replacing the original row', () => {
    const frame = fixtureAbsoluteFrame(4)
    const row = frame.rows[1]!
    row.confirmation = fixtureConfirmation(row)
    row.confirmation.after.identity!.startedMicroseconds = '123457'
    row.confirmation.pathAfter = { count: 0, errno: 3, executable: null }
    row.confirmation.birthAfter = { ...row.confirmation.birthAfter, result: -1, errno: 3, birthTicks: null, exitTicks: null }
    const value = parse(frame).rows[1]!
    expect(value.before.identity!.startedMicroseconds).toBe('123456')
    expect(value.confirmation).toEqual(row.confirmation)
  })

  const malformed: Array<[string, (frame: WireFrame) => void]> = [
    ['frame clock domain', frame => Reflect.set(frame.absolute!, 'clockDomain', 'clock-monotonic-raw')],
    ['row clock domain', frame => Reflect.set(frame.rows[1]!.absolute!, 'clockDomain', 'nanoseconds')],
    ['partial row extension', frame => Reflect.deleteProperty(frame.rows[1]!, 'confirmation')],
    ['partial frame extension', frame => Reflect.deleteProperty(frame, 'absolute')],
    ['partial birth', frame => Reflect.deleteProperty(frame.rows[1]!.absolute!.birthBefore, 'exitTicks')],
    ['extra birth field', frame => Reflect.set(frame.rows[1]!.absolute!.birthBefore, 'rssBytes', '12')],
    ['unsafe number', frame => Reflect.set(frame.rows[1]!.absolute!.birthBefore, 'birthTicks', 42)],
    ['uint64 overflow', frame => frame.rows[1]!.absolute!.birthBefore.birthTicks = '18446744073709551616'],
    ['negative ticks', frame => frame.rows[1]!.absolute!.startedAtTicks = '-1'],
    ['nondecimal ticks', frame => frame.rows[1]!.absolute!.startedAtTicks = '1e2'],
    ['reversed frame', frame => frame.absolute!.endedAtTicks = '1'],
    ['reversed row', frame => frame.rows[1]!.absolute!.endedAtTicks = '1'],
    ['row outside frame', frame => frame.rows[1]!.absolute!.endedAtTicks = String(BigInt(frame.absolute!.endedAtTicks) + 1n)],
    ['rusage outside row', frame => frame.rows[1]!.absolute!.birthAfter.endedAtTicks = String(BigInt(frame.rows[1]!.absolute!.endedAtTicks) + 1n)],
    ['reversed rusage', frame => frame.rows[1]!.absolute!.birthAfter.endedAtTicks = '1'],
    ['overlapping rusage', frame => frame.rows[1]!.absolute!.birthAfter.startedAtTicks = frame.rows[1]!.absolute!.birthBefore.startedAtTicks],
    ['future birth', frame => frame.rows[1]!.absolute!.birthBefore.birthTicks = String(BigInt(frame.rows[1]!.absolute!.birthBefore.endedAtTicks) + 1n)],
    ['exit before birth', frame => frame.rows[1]!.absolute!.birthBefore.exitTicks = '1'],
    ['future exit', frame => frame.rows[1]!.absolute!.birthBefore.exitTicks = String(BigInt(frame.rows[1]!.absolute!.birthBefore.endedAtTicks) + 1n)],
    ['token after failed query', frame => frame.rows[1]!.absolute!.birthBefore.result = -1],
    ['reversed calibration', frame => frame.absolute!.startCalibration.monotonicAfterNanoseconds = '0'],
    ['calibration outside frame', frame => frame.absolute!.endCalibration.monotonicAfterNanoseconds = String(BigInt(frame.endedAtNanoseconds) + 1n)],
    ['mismatched calibration tick', frame => frame.absolute!.startCalibration.absoluteTicks = '1'],
  ]
  it.each(malformed)('rejects malformed %s', (_name, mutate) => {
    const frame = fixtureAbsoluteFrame()
    mutate(frame)
    expect(() => parse(frame)).toThrow(/protocol/)
  })

  it.each(['early', 'outside', 'another-pid', 'extra-rss', 'wrong-phase'] as const)('rejects a malformed %s confirmation', (kind) => {
    const frame = fixtureAbsoluteFrame(kind === 'wrong-phase' ? 3 : 4)
    const row = frame.rows[1]!
    row.confirmation = fixtureConfirmation(row)
    if (kind === 'early') {
      row.confirmation.startedAtTicks = String(BigInt(row.absolute!.endedAtTicks) - 1n)
    }
    else if (kind === 'outside') {
      row.confirmation.endedAtTicks = String(BigInt(frame.absolute!.endedAtTicks) + 1n)
    }
    else if (kind === 'another-pid') {
      row.confirmation.before.identity!.pid++
    }
    else if (kind === 'extra-rss') {
      Reflect.set(row.confirmation, 'rssBytes', '1000')
    }
    expect(() => parse(frame)).toThrow(/protocol/)
  })

  it.each([0, -1, 1.5, 0x100000000])('rejects an invalid Mach timebase component %s', (component) => {
    const ready = structuredClone(fixtureAbsoluteReady)
    ready.absoluteClock!.timebaseNumerator = component
    expect(() => parseDarwinInspectorReady(JSON.stringify(ready), 99, fixtureExecutable)).toThrow(/protocol/)
  })
})
