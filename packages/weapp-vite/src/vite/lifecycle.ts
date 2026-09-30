import type { ViteDevServer } from 'vite'

/** 关闭等待正在替换服务器的重启，避免旧入口返回后新会话继续写出。 */
export function bindHostLifecycle(server: ViteDevServer, closeSession: () => Promise<void>) {
  const nativeRestart = server.restart.bind(server)
  const nativeClose = server.close.bind(server)
  let restartTask: Promise<void> | undefined
  let closeTask: Promise<void> | undefined

  const close = (): Promise<void> => closeTask ??= (async () => {
    try {
      await closeSession()
    }
    finally {
      await restartTask?.catch(() => {})
      // Vite 重启会把新服务器的方法复制回原对象；继续关闭替换后的会话。
      if (server.close !== close) {
        await server.close()
      }
      else {
        await nativeClose()
      }
    }
  })()

  server.close = close
  server.restart = (force) => {
    if (closeTask) {
      return closeTask
    }
    return restartTask ??= (async () => {
      await closeSession()
      if (!closeTask) {
        await nativeRestart(force)
      }
    })().finally(() => {
      restartTask = undefined
    })
  }
}
