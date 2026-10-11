import { createHash } from 'node:crypto'

export function fault(code) {
  return Object.assign(new Error(code), { code })
}
export function requireFact(value, code) {
  if (!value) {
    throw fault(code)
  }
}
export function safeError(error) {
  // 不上传任意错误文本、堆栈、路径、环境或租约凭证。
  return { name: /^[A-Za-z]+Error$/.test(error?.name) ? error.name : 'Error', code: /^[A-Z][A-Z_0-9]{0,79}$/.test(error?.code) ? error.code : 'UNCLASSIFIED' }
}
export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
export async function bounded(promise, milliseconds, code, signal) {
  let timer
  let onAbort
  const stop = new Promise((_, reject) => {
    timer = setTimeout(() => reject(fault(code)), milliseconds)
    onAbort = () => reject(signal.reason)
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) {
      onAbort()
    }
  })
  try {
    return await Promise.race([promise, stop])
  }
  finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
