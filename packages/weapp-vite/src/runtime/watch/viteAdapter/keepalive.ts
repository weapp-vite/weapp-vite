/** 后端句柄始终 unref；单个 owner 的计时器承担公开 ref/unref 的事件循环存活语义。 */
export function createViteWatcherKeepalive(persistent: boolean) {
  const timer = setInterval(() => {}, 2_147_483_647)
  if (!persistent) {
    timer.unref()
  }
  let closed = false
  return {
    ref() {
      if (!closed) {
        timer.ref()
      }
    },
    unref() {
      if (!closed) {
        timer.unref()
      }
    },
    close() {
      closed = true
      clearInterval(timer)
    },
  }
}
