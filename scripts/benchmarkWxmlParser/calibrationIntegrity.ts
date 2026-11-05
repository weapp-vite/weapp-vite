import type { Calibration } from './calibration'
import { calibrateBatch } from './calibration'

/** 重放已登记的共同批量算法，核对探测顺序、分辨率与最终批量均来自完整原始证据。 */
export function validCalibrationEvidence(calibration: Omit<Calibration, 'operation' | 'cohort'>, comparable: boolean): boolean {
  if (!calibration.probes.length || calibration.probes.some(probe => !Number.isFinite(probe.durationMs) || probe.durationMs < 0)) {
    return false
  }
  let offset = 0
  let matched = true
  const expected = calibrateBatch((arm, iterations) => {
    const probe = calibration.probes[offset++]
    if (!probe || probe.arm !== arm || probe.iterations !== iterations) {
      matched = false
      return undefined
    }
    return probe.durationMs
  }, comparable)
  return matched && offset === calibration.probes.length && expected.iterations === calibration.iterations && expected.candidateResolved === calibration.candidateResolved
}
