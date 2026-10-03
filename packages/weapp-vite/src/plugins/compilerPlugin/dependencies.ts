import type { ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import { AsyncLocalStorage } from 'node:async_hooks'
import { readFileSync } from 'node:fs'
import { compilerSourceId, getCompilerHmrHost } from './hmr'

/** 声明的非模块依赖进入同一批次输入账本，监听只捕获内容，交付仍由宿主负责。 */
export function createCompilerDependencyTracker(ctx: CompilerContext) {
  const files = new Set<string>()
  const sourceDependencies = new AsyncLocalStorage<Set<string>>()
  const cleanups = new Set<() => void>()
  const host = getCompilerHmrHost(ctx)
  const read = (file: string) => {
    try {
      return readFileSync(file, 'utf8')
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }
  return {
    async trackSource<T>(id: string, transform: () => Promise<T>): Promise<T> {
      const dependencies = new Set<string>()
      const result = await sourceDependencies.run(dependencies, transform)
      ctx.moduleGraphService?.replaceTransformDependencies?.(id, dependencies)
      return result
    },
    remember(file: string) {
      sourceDependencies.getStore()?.add(file)
      if (!ctx.configService.isDev) {
        return
      }
      const id = compilerSourceId(file)
      if (files.has(id)) {
        return
      }
      files.add(id)
      host.seed(id, read(id))
    },
    configureServer(server: ViteDevServer) {
      const capture = (file: string, removed = false) => {
        const id = compilerSourceId(file)
        if (!files.has(id) || host.isNativeSource(id)) {
          return
        }
        host.capture(id, removed ? null : read(id))
        host.onDependencyChange?.(id)
      }
      const changed = (file: string) => capture(file)
      const removed = (file: string) => capture(file, true)
      server.watcher.on('add', changed).on('change', changed).on('unlink', removed)
      const cleanup = () => {
        server.watcher.off('add', changed).off('change', changed).off('unlink', removed)
        server.httpServer?.off('close', cleanup)
        cleanups.delete(cleanup)
      }
      cleanups.add(cleanup)
      server.httpServer?.once('close', cleanup)
    },
    dispose() {
      for (const cleanup of cleanups) {
        cleanup()
      }
      files.clear()
    },
  }
}
