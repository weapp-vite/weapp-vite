/** 准备请求体期间也遵循同一中止信号，避免无限输入阻塞请求取消。 */
export function requestAbortReason(signal: AbortSignal) {
  if (signal.reason !== undefined) {
    return signal.reason
  }
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

export function abortable<T>(operation: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) {
    return operation
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      reject(requestAbortReason(signal))
    }
    // 无论取消发生在哪个阶段，都观察原操作的拒绝，避免后台产生未处理错误。
    operation.then((value) => {
      signal.removeEventListener('abort', onAbort)
      resolve(value)
    }, (error) => {
      signal.removeEventListener('abort', onAbort)
      reject(error)
    })
    if (signal.aborted) {
      onAbort()
    }
    else {
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}
