export const recoveryScenarioId = 'public-missing-watch-recovery'
export const recoveryErrorsStage = 'recovery-final-public-errors'

/** 在原始 worker 内记录公开回调的对象身份，序列化后不靠错误文本猜测来源。 */
export function describePublicError(error, injectedError) {
  return { name: error?.name, code: error?.code, message: String(error), stack: error?.stack, originalInjectedError: error === injectedError }
}

/** 只有外层收到局部断言实际抛出的同一个对象时，才发布该边界的现场快照。 */
export function createRecoveryFailureObserver() {
  let failure
  return {
    capture(error, errors, injectedError) {
      failure = { error, publicErrors: errors.map(item => describePublicError(item, injectedError)) }
    },
    describe(error) {
      if (failure && error === failure.error) {
        return { stage: recoveryErrorsStage, publicErrors: failure.publicErrors }
      }
    },
  }
}
