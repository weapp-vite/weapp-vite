import type { DevEnvironment, ResolvedConfig, ViteDevServer } from 'vite'
import type { ViteWatcherCloseFailure } from './backend'
import { createViteWatcherBackend, throwViteAdapterErrors } from './backend'
import { collectViteAdapterTargets, resolveViteAdapterOptions, usesNativeViteWatcher } from './options'

type Backend = ReturnType<typeof createViteWatcherBackend>
const backends = new WeakMap<ViteDevServer['watcher'], Backend>()
const acquisitions = new WeakMap<ResolvedConfig, ViteWatcherAcquisition>()

export interface ViteWatcherAcquisition {
  mode: 'adapter' | 'native' | 'disabled'
  activate: () => Promise<'ready' | 'closed' | 'native' | 'disabled'>
  close: () => Promise<void>
  closeFailures: () => { watchers: ViteWatcherCloseFailure[], environments: { name: string, error: unknown }[] }
}

/** 仅在完整 resolveConfig 返回后调用，不让临时禁用状态泄漏给配置和环境插件筛选。 */
export function prepareViteWatcherAdapter(config: ResolvedConfig): ViteWatcherAcquisition {
  const existing = acquisitions.get(config)
  if (existing) {
    return existing
  }
  const requested = config.server.watch
  const mode = requested === null ? 'disabled' : usesNativeViteWatcher(requested) ? 'native' : 'adapter'
  let backend: Backend | undefined
  let backendClosing: Promise<void> | undefined
  let closed = false
  let closing: Promise<void> | undefined
  let staged = false
  let handedOff = false
  const pending = new Set<Promise<unknown>>()
  const failures = new Set<unknown>()
  const environments = new Set<DevEnvironment>()
  const failedEnvironments = new Map<DevEnvironment, unknown>()
  const restorations: (() => void)[] = []
  const restore = () => {
    if (staged) {
      config.server.watch = requested
      staged = false
    }
  }
  const restoreHooks = () => {
    restorations.splice(0).forEach(release => release())
    for (const environment of environments) {
      if (!failedEnvironments.has(environment)) {
        environments.delete(environment)
      }
    }
  }
  const closeBackend = () => backend ? backendClosing ??= backend.close() : Promise.resolve()
  const close = () => {
    closed = true
    return closing ??= (async () => {
      // 在途 factory/init 仍需登记其原始错误；不能让 Promise.all 的首个拒绝提前完成收尾。
      const backendResults = Promise.allSettled([closeBackend()])
      while (pending.size) {
        await Promise.allSettled([...pending])
      }
      const results = await backendResults
      results.push(...await Promise.allSettled([closeBackend()]))
      if (failures.size && !handedOff) {
        const owned = [...environments]
        const environmentResults = await Promise.allSettled(owned.map(async environment => await environment.close?.()))
        environmentResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            failedEnvironments.set(owned[index]!, result.reason)
          }
        })
        results.push(...environmentResults)
      }
      // 取消可能早于 Vite 创建 Noop；临时 null 必须留到 factory 入口，避免意外创建 native watcher。
      if (!staged) {
        restoreHooks()
      }
      throwViteAdapterErrors([...failures, ...results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])])
    })()
  }
  const track = <T>(operation: () => T | Promise<T>): Promise<T> => {
    const task = Promise.withResolvers<T>()
    pending.add(task.promise)
    try {
      // 同步调用原 factory，保留第三方 factory 之间的调用顺序。
      task.resolve(operation())
    }
    catch (error) {
      task.reject(error)
    }
    void task.promise.then(() => pending.delete(task.promise), (error) => {
      failures.add(error)
      closed = true
      // 立即取消后端扫描，拒绝由统一 close 再次读取并保留。
      void closeBackend().catch(() => {})
      pending.delete(task.promise)
    })
    return task.promise
  }
  const acquisition: ViteWatcherAcquisition = {
    mode,
    close,
    closeFailures: () => ({
      watchers: backend?.closeFailures() ?? [],
      environments: [...failedEnvironments].map(([environment, error]) => ({ name: environment.name, error })),
    }),
    activate: async () => {
      handedOff = true
      if (closed) {
        restoreHooks()
      }
      return backend ? await backend.activate() : closed ? 'closed' : mode === 'adapter' ? 'ready' : mode
    },
  }
  acquisitions.set(config, acquisition)
  if (requested === null || mode !== 'adapter') {
    return acquisition
  }
  const wrapped = new WeakSet<DevEnvironment>()
  for (const environmentOptions of Object.values(config.environments)) {
    const originalFactory = environmentOptions.dev.createEnvironment
    const wrappedFactory: typeof originalFactory = function (this: typeof environmentOptions.dev, ...args) {
      // Vite 已创建 NoopWatcher；从原 factory/constructor 起重新看到用户的真实配置。
      restore()
      return track(async () => {
        const environment = await originalFactory.apply(this, args)
        environments.add(environment)
        if (!wrapped.has(environment)) {
          wrapped.add(environment)
          const originalInit = environment.init
          const wrappedInit: typeof originalInit = function (this: DevEnvironment, options) {
            return track(async () => {
              if (options?.watcher) {
                if (!backend) {
                  const resolved = resolveViteAdapterOptions(options.watcher.options, requested)
                  options.watcher.options = resolved.options
                  backend = createViteWatcherBackend(options.watcher, closed ? [] : collectViteAdapterTargets(config), resolved.backend, !closed && resolved.options.persistent !== false)
                  backends.set(options.watcher, backend)
                  if (closed) {
                    await closeBackend()
                  }
                }
                else if (backends.get(options.watcher) !== backend) {
                  throw new Error('[weapp-vite] Vite environments received different watcher owners')
                }
              }
              if (!failures.size) {
                await originalInit.call(this, options)
              }
            })
          }
          environment.init = wrappedInit
          restorations.push(() => {
            if (environment.init === wrappedInit) {
              environment.init = originalInit
            }
          })
        }
        return environment
      })
    }
    environmentOptions.dev.createEnvironment = wrappedFactory
    restorations.push(() => {
      if (environmentOptions.dev.createEnvironment === wrappedFactory) {
        environmentOptions.dev.createEnvironment = originalFactory
      }
    })
  }
  staged = true
  config.server.watch = null
  return acquisition
}

export function getViteWatcherAcquisition(config: ResolvedConfig) {
  return acquisitions.get(config)
}

/** 消费验证与产品启动共用公开后端屏障，不读取 Vite/Chokidar 的内部 ready 标记。 */
export async function adapterRegistrationReady(server: Pick<ViteDevServer, 'watcher'> & Partial<Pick<ViteDevServer, 'config'>>) {
  return await backends.get(server.watcher)?.registrationReady() ?? (server.config?.server.watch === null ? 'disabled' : 'native')
}
