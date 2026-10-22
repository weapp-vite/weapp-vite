import type { InlineConfig, ViteDevServer } from 'vite'
import type { DevServerCloseRecord } from '../devLifecycle/server'
import { AsyncLocalStorage } from 'node:async_hooks'
import { WEAPP_VITE_HOST_RESTART_CONFIG_KEY } from '@weapp-core/constants'
import { getDevServerCloseRecord, replaceDevServerClose } from '../devLifecycle/server'
import { getDevShutdownScope } from '../devLifecycle/shutdown'

const hostLifecycleKey = Symbol.for('weapp-vite:host-lifecycle')

interface RestartData {
  value: unknown
  dispose?: (status: 'incomplete' | 'failed') => void | Promise<void>
}

function createHostOperations() {
  const operations = new AsyncLocalStorage<{ active: boolean }>()
  return {
    isInternal: () => operations.getStore()?.active === true,
    run: async (action: () => Promise<void>) => {
      const operation = { active: true }
      return operations.run(operation, async () => {
        try {
          await action()
        }
        finally {
          // 重启期间注册的外部回调不能永久继承内部清理权限。
          operation.active = false
        }
      })
    },
  }
}

export interface HostLifecycle {
  readonly restartTask: Promise<void> | undefined
  readonly data: Map<symbol, RestartData>
  readonly operations: ReturnType<typeof createHostOperations>
  close: () => Promise<void>
  registerReplacement: (generation: DevServerCloseRecord) => void
}

type HostLifecycleCarrier = (() => void) & { [hostLifecycleKey]: HostLifecycle }
type HostInlineConfig = InlineConfig & {
  [hostLifecycleKey]?: HostLifecycle
  [WEAPP_VITE_HOST_RESTART_CONFIG_KEY]?: HostLifecycleCarrier
}
const hostData = new WeakMap<ViteDevServer, { incoming?: Map<symbol, RestartData>, outgoing: Map<symbol, RestartData> }>()

async function settleHostCleanup(tasks: Promise<unknown>[]) {
  const results = await Promise.allSettled(tasks)
  const errors = [...new Set(results.flatMap(result => result.status === 'rejected' ? [result.reason] : []))]
  if (errors.length) {
    throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Host cleanup failed')
  }
}

async function discardRestartData(data: Map<symbol, RestartData> | undefined, status: 'incomplete' | 'failed') {
  const entries = [...data?.values() ?? []]
  data?.clear()
  await settleHostCleanup(entries.map(async entry => await entry.dispose?.(status)))
}

/** 在配置合并后、编译准备前接管重启链；函数载体不会被 Vite 深拷贝。 */
export function takeHostLifecycle(config: InlineConfig): HostLifecycle | undefined {
  const inline = config as HostInlineConfig
  const carrier = inline[WEAPP_VITE_HOST_RESTART_CONFIG_KEY]
  const inherited = typeof carrier === 'function' ? carrier[hostLifecycleKey] : inline[hostLifecycleKey]
  if (inherited) {
    delete inline[WEAPP_VITE_HOST_RESTART_CONFIG_KEY]
    delete inline[hostLifecycleKey]
  }
  return inherited
}

