export function queueMicrotaskPolyfill(callback: () => void) {
  if (typeof callback !== 'function') {
    throw new TypeError('Failed to execute \'queueMicrotask\': callback must be a function')
  }

  const nativeQueueMicrotask = (globalThis as Record<string, any>).queueMicrotask
  if (typeof nativeQueueMicrotask === 'function' && nativeQueueMicrotask !== queueMicrotaskPolyfill) {
    nativeQueueMicrotask(callback)
    return
  }

  Promise.resolve()
    .then(callback)
    .catch((error) => {
      setTimeout(() => {
        throw error
      }, 0)
    })
}
