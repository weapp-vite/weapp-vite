import type { ViteDevServer } from 'vite'
import type { CompilerGenerateResult } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import { normalizeAtomicDeleteEvent } from '../../utils/atomicWatchEvent'
import { isPathInside } from '../../utils/path'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { compilerSourceId, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { captureCompilerFileInput } from '../compilerPlugin/rawCapture'

interface SourceRoot {
  sources: CompilerGenerateResult['sources'][number][]
  matches?: (file: string) => boolean
}

/** 来源发现只拥有自己的订阅；文件捕获与原生 watcher 共用 raw 输入政策。 */
export function createTailwindHmrSources(
  ctx: CompilerContext,
  roots: ReadonlyMap<number | string, SourceRoot>,
  nativeDependencies: ReadonlySet<string>,
  compilerDependencies: ReadonlySet<string>,
) {
  const host = getCompilerHmrHost(ctx)
  const discovered = new Set<string>()
  let disposed = false
  let server: ViteDevServer | undefined
  let binding: symbol | undefined
  let stopWatching: (() => void) | undefined
  const isOutput = (file: string) => Boolean(ctx.configService.outDir && isPathInside(ctx.configService.outDir, file))
  const matches = (file: string) => [...roots.values()].some(root => root.matches?.(file))

  function captureFile(file: string, deleted: boolean, after?: () => void, active: () => boolean = () => true): void | Promise<void> {
    const capture = () => {
      if (disposed || !active() || isOutput(file) || file.startsWith('\0') || file.includes('?')) {
        return
      }
      captureCompilerFileInput(host, file)
      after?.()
    }
    if (disposed || !active() || isOutput(file) || file.startsWith('\0') || file.includes('?')) {
      return
    }
    if (deleted) {
      return normalizeAtomicDeleteEvent(file).then(capture)
    }
    capture()
  }

  function notifyContentChange(file: string) {
    ctx.onStatefulHmrSourceChange?.(file, ['tailwind-content:1'])
    host.onDependencyChange?.(file)
  }

  function configureServer(currentServer: ViteDevServer) {
    if (disposed) {
      return
    }
    stopWatching?.()
    server = currentServer
    const currentBinding = Symbol('tailwind-source-watcher')
    binding = currentBinding
    const active = () => !disposed && binding === currentBinding
    const added = async (file: string) => {
      if (!active() || !host.onDependencyChange || host.isNativeSource(file)
        || nativeDependencies.has(compilerSourceId(file)) || compilerDependencies.has(compilerSourceId(file)) || isOutput(file) || !roots.size) {
        return
      }
      const { createTailwindV4SourceEntryMatcher, resolveProjectSourceFiles } = await import('@weapp-tailwindcss/engine')
      for (const [index, root] of roots) {
        const sourceMatches = createTailwindV4SourceEntryMatcher(root.sources)
        if (!sourceMatches?.(file)) {
          continue
        }
        const sourceId = compilerSourceId(file)
        const watchedId = normalizeFsResolvedId(file)
        const selected = await resolveProjectSourceFiles({
          cwd: ctx.configService.cwd,
          sources: root.sources,
          filter: (candidate) => {
            const id = normalizeFsResolvedId(candidate)
            return (id === sourceId || id === watchedId) && sourceMatches(candidate)
          },
        })
        if (!active() || !selected.length || host.isNativeSource(file)) {
          return
        }
        if (roots.get(index) !== root) {
          continue
        }
        captureFile(file, false, () => {
          discovered.add(compilerSourceId(file))
          host.seed(file, host.readSource(file) ?? null)
          notifyContentChange(file)
        }, active)
        return
      }
    }
    const update = (file: string, deleted: boolean) => {
      const sourceId = compilerSourceId(file)
      // 编译依赖只刷新字节，原生模块图拥有后续批次，不能重复交付内容更新。
      if (compilerDependencies.has(sourceId)) {
        return captureFile(file, deleted, undefined, () => active() && compilerDependencies.has(sourceId))
      }
      const matched = () => matches(file) && (nativeDependencies.has(sourceId) || host.isNativeSource(file))
      const discoveredSource = () => discovered.has(sourceId) && !nativeDependencies.has(sourceId) && !host.isNativeSource(file)
      if (matched() || discoveredSource()) {
        return captureFile(file, deleted, () => notifyContentChange(file), () => active() && (matched() || discoveredSource()))
      }
    }
    const report = (error: unknown) => currentServer.config.logger.error('Tailwind source input capture failed', { error: error instanceof Error ? error : new Error(String(error)) })
    const observe = (run: () => void | Promise<void>) => {
      try {
        const pending = run()
        if (pending) {
          void pending.catch(report)
        }
      }
      catch (error) {
        report(error)
      }
    }
    const add = (file: string) => observe(() => added(file))
    const change = (file: string) => observe(() => update(file, false))
    const unlink = (file: string) => observe(() => update(file, true))
    currentServer.watcher.on('add', add).on('change', change).on('unlink', unlink)
    const stop = () => {
      currentServer.watcher.off('add', add).off('change', change).off('unlink', unlink)
      currentServer.httpServer?.off('close', stop)
      if (binding === currentBinding) {
        binding = undefined
        server = undefined
      }
    }
    stopWatching = stop
    currentServer.httpServer?.once('close', stop)
  }

  return {
    captureFile,
    configureServer,
    watch: (files: string[]) => server?.watcher.add(files),
    prune() {
      for (const file of discovered) {
        if (!matches(file)) {
          discovered.delete(file)
        }
      }
    },
    dispose() {
      disposed = true
      stopWatching?.()
      stopWatching = undefined
      discovered.clear()
    },
  }
}
