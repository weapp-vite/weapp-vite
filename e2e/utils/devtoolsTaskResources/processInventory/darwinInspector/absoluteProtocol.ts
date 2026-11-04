import type { DarwinAbsoluteClock, DarwinAbsoluteInterval, DarwinClockCalibration, DarwinFrameAbsoluteEvidence, DarwinIdentityObservation, DarwinInspectorAbi, DarwinPathObservation, DarwinProcessAbsoluteEvidence, DarwinProcessConfirmation, DarwinRusageObservation } from './types'
import { decimal, integer, invalid, record } from './protocolValues'

function absoluteInterval(value: Record<string, unknown>): DarwinAbsoluteInterval {
  if (value.clockDomain !== 'mach-absolute-ticks') {
    return invalid('unexpected absolute clock domain')
  }
  const startedAtTicks = decimal(value.startedAtTicks)
  const endedAtTicks = decimal(value.endedAtTicks)
  if (BigInt(startedAtTicks) > BigInt(endedAtTicks)) {
    return invalid('reversed absolute interval')
  }
  return { clockDomain: 'mach-absolute-ticks', startedAtTicks, endedAtTicks }
}

export function withinAbsoluteInterval(child: DarwinAbsoluteInterval, parent: DarwinAbsoluteInterval) {
  if (BigInt(child.startedAtTicks) < BigInt(parent.startedAtTicks) || BigInt(child.endedAtTicks) > BigInt(parent.endedAtTicks)) {
    return invalid('absolute interval outside its owner')
  }
}

export function parseAbsoluteClock(value: unknown): DarwinAbsoluteClock {
  const raw = record(value, ['clockDomain', 'timebaseNumerator', 'timebaseDenominator'])
  if (raw.clockDomain !== 'mach-absolute-ticks') {
    return invalid('unexpected absolute clock domain')
  }
  return { clockDomain: 'mach-absolute-ticks', timebaseNumerator: integer(raw.timebaseNumerator, 1, 0xFFFFFFFF), timebaseDenominator: integer(raw.timebaseDenominator, 1, 0xFFFFFFFF) }
}

function calibration(value: unknown): DarwinClockCalibration {
  const raw = record(value, ['monotonicBeforeNanoseconds', 'absoluteTicks', 'monotonicAfterNanoseconds'])
  const monotonicBeforeNanoseconds = decimal(raw.monotonicBeforeNanoseconds)
  const monotonicAfterNanoseconds = decimal(raw.monotonicAfterNanoseconds)
  if (BigInt(monotonicBeforeNanoseconds) > BigInt(monotonicAfterNanoseconds)) {
    return invalid('reversed calibration interval')
  }
  return { monotonicBeforeNanoseconds, absoluteTicks: decimal(raw.absoluteTicks), monotonicAfterNanoseconds }
}

export function parseFrameAbsolute(value: unknown, started: string, ended: string): DarwinFrameAbsoluteEvidence {
  const raw = record(value, ['clockDomain', 'startedAtTicks', 'endedAtTicks', 'startCalibration', 'endCalibration'])
  const interval = absoluteInterval(raw)
  const startCalibration = calibration(raw.startCalibration)
  const endCalibration = calibration(raw.endCalibration)
  if (interval.startedAtTicks !== startCalibration.absoluteTicks || interval.endedAtTicks !== endCalibration.absoluteTicks
    || BigInt(startCalibration.monotonicBeforeNanoseconds) < BigInt(started)
    || BigInt(endCalibration.monotonicAfterNanoseconds) > BigInt(ended)
    || BigInt(startCalibration.monotonicAfterNanoseconds) > BigInt(endCalibration.monotonicBeforeNanoseconds)) {
    return invalid('calibration outside frame or mismatched absolute bounds')
  }
  return { ...interval, startCalibration, endCalibration }
}

function birth(value: unknown, interval: DarwinAbsoluteInterval): DarwinRusageObservation {
  const raw = record(value, ['result', 'errno', 'startedAtTicks', 'endedAtTicks', 'birthTicks', 'exitTicks'])
  const result = integer(raw.result, -1, 0)
  const errno = integer(raw.errno, 0, 0x7FFFFFFF)
  const call = absoluteInterval({ ...raw, clockDomain: interval.clockDomain })
  withinAbsoluteInterval(call, interval)
  const complete = result === 0 && errno === 0
  if (!complete && (raw.birthTicks !== null || raw.exitTicks !== null)) {
    return invalid('birth token without a successful rusage read')
  }
  const birthTicks = complete ? decimal(raw.birthTicks) : null
  const exitTicks = complete ? decimal(raw.exitTicks) : null
  if (birthTicks !== null && BigInt(birthTicks) > BigInt(call.endedAtTicks)) {
    return invalid('process birth follows its rusage call end')
  }
  if (exitTicks !== null && exitTicks !== '0' && (BigInt(exitTicks) < BigInt(birthTicks!) || BigInt(exitTicks) > BigInt(call.endedAtTicks))) {
    return invalid('process exit outside its lifetime or rusage call')
  }
  return { result, errno, startedAtTicks: call.startedAtTicks, endedAtTicks: call.endedAtTicks, birthTicks, exitTicks }
}

function birthBracket(raw: Record<string, unknown>, interval: DarwinAbsoluteInterval): DarwinProcessAbsoluteEvidence {
  const birthBefore = birth(raw.birthBefore, interval)
  const birthAfter = birth(raw.birthAfter, interval)
  if (BigInt(birthBefore.endedAtTicks) > BigInt(birthAfter.startedAtTicks)) {
    return invalid('overlapping or reversed birth observations')
  }
  return { ...interval, birthBefore, birthAfter }
}

export function parseProcessAbsolute(value: unknown): DarwinProcessAbsoluteEvidence {
  const raw = record(value, ['clockDomain', 'startedAtTicks', 'endedAtTicks', 'birthBefore', 'birthAfter'])
  return birthBracket(raw, absoluteInterval(raw))
}

export function parseConfirmation(value: unknown, abi: DarwinInspectorAbi, pid: number, parsers: {
  identity: (value: unknown, abi: DarwinInspectorAbi) => DarwinIdentityObservation
  path: (value: unknown, abi: DarwinInspectorAbi) => DarwinPathObservation
}): DarwinProcessConfirmation | null {
  if (value === null) {
    return null
  }
  const raw = record(value, ['clockDomain', 'startedAtTicks', 'endedAtTicks', 'birthBefore', 'birthAfter', 'before', 'pathBefore', 'pathAfter', 'after'])
  const absolute = birthBracket(raw, absoluteInterval(raw))
  const before = parsers.identity(raw.before, abi)
  const after = parsers.identity(raw.after, abi)
  if ([before.identity, after.identity].some(identity => identity !== null && identity.pid !== pid)) {
    return invalid('confirmation identity belongs to another PID')
  }
  return { ...absolute, before, after, pathBefore: parsers.path(raw.pathBefore, abi), pathAfter: parsers.path(raw.pathAfter, abi) }
}
