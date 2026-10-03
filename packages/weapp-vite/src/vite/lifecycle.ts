import type { ViteDevServer } from 'vite'

/** 关闭等待正在替换服务器的重启，避免旧入口返回后新会话继续写出。 */
export function bindHostLifecycle(server: ViteDevServer, closeSession: () => Promise<void>) {
  const nativeRestart = server.restart.bind(server)
  const nativeClose = server.close.bind(server)
  // Vite 在 configureServer 阶段向替换宿主传递父重启；原生 restart 会合并该 Promise。
  const inheritedRestart = (server as ViteDevServer & { _restartPromise?: Promise<void> | null })._restartPromise
  const stopping = Promise.withResolvers<void>()
  let restartTask: Promise<void> | undefined
  let closeTask: Promise<void> | undefined

  const close = (): Promise<void> => closeTask ??= (async () => {
    stopping.resolve()
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
      if (inheritedRestart) {
        // 新一代源码变化必须等父重启交接后再重启，不能先关闭新会话再丢掉请求。
        // 初始化失败会进入 close；取消等待避免父重启与 configureServer 相互等待。
        await Promise.race([inheritedRestart, stopping.promise])
        if (closeTask) {
          return
        }
      }
      await closeSession()
      if (!closeTask) {
        await nativeRestart(force)
      }
    })().finally(() => {
      restartTask = undefined
    })
  }
}
