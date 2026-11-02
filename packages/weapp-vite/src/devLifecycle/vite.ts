import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import type { ViteWatcherAcquisition } from '../runtime/watch/viteAdapter'
import type { DevServerCloseRecord } from './server'
import { createServer, mergeConfig, resolveConfig } from 'vite'
import { adapterRegistrationReady, getViteWatcherAcquisition, prepareViteWatcherAdapter } from '../runtime/watch/viteAdapter'
import { deduplicateCleanupErrors } from '../runtime/watcher/cleanupErrors'
import { getDevServerCloseRecord } from './server'
import { getDevShutdownScope } from './shutdown'

interface OwnedGeneration {
  record: DevServerCloseRecord
  adapter?: ViteWatcherAcquisition
  release: () => void
}

function throwCleanupErrors(errors: unknown[]) {
  const unique = deduplicateCleanupErrors(errors)
  if (unique.length) {
    throw unique.length === 1 ? unique[0] : new AggregateError(unique, 'Vite acquisition and cleanup failed', { cause: unique[0] })
  }
}

async function resolveOwnedConfig(config: InlineConfig, gatePlugin: Plugin, acquire: (adapter: ViteWatcherAcquisition) => void) {
  const resolved = await resolveConfig(config, 'serve', undefined, undefined, undefined, undefined, (plugins) => {
    // 在 Vite 创建 hook 排序缓存前插入，首次启动与每次原生重启使用同一规则。
    plugins.unshift(gatePlugin)
  })
  acquire(prepareViteWatcherAdapter(resolved))
  return resolved
}

/** 产品自有 Vite 宿主持有公开 watcher 适配；CLI 调用另共享命令退出边界。 */
export async function createDevViteServer(inlineConfig: InlineConfig): Promise<ViteDevServer> {
  const scope = getDevShutdownScope()
  const run = <T>(phase: 'startup' | 'restart' | 'cleanup', action: () => T | Promise<T>) => scope ? scope.run(phase, action) : Promise.resolve().then(action)
  const adapters = new Set<ViteWatcherAcquisition>()
  const cancellations = new Map<ViteWatcherAcquisition, () => void>()
  const forgetAdapter = (adapter: ViteWatcherAcquisition) => {
    cancellations.get(adapter)?.()
    cancellations.delete(adapter)
    adapters.delete(adapter)
  }
  const acquire = (adapter: ViteWatcherAcquisition) => {
    adapters.add(adapter)
    if (scope) {
      // 退出不能反向等待尚未完成的初扫；先关闭其 owner，取消就绪屏障。
      cancellations.set(adapter, scope.onStopping(() => adapter.close()))
    }
  }
  const closeAdapters = async (targets: ViteWatcherAcquisition[]) => {
    const results = await Promise.allSettled(targets.map(async (adapter) => {
      await adapter.close()
      forgetAdapter(adapter)
    }))
    return results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  }
  const generations = new Set<OwnedGeneration>()
  const retire = (generation: OwnedGeneration, releaseAdapter = true) => {
    generation.release()
    generations.delete(generation)
    if (generation.adapter && releaseAdapter) {
      forgetAdapter(generation.adapter)
    }
  }
  const closeGeneration = async (generation: OwnedGeneration) => {
    await generation.record.close()
    retire(generation)
  }
  const closeGenerations = async (targets: OwnedGeneration[]) => {
    const results = await Promise.allSettled(targets.map(closeGeneration))
    return results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  }
  const gatePlugin: Plugin = {
    name: 'weapp-vite:dev-shutdown',
    configureServer: {
      order: 'pre',
      async handler(server) {
        const adapter = getViteWatcherAcquisition(server.config)
        const record = getDevServerCloseRecord(server)
        const generation: OwnedGeneration = { record, adapter, release: () => {} }
        if (adapter) {
          const nativeClose = record.close
          let closing: Promise<void> | undefined
          record.close = () => closing ??= (async () => {
            const results = await Promise.allSettled([nativeClose(), adapter.close()])
            throwCleanupErrors([...new Set(results.flatMap(result => result.status === 'rejected' ? [result.reason] : []))])
            // 失败 owner 仍由命令退出域持有，不能将已拒绝的 close 当成资源终结。
            retire(generation)
          })()
        }
        if (scope) {
          record.gate = closeLocal => scope.stopping && !scope.isInternalOperation()
            ? scope.done
            : scope.run('cleanup', closeLocal)
        }
        generation.release = scope?.own(() => closeGeneration(generation)) ?? (() => {})
        generations.add(generation)

        const nativeRestart = server.restart.bind(server)
        let restarting: Promise<void> | undefined
        server.restart = force => restarting ??= run('restart', async () => {
          if (scope?.stopping) {
            return
          }
          const previousConfig = server.config
          const previousGeneration = getDevServerCloseRecord(server)
          const existing = new Set(generations)
          const previousAdapters = new Set(adapters)
          // 每代重新读取用户配置及依赖；不能让文件配置中的 pre hook 抢在退出 gate 前。
          const nextConfig = force
            ? mergeConfig(previousConfig.inlineConfig, { forceOptimizeDeps: true })
            : previousConfig.inlineConfig
          const resolved = await resolveOwnedConfig(nextConfig, gatePlugin, acquire)
          // 配置 hook 可能已领取资源；继续完成本次宿主登记，再由统一退出关闭它。
          // 此槽位的类型仍是 InlineConfig，但 Vite 的创建入口明确接受 ResolvedConfig。
          const restartConfig = { ...previousConfig, inlineConfig: resolved as unknown as InlineConfig }
          server.config = restartConfig
          const errors: unknown[] = []
          try {
            // Vite 支持 ResolvedConfig；原生重启仍负责环境交接与服务器对象替换。
            await nativeRestart(force)
            await adapterRegistrationReady(server)
          }
          catch (error) {
            errors.push(error)
          }
          finally {
            if (server.config === restartConfig) {
              server.config = previousConfig
            }
            const active = getDevServerCloseRecord(server)
            if (active !== previousGeneration) {
              // 交接后旧 native close 已指向新宿主；旧代已由 Vite 关闭，只注销其归属。
              for (const previous of existing) {
                retire(previous, false)
              }
              // 原生交接直接关闭 watcher，仍回收其 acquisition 并保留底层关闭错误。
              errors.push(...await closeAdapters([...previousAdapters]))
            }
            // Vite 会记录并吞掉 replacement 初始化错误，这些未接管的代仍由我们释放。
            const abandoned = [...generations].filter(current => !existing.has(current) && current.record !== active)
            const cleanupErrors = await closeGenerations(abandoned)
            const activeAdapter = getViteWatcherAcquisition(server.config)
            cleanupErrors.push(...await closeAdapters([...adapters].filter(candidate => !previousAdapters.has(candidate) && candidate !== activeAdapter)))
            if (!errors.length && abandoned.length && scope?.stopping) {
              errors.push(new Error('Vite replacement server initialization failed during development shutdown'))
            }
            errors.push(...cleanupErrors)
          }
          throwCleanupErrors(errors)
        }).finally(() => {
          restarting = undefined
        })
        await adapter?.activate()
      },
    },
  }

  return run('startup', async () => {
    try {
      const server = await createServer(await resolveOwnedConfig(inlineConfig, gatePlugin, acquire))
      await adapterRegistrationReady(server)
      return server
    }
    catch (error) {
      const errors = [...new Set([error, ...await closeGenerations([...generations]), ...await closeAdapters([...adapters])])]
      throwCleanupErrors(errors)
      throw error
    }
  })
}
