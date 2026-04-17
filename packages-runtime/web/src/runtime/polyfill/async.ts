interface MiniProgramBaseResultLike {
  errMsg: string
}

interface MiniProgramAsyncOptionsLike<SuccessResult extends MiniProgramBaseResultLike> {
  success?: (result: SuccessResult) => void
  fail?: (result: MiniProgramBaseResultLike) => void
  complete?: (result: SuccessResult | MiniProgramBaseResultLike) => void
}

export function callMiniProgramAsyncSuccess<SuccessResult extends MiniProgramBaseResultLike>(
  options: MiniProgramAsyncOptionsLike<SuccessResult> | undefined,
  result: SuccessResult,
) {
  options?.success?.(result)
  options?.complete?.(result)
  return result
}

export function callMiniProgramAsyncFailure<SuccessResult extends MiniProgramBaseResultLike>(
  options: MiniProgramAsyncOptionsLike<SuccessResult> | undefined,
  errMsg: string,
) {
  const result: MiniProgramBaseResultLike = { errMsg }
  options?.fail?.(result)
  options?.complete?.(result)
  return result
}

export const callWxAsyncSuccess = callMiniProgramAsyncSuccess
export const callWxAsyncFailure = callMiniProgramAsyncFailure

export function normalizeDuration(duration: number | undefined, fallback: number) {
  if (typeof duration !== 'number' || Number.isNaN(duration)) {
    return fallback
  }
  return Math.max(0, duration)
}

export function scheduleMicrotask(task: () => void) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task)
    return
  }
  Promise.resolve()
    .then(task)
    .catch((error) => {
      setTimeout(() => {
        throw error
      }, 0)
    })
}
