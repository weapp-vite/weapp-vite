import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import type { DevServerCloseRecord } from './server'
import { createServer, mergeConfig, resolveConfig } from 'vite'
import { getDevServerCloseRecord } from './server'
import { getDevShutdownScope } from './shutdown'

interface OwnedGeneration {
  record: DevServerCloseRecord
  release: () => void
}

function throwCleanupErrors(errors: unknown[]) {
  if (errors.length) {
    throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Vite acquisition and cleanup failed', { cause: errors[0] })
  }
}

function resolveOwnedConfig(config: InlineConfig, gatePlugin: Plugin) {
  return resolveConfig(config, 'serve', undefined, undefined, undefined, undefined, (plugins) => {
    // 在 Vite 创建 hook 排序缓存前插入，首次启动与每次原生重启使用同一规则。
    plugins.unshift(gatePlugin)
  })
}

/** CLI 创建的 Vite 宿主共享退出边界；被调用方直接创建的宿主保留原生行为。 */
export async function createDevViteServer(inlineConfig: InlineConfig): Promise<ViteDevServer> {
  const scope = getDevShutdownScope()
  if (!scope) {
    return createServer(inlineConfig)
  }

  const generations = new Set<OwnedGeneration>()
  const retire = (generation: OwnedGeneration) => {
    generation.release()
    generations.delete(generation)
  }
  const closeGeneration = async (generation: OwnedGeneration) => {
    try {
      await generation.record.close()
    }
    finally {
      retire(generation)
    }
  }
  const closeGenerations = async (targets: OwnedGeneration[]) => {
    const results = await Promise.allSettled(targets.map(closeGeneration))
    return results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  }
  const gatePlugin: Plugin = {
    name: 'weapp-vite:dev-shutdown',
    configureServer: {
      order: 'pre',
      handler(server) {
        const record = getDevServerCloseRecord(server)
        record.gate = closeLocal => scope.stopping && !scope.isInternalOperation()
          ? scope.done
          : scope.run('cleanup', closeLocal)
        const generation: OwnedGeneration = { record, release: () => {} }
        generation.release = scope.own(() => closeGeneration(generation))
        generations.add(generation)

        const nativeRestart = server.restart.bind(server)
        let restarting: Promise<void> | undefined
        server.restart = force => restarting ??= scope.run('restart', async () => {
          if (scope.stopping) {
            return
          }
          const previousConfig = server.config
          const previousGeneration = getDevServerCloseRecord(server)
          const existing = new Set(generations)
          // 每代重新读取用户配置及依赖；不能让文件配置中的 pre hook 抢在退出 gate 前。
          const nextConfig = force
            ? mergeConfig(previousConfig.inlineConfig, { forceOptimizeDeps: true })
            : previousConfig.inlineConfig
          const resolved = await resolveOwnedConfig(nextConfig, gatePlugin)
          // 配置 hook 可能已领取资源；继续完成本次宿主登记，再由统一退出关闭它。
          // 此槽位的类型仍是 InlineConfig，但 Vite 的创建入口明确接受 ResolvedConfig。
          const restartConfig = { ...previousConfig, inlineConfig: resolved as unknown as InlineConfig }
          server.config = restartConfig
          const errors: unknown[] = []
          try {
            // Vite 支持 ResolvedConfig；原生重启仍负责环境交接与服务器对象替换。
            await nativeRestart(force)
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
                retire(previous)
              }
            }
            // Vite 会记录并吞掉 replacement 初始化错误，这些未接管的代仍由我们释放。
            const abandoned = [...generations].filter(current => !existing.has(current) && current.record !== active)
            const cleanupErrors = await closeGenerations(abandoned)
            if (!errors.length && abandoned.length && scope.stopping) {
              errors.push(new Error('Vite replacement server initialization failed during development shutdown'))
            }
            errors.push(...cleanupErrors)
          }
          throwCleanupErrors(errors)
        }).finally(() => {
          restarting = undefined
        })
      },
    },
  }

  return scope.run('startup', async () => {
    try {
      return await createServer(await resolveOwnedConfig(inlineConfig, gatePlugin))
    }
    catch (error) {
      const errors = [error, ...await closeGenerations([...generations])]
      throwCleanupErrors(errors)
      throw error
    }
  })
}
