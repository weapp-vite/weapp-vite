import type { DarwinClockCalibration, DarwinFrameAbsoluteEvidence, DarwinProcessAbsoluteEvidence, DarwinRusageObservation } from '../processInventory/darwinInspector/types'

/** 原生扩展字段逐项白名单化，避免未来字段进入验收报告。 */
function rusageEvidence(read: DarwinRusageObservation): DarwinRusageObservation {
  return {
    result: read.result,
    errno: read.errno,
    startedAtTicks: read.startedAtTicks,
    endedAtTicks: read.endedAtTicks,
    birthTicks: read.birthTicks,
    exitTicks: read.exitTicks,
  }
}

export function processAbsoluteEvidence(absolute: DarwinProcessAbsoluteEvidence): DarwinProcessAbsoluteEvidence {
  return {
    clockDomain: absolute.clockDomain,
    startedAtTicks: absolute.startedAtTicks,
    endedAtTicks: absolute.endedAtTicks,
    birthBefore: rusageEvidence(absolute.birthBefore),
    birthAfter: rusageEvidence(absolute.birthAfter),
  }
}

function calibrationEvidence(value: DarwinClockCalibration): DarwinClockCalibration {
  return {
    monotonicBeforeNanoseconds: value.monotonicBeforeNanoseconds,
    absoluteTicks: value.absoluteTicks,
    monotonicAfterNanoseconds: value.monotonicAfterNanoseconds,
  }
}

export function frameAbsoluteEvidence(absolute: DarwinFrameAbsoluteEvidence): DarwinFrameAbsoluteEvidence {
  return {
    clockDomain: absolute.clockDomain,
    startedAtTicks: absolute.startedAtTicks,
    endedAtTicks: absolute.endedAtTicks,
    startCalibration: calibrationEvidence(absolute.startCalibration),
    endCalibration: calibrationEvidence(absolute.endCalibration),
  }
}
