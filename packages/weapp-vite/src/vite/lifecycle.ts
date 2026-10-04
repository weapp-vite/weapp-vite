import type { InlineConfig, ViteDevServer } from 'vite'
import { getDevServerCloseRecord, replaceDevServerClose } from '../devLifecycle/server'
import { getDevShutdownScope } from '../devLifecycle/shutdown'

const hostLifecycleKey = Symbol.for('weapp-vite:host-lifecycle')

interface RestartData {
  value: unknown
  dispose?: (status: 'incomplete' | 'failed') => void | Promise<void>
}

interface HostLifecycle {
  readonly restartTask: Promise<void> | undefined
  readonly data: Map<symbol, RestartData>
}

type HostInlineConfig = InlineConfig & { [hostLifecycleKey]?: HostLifecycle }
const hostData = new WeakMap<ViteDevServer, { incoming?: Map<symbol, RestartData>, outgoing: Map<symbol, RestartData> }>()

async function settleHostCleanup(tasks: Promise<unknown>[]) {
  const results = await Promise.allSettled(tasks)
  const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  if (errors.length) {
    throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Host cleanup failed')
  }
}

async function discardRestartData(data: Map<symbol, RestartData> | undefined, status: 'incomplete' | 'failed') {
  const entries = [...data?.values() ?? []]
  data?.clear()
  await settleHostCleanup(entries.map(async entry => await entry.dispose?.(status)))
}

/** 重启附带数据仅属于这一条宿主链，不写入调用方配置或共享的进程缓存。 */
export async function setHostRestartData(server: ViteDevServer, key: symbol, value: unknown, dispose?: RestartData['dispose']) {
  const data = hostData.get(server)
  if (!data) {
    throw new Error('Cannot hand off data without a bound host lifecycle')
  }
  const previous = data.outgoing.get(key)
  data.outgoing.set(key, { value, dispose })
  await previous?.dispose?.('incomplete')
}

/** 新宿主只能接管一次；读取即释放旧链持有的引用。 */
export function takeHostRestartData<T>(server: ViteDevServer, key: symbol): T | undefined {
  const data = hostData.get(server)?.incoming
  const value = data?.get(key)?.value as T | undefined
  data?.delete(key)
  return value
}

/** 关闭等待正在替换服务器的重启，避免旧入口返回后新会话继续写出。 */
export function bindHostLifecycle(server: ViteDevServer, closeSession: () => Promise<void>) {
  const nativeRestart = server.restart.bind(server)
  const generation = getDevServerCloseRecord(server)
  const nativeClose = generation.close
  const scope = getDevShutdownScope()
  // Vite 在赋值 _restartPromise 前已创建替换宿主，不能用其私有字段识别父重启。
  // 只接收本次原生重启传入的私有配置，新的插件实例也能接续同一条宿主链。
  const inlineConfig = server.config.inlineConfig as HostInlineConfig
  const inherited = inlineConfig[hostLifecycleKey]
  const inheritedRestart = inherited?.restartTask
  const data = new Map<symbol, RestartData>()
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

  const closeResources = async () => {
    stopping.resolve()
    const sessionCleanup = settleHostCleanup([Promise.resolve().then(closeSession), discardRestartData(data, 'incomplete'), discardRestartData(inherited?.data, 'incomplete')])
    const hostCleanup = (async () => {
      // 资源与宿主的错误分别保留；后续关闭失败不能覆盖前面的恢复错误。
      await sessionCleanup.catch(() => {})
      await restartTask?.catch(() => {})
      // 以原生交接的代际记录识别替换宿主，不能把公共退出 gate 当成新资源入口。
      const current = getDevServerCloseRecord(server)
      if (current !== generation) {
        await current.close()
      }
      else {
        await nativeClose()
      }
    })()
    await settleHostCleanup([sessionCleanup, hostCleanup])
  }
  const close = (): Promise<void> => closeTask ??= scope
    ? scope.run('cleanup', closeResources)
    : closeResources()

  replaceDevServerClose(server, close)
  server.restart = (force) => {
    if (closeTask || scope?.stopping) {
      return close()
    }
    const restart = async () => {
      if (inheritedRestart) {
        // 新一代源码变化必须等父重启交接后再重启，不能先关闭新会话再丢掉请求。
        // 初始化失败会进入 close；取消等待避免父重启与 configureServer 相互等待。
        await Promise.race([inheritedRestart, stopping.promise])
        if (closeTask || scope?.stopping) {
          return
        }
      }
      try {
        await closeSession()
        if (closeTask || scope?.stopping) {
          return
        }
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
          delete restartConfig[hostLifecycleKey]
          if (server.config === restartHostConfig) {
            server.config = config
          }
        }
      }
      catch (error) {
        try {
          await discardRestartData(data, 'failed')
        }
        catch (cleanupError) {
          throw new AggregateError([error, cleanupError], 'Host restart and handoff cleanup failed', { cause: error })
        }
        throw error
      }
      finally {
        await discardRestartData(data, 'incomplete')
      }
    }
    return restartTask ??= (scope ? scope.run('restart', restart) : restart()).finally(() => {
      restartTask = undefined
    })
  }
}
