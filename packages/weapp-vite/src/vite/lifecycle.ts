import type { InlineConfig, ViteDevServer } from 'vite'

const hostLifecycleKey = Symbol.for('weapp-vite:host-lifecycle')

interface HostLifecycle {
  readonly restartTask: Promise<void> | undefined
  readonly data: Map<symbol, unknown>
}

type HostInlineConfig = InlineConfig & { [hostLifecycleKey]?: HostLifecycle }
const hostData = new WeakMap<ViteDevServer, { incoming?: Map<symbol, unknown>, outgoing: Map<symbol, unknown> }>()

/** 重启附带数据仅属于这一条宿主链，不写入调用方配置或共享的进程缓存。 */
export function setHostRestartData(server: ViteDevServer, key: symbol, value: unknown) {
  const data = hostData.get(server)
  if (!data) {
    throw new Error('Cannot hand off data without a bound host lifecycle')
  }
  data.outgoing.set(key, value)
}

/** 新宿主只能接管一次；读取即释放旧链持有的引用。 */
export function takeHostRestartData<T>(server: ViteDevServer, key: symbol): T | undefined {
  const data = hostData.get(server)?.incoming
  const value = data?.get(key) as T | undefined
  data?.delete(key)
  return value
}

/** 关闭等待正在替换服务器的重启，避免旧入口返回后新会话继续写出。 */
export function bindHostLifecycle(server: ViteDevServer, closeSession: () => Promise<void>) {
  const nativeRestart = server.restart.bind(server)
  const nativeClose = server.close.bind(server)
  // Vite 在赋值 _restartPromise 前已创建替换宿主，不能用其私有字段识别父重启。
  // 只接收本次原生重启传入的私有配置，新的插件实例也能接续同一条宿主链。
  const inlineConfig = server.config.inlineConfig as HostInlineConfig
  const inherited = inlineConfig[hostLifecycleKey]
  const inheritedRestart = inherited?.restartTask
  const data = new Map<symbol, unknown>()
  hostData.set(server, { incoming: inherited?.data, outgoing: data })
  delete inlineConfig[hostLifecycleKey]
  const stopping = Promise.withResolvers<void>()
  let restartTask: Promise<void> | undefined
  let closeTask: Promise<void> | undefined
  const lifecycle: HostLifecycle = {
    data,
    get restartTask() {
      return restartTask
    },
  }

  const close = (): Promise<void> => closeTask ??= (async () => {
    data.clear()
    inherited?.data.clear()
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
        const config = server.config
        // 不把重启状态写入调用方的配置；两个独立宿主可以安全复用同一份配置。
        // Vite 的 force 重启通过对象展开合并 defaults，会继续保留此 symbol。
        const restartConfig: HostInlineConfig = { ...config.inlineConfig, [hostLifecycleKey]: lifecycle }
        const restartHostConfig = { ...config, inlineConfig: restartConfig }
        server.config = restartHostConfig
        try {
          await nativeRestart(force)
        }
        finally {
          data.clear()
          delete restartConfig[hostLifecycleKey]
          if (server.config === restartHostConfig) {
            server.config = config
          }
        }
      }
    })().finally(() => {
      restartTask = undefined
    })
  }
}
