interface WxBaseResultLike {
  errMsg: string
}

interface WxAsyncOptionsLike<SuccessResult extends WxBaseResultLike> {
  success?: (result: SuccessResult) => void
  fail?: (result: WxBaseResultLike) => void
  complete?: (result: SuccessResult | WxBaseResultLike) => void
}

export function callWxAsyncSuccess<SuccessResult extends WxBaseResultLike>(
  options: WxAsyncOptionsLike<SuccessResult> | undefined,
  result: SuccessResult,
) {
  options?.success?.(result)
  options?.complete?.(result)
  return result
}

export function callWxAsyncFailure<SuccessResult extends WxBaseResultLike>(
  options: WxAsyncOptionsLike<SuccessResult> | undefined,
  errMsg: string,
) {
  const result: WxBaseResultLike = { errMsg }
  options?.fail?.(result)
  options?.complete?.(result)
  return result
}

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