/** 需要参与配置准备的数据在 configureServer 之前读取，且只能接管一次。 */
export function takeHostConfigRestartData<T>(lifecycle: HostLifecycle | undefined, key: symbol): T | undefined {
  const value = lifecycle?.data.get(key)?.value as T | undefined
  lifecycle?.data.delete(key)
  return value
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
export function bindHostLifecycle(server: ViteDevServer, closeSession: (reason: 'restart' | 'close') => Promise<void>, preparedLifecycle?: HostLifecycle, isRetired?: () => boolean, finalize?: () => Promise<void>) {
  const nativeRestart = server.restart.bind(server)
  const generation = getDevServerCloseRecord(server)
  const nativeClose = generation.close
  const hostWatcher = server.watcher
  const nativeWatcherClose = hostWatcher?.close.bind(hostWatcher)
  let watcherCloseTask: Promise<void> | undefined
  const closeHostWatcher = () => watcherCloseTask ??= Promise.resolve().then(() => nativeWatcherClose?.()).then(() => {})
  if (hostWatcher) {
    // 原生重启随后仍会关闭旧宿主；本代精确资源入口复用同一关闭结果。
    hostWatcher.close = closeHostWatcher
  }
  const scope = getDevShutdownScope()
  // Vite 在赋值 _restartPromise 前已创建替换宿主，不能用其私有字段识别父重启。
  // 只接收本次原生重启传入的私有配置，新的插件实例也能接续同一条宿主链。
  const inlineConfig = server.config.inlineConfig as HostInlineConfig
  const inherited = preparedLifecycle ?? takeHostLifecycle(inlineConfig)
  const operations = inherited?.operations ?? createHostOperations()
  const inheritedRestart = inherited?.restartTask
  let inheritedRestartSettled = !inheritedRestart
  void inheritedRestart?.then(() => {
    inheritedRestartSettled = true
  }, () => {
    inheritedRestartSettled = true
  })
  const data = new Map<symbol, RestartData>()
  hostData.set(server, { incoming: inherited?.data, outgoing: data })
  const stopping = Promise.withResolvers<void>()
  let restartTask: Promise<void> | undefined
  let closeTask: Promise<void> | undefined
  let retired = false
  for (const environment of Object.values(server.environments ?? {})) {
    const listen = environment.listen.bind(environment)
    // Vite 可在 configureServer 返回后才启动环境；关闭或交接后的旧代不能再次启动引擎。
    // gate 跟随本代环境永久退役，不在清理时恢复，也不影响替换宿主的新环境。
    environment.listen = async (...args) => {
      if (!retired && !isRetired?.()) {
        await listen(...args)
      }
    }
  }
  const replacements = new Set<DevServerCloseRecord>()
  let restartCleanupFailure: { error: unknown } | undefined
  const discardRestartResources = async (status: 'incomplete' | 'failed') => {
    const active = getDevServerCloseRecord(server)
    const abandoned = [...replacements].filter(replacement => replacement !== active)
    replacements.clear()
    await settleHostCleanup([
      discardRestartData(data, status),
      ...abandoned.map(replacement => Promise.resolve().then(() => replacement.close())),
    ]).catch((error) => {
      restartCleanupFailure ??= { error }
      throw error
    })
  }

  const closeResources = async () => {
    retired = true
    stopping.resolve()
    const sessionCleanup = settleHostCleanup([Promise.resolve().then(() => closeSession('close')), discardRestartData(data, 'incomplete'), discardRestartData(inherited?.data, 'incomplete')])
    const hostCleanup = (async () => {
      // 资源与宿主的错误分别保留；后续关闭失败不能覆盖前面的恢复错误。
      await sessionCleanup.catch(() => {})
      await restartTask?.catch(() => {})
      // 以原生交接的代际记录识别替换宿主，不能把公共退出 gate 当成新资源入口。
      const current = getDevServerCloseRecord(server)
      await settleHostCleanup([
        closeHostWatcher(),
        Promise.resolve().then(() => current !== generation ? current.close() : nativeClose()),
      ])
    })()
    const restartCleanup = (async () => {
      await restartTask?.catch(() => {})
      if (restartCleanupFailure) {
        throw restartCleanupFailure.error
      }
    })()
    await settleHostCleanup([sessionCleanup, hostCleanup, restartCleanup])
    // 初始化失败可在父 nativeRestart 尚未完成时关闭替换宿主；租约仍交由父链终结。
    if (inheritedRestartSettled) {
      await finalize?.()
    }
  }
  function close(): Promise<void> {
    return closeTask ??= scope
      ? scope.run('cleanup', closeResources)
      : closeResources()
  }
  const lifecycle: HostLifecycle = {
    data,
    operations,
    close,
    registerReplacement(replacement) {
      // 连续原生交接中已成为活动宿主的代由 Vite 持有，不能再次按遗弃代关闭。
      replacements.delete(getDevServerCloseRecord(server))
      replacements.add(replacement)
    },
    get restartTask() {
      return restartTask
    },
  }

  replaceDevServerClose(server, close)
  // 原生宿主为每代登记 EOF/SIGTERM 后各自 process.exit；任何一代都必须等父链收尾。
  // configureServer（包括用户 hook）失败时仍允许内部局部 close，不能反等父重启。
  // CLI 已安装命令级 gate，继续由其持有更外层的退出边界。
  generation.gate ??= closeLocal => inheritedRestart && !inheritedRestartSettled && !operations.isInternal()
    ? inherited!.close()
    : closeLocal()
  // 直接使用 Vite 的消费者没有 CLI acquisition gate，父链必须持有未提交的新代。
  inherited?.registerReplacement(generation)
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
        retired = true
        await closeSession('restart')
        if (closeTask || scope?.stopping) {
          return
        }
        // Vite 先创建新宿主再关闭旧宿主；提前释放本代 watcher，避免迟到清理取消新代订阅。
        await closeHostWatcher()
        if (closeTask || scope?.stopping) {
          return
        }
        const config = server.config
        // 不把重启状态写入调用方的配置；两个独立宿主可以安全复用同一份配置。
        // Vite 配置合并会丢弃 symbol 键；私有字符串只承载不可深拷贝的函数引用。
        // 实际资源和一次性数据仍由本条 symbol 生命周期持有，不使用进程级索引。
        const carrier: HostLifecycleCarrier = Object.assign(() => {}, { [hostLifecycleKey]: lifecycle })
        const restartConfig: HostInlineConfig = { ...config.inlineConfig, [WEAPP_VITE_HOST_RESTART_CONFIG_KEY]: carrier }
        const restartHostConfig = { ...config, inlineConfig: restartConfig }
        server.config = restartHostConfig
        try {
          await nativeRestart(force)
          // Vite 会吞掉替换宿主的初始化错误；仅完成原生代际交接才表示重启成功。
          if (getDevServerCloseRecord(server) === generation) {
            throw new Error('[weapp-vite] Vite 重启未完成替换宿主交接，请查看原始初始化错误。')
          }
        }
        finally {
          delete restartConfig[WEAPP_VITE_HOST_RESTART_CONFIG_KEY]
          if (server.config === restartHostConfig) {
            server.config = config
          }
        }
      }
      catch (error) {
        try {
          await discardRestartResources('failed')
        }
        catch (cleanupError) {
          throw new AggregateError([error, cleanupError], 'Host restart and resource cleanup failed', { cause: error })
        }
        throw error
      }
      await discardRestartResources('incomplete')
    }
    const runRestart = () => operations.run(restart)
    return restartTask ??= (scope ? scope.run('restart', runRestart) : runRestart()).finally(() => {
      restartTask = undefined
    })
  }
}
