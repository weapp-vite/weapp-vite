import { recoveryErrorsStage, recoveryScenarioId } from './probe/recoveryFailure.mjs'

function empty(value) {
  return Array.isArray(value) && value.length === 0
}

function oneOriginalError(errors) {
  return Array.isArray(errors) && errors.length === 1
    && errors[0]?.originalInjectedError === true && errors[0].code === 'EPERM'
}

/** 原始归档必须由真实 Windows 恢复契约拒绝，且进程与全部资源均正常终结。 */
export function isConfirmedBaselineRejection(result) {
  const report = result?.report
  const cleanup = report?.cleanup
  if (result?.id !== recoveryScenarioId || result.variant !== 'baseline' || report?.id !== recoveryScenarioId || report.platform !== 'win32'
    || result.status !== 'failed' || report.status !== 'failed' || !Number.isInteger(result.code) || result.code === 0
    || result.signal !== null || result.timedOut !== false || result.interrupted !== false || result.launchError !== undefined
    || result.scope !== 'completed' || result.cleanupConfirmed !== true || result.cleanupError !== undefined || result.sealError !== undefined
    || result.supervisorError !== undefined || result.error !== undefined || report.error !== undefined
    || report.leaseError !== undefined || report.finalPublicError !== undefined
    || cleanup?.nativeCleanupConfirmed !== true || cleanup.deletedFixture !== true || cleanup.machineLeaseReleased !== true
    || !empty(cleanup.forcedNativeCloses) || !empty(cleanup.errors) || report.native?.injected !== 1
    || !Array.isArray(report.native.handles) || report.native.handles.length === 0
    || !report.native.handles.every(item => typeof item?.file === 'string' && item.closeCalls === 1 && item.closeEvents === 1)
    || !oneOriginalError(report.publicErrors)) {
    return false
  }
  const body = report.bodyError
  if (body?.originalInjectedError === true && body.code === 'EPERM') {
    return true
  }
  return body?.name === 'AssertionError' && body.code === 'ERR_ASSERTION' && body.originalInjectedError === false
    && report.recoveryFailure?.stage === recoveryErrorsStage && oneOriginalError(report.recoveryFailure.publicErrors)
}
