import type { ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import { AsyncLocalStorage } from 'node:async_hooks'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { compilerSourceId, getCompilerHmrHost } from './hmr'
import { readCompilerRawInput } from './rawInputs'

/** 声明的非模块依赖进入同一批次输入账本，监听只捕获内容，交付仍由宿主负责。 */
export function createCompilerDependencyTracker(ctx: CompilerContext) {
  const files = new Set<string>()
  const paths = new Set<string>()
  const sourceDependencies = new AsyncLocalStorage<Set<string>>()
  const cleanups = new Set<() => void>()
  const host = getCompilerHmrHost(ctx)
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
      paths.add(normalizeFsResolvedId(file))
      if (files.has(id)) {
        host.seed(file, host.readSource(id) ?? null)
        return
      }
      const read = readCompilerRawInput(file)
      host.seed(file, read?.source ?? null, read ?? undefined)
      files.add(id)
    },
    configureServer(server: ViteDevServer) {
      const capture = (file: string, removed = false) => {
        const id = compilerSourceId(file)
        if ((!files.has(id) && !paths.has(normalizeFsResolvedId(file))) || host.isNativeSource(id)) {
          return
        }
        const read = removed ? null : readCompilerRawInput(file)
        if (!files.has(id)) {
          // alias 改指后的新 canonical 身份也必须进入依赖集合，才能触发 compiler-only 刷新。
          host.seed(file, read?.source ?? null, read ?? undefined)
        }
        if (read === null) {
          host.captureRaw(file, null, false)
        }
        else {
          host.captureRaw(file, read.source, false, read)
        }
        files.add(id)
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
      paths.clear()
    },
  }
}
