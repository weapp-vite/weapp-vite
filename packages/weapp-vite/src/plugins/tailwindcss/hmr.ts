import type { OutputAsset, OutputBundle } from 'rolldown'
import type { ViteDevServer } from 'vite'
import type { Compiler, CompilerGenerateRequest, CompilerGenerateResult, CompilerSnapshot } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation, WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import { readFileSync } from 'node:fs'
import { createTailwindPreparation, prepareTailwindRoots } from '@weapp-vite/tailwindcss'
import path from 'pathe'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { changeFileExtension } from '../../utils/file'
import { resolveOutputExtensions } from '../../utils/outputExtensions'
import { isPathInside } from '../../utils/path'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { findManagedTailwindcssEntryMarker, hasManagedTailwindcssOutputMarker } from '../tailwindcssMarker'
import { TailwindContentInvalidation } from './invalidation'
import { TailwindRootLifecycle } from './lifecycle'
import { getTailwindStyleOwners, rememberTailwindStyleOwners } from './styleOwners'

interface Root {
  request: CompilerGenerateRequest
  result: CompilerGenerateResult
  sources: CompilerGenerateResult['sources'][number][]
  rawSources: ReadonlyMap<string, string | null | undefined>
  watchFiles: string[]
  matches?: (file: string) => boolean
}

interface Options {
  compiler: () => Promise<Compiler>
  render: (bundle: OutputBundle, entries: CompilerGenerateResult[], snapshot: CompilerSnapshot) => Promise<void>
}

/** 使用上游的来源匹配和内存输入能力；宿主只保存内容版本，不提取或猜测候选。 */
export function createTailwindHmrAdapter(ctx: CompilerContext, options: Options) {
  const host = getCompilerHmrHost(ctx)
  const extensions = resolveOutputExtensions(ctx.configService.outputExtensions)
  const roots = new Map<number, Root>()
  const registrations = new Map<number, symbol>()
  const lifecycle = new TailwindRootLifecycle()
  const invalidation = new TailwindContentInvalidation({ sourceId: compilerSourceId, readSource: file => host.readSource(file) })
  let originalBundle: OutputBundle = {}
  let disposed = false

  const watchFiles = new Set<string>()
  const nativeDependencies = new Set<string>()
  const discoveredSources = new Set<string>()
  let server: ViteDevServer | undefined
  let stopWatching: (() => void) | undefined

  function rebuildOwnedWatchFiles() {
    watchFiles.clear()
    nativeDependencies.clear()
    for (const root of roots.values()) {
      for (const file of root.watchFiles) {
        watchFiles.add(file)
        nativeDependencies.add(compilerSourceId(file))
      }
    }
    for (const file of discoveredSources) {
      if (![...roots.values()].some(root => root.matches?.(file))) {
        discoveredSources.delete(file)
      }
    }
  }

  async function rememberRoot(index: number, request: CompilerGenerateRequest, result: CompilerGenerateResult, generation?: symbol) {
    if (disposed) {
      return
    }
    const registration = generation ?? Symbol('tailwind-root-registration')
    if (generation) {
      if (registrations.get(index) !== generation) {
        throw new CompilerHmrResyncError(request.sourceOptions?.cssEntries ?? [], 'Tailwind 编译入口在生成期间发生变化，需要完整重同步。')
      }
    }
    else {
      registrations.set(index, registration)
    }
    const { createTailwindV4CompiledSourceEntries, createTailwindV4SourceEntryMatcher, resolveProjectSourceFiles } = await import('@weapp-tailwindcss/engine')
    const { resolveTailwindV4Source } = await import('weapp-tailwindcss/generator')
    const source = request.source ?? await resolveTailwindV4Source(request.sourceOptions)
    // 内存重编译与新增来源发现必须沿用 core 解析的 CSS base，不能扩大到项目根。
    const capturedRequest: CompilerGenerateRequest = request.sourceOptions
      ? { ...request, sourceOptions: { ...request.sourceOptions, base: source.base } }
      : request
    // 初始编译发现的扫描文件也属于下一次更新的完整输入视图。
    const sources = createTailwindV4CompiledSourceEntries(result.root, [...result.sources], source.base)
    if (ctx.configService.outDir) {
      sources.push({ base: ctx.configService.outDir, pattern: '**/*', negated: true })
    }
    const files = sources.some(source => !source.negated) ? await resolveProjectSourceFiles({ cwd: ctx.configService.cwd, sources, filter: createTailwindV4SourceEntryMatcher(sources) }) : []
    if (disposed || registrations.get(index) !== registration) {
      return
    }
    server?.watcher.add(sources.filter(source => !source.negated).map(source => source.base))
    for (const file of [...result.dependencies, ...files]) {
      if (ctx.configService.outDir && isPathInside(ctx.configService.outDir, file)) {
        continue
      }
      try {
        host.seed(file, readFileSync(file, 'utf8'))
      }
      catch {
        host.seed(file, null)
      }
    }
    const inputs = [...request.sourceOptions?.cssEntries ?? [], ...request.sourceOptions?.cssSources?.flatMap(source => source.file ? [source.file] : []) ?? []]
    const matches = createTailwindV4SourceEntryMatcher(sources)
    roots.set(index, { request: capturedRequest, result, sources, matches, watchFiles: [...result.dependencies, ...files].filter(file => !ctx.configService.outDir || !isPathInside(ctx.configService.outDir, file)), rawSources: new Map(inputs.map(file => [compilerSourceId(file), host.readSource(file)])) })
    lifecycle.remember(index, request.id)
    rebuildOwnedWatchFiles()
    invalidation.rememberRoot(index, capturedRequest, result, matches)
  }

  function captureFile(file: string, deleted: boolean) {
    if (disposed || (ctx.configService.outDir && isPathInside(ctx.configService.outDir, file))) {
      return
    }
    try {
      host.capture(file, deleted ? null : readFileSync(file, 'utf8'))
    }
    catch {
      host.capture(file, null)
    }
  }

  function configureServer(currentServer: ViteDevServer) {
    if (disposed) {
      return
    }
    stopWatching?.()
    server = currentServer
    const added = async (file: string) => {
      if (disposed || !host.onDependencyChange || host.isNativeSource(file) || nativeDependencies.has(compilerSourceId(file))
        || (ctx.configService.outDir && isPathInside(ctx.configService.outDir, file))) {
        return
      }
      if (!roots.size) {
        return
      }
      const { createTailwindV4SourceEntryMatcher, resolveProjectSourceFiles } = await import('@weapp-tailwindcss/engine')
      for (const [index, root] of roots) {
        const sources = root.sources
        const matches = createTailwindV4SourceEntryMatcher(sources)
        if (!matches?.(file)) {
          continue
        }
        const sourceId = compilerSourceId(file)
        const watchedId = normalizeFsResolvedId(file)
        const selected = await resolveProjectSourceFiles({
          cwd: ctx.configService.cwd,
          sources,
          filter: (candidate) => {
            const id = normalizeFsResolvedId(candidate)
            return (id === sourceId || id === watchedId) && matches(candidate)
          },
        })
        if (disposed || !selected.length || host.isNativeSource(file)) {
          return
        }
        if (roots.get(index) !== root) {
          continue
        }
        captureFile(file, false)
        discoveredSources.add(compilerSourceId(file))
        host.seed(file, host.readSource(file) ?? null)
        host.onDependencyChange?.(file)
        return
      }
    }
    const listener = (file: string) => {
      void added(file).catch(error => currentServer.config.logger.error(String(error)))
    }
    const updateDiscovered = (file: string, deleted: boolean) => {
      if (discoveredSources.has(compilerSourceId(file)) && !nativeDependencies.has(compilerSourceId(file)) && !host.isNativeSource(file)) {
        captureFile(file, deleted)
        host.onDependencyChange?.(file)
      }
    }
    const changed = (file: string) => updateDiscovered(file, false)
    const removed = (file: string) => updateDiscovered(file, true)
    currentServer.watcher.on('add', listener).on('change', changed).on('unlink', removed)
    const stop = () => {
      currentServer.watcher.off('add', listener).off('change', changed).off('unlink', removed)
      currentServer.httpServer?.off('close', stop)
      if (server === currentServer) {
        server = undefined
      }
    }
    stopWatching = stop
    currentServer.httpServer?.once('close', stop)
  }

  function rememberBundle(bundle: OutputBundle) {
    rememberTailwindStyleOwners(ctx, bundle, extensions.styleExtension)
    const next = { ...originalBundle }
    for (const [file, output] of Object.entries(bundle)) {
      if (output.type === 'asset' && file.endsWith(`.${extensions.templateExtension}`)) {
        next[file] = { ...output }
      }
    }
    originalBundle = next
  }

  let captured = new WeakMap<WeappCompilerHmrRequest, { roots: Map<number, Root>, bundle: OutputBundle, scope: ReturnType<TailwindRootLifecycle['capture']> }>()

  async function prepare(request: WeappCompilerHmrRequest): Promise<WeappCompilerHmrPreparation> {
    if (disposed) {
      throw new Error('Tailwind HMR adapter is disposed')
    }
    let input = captured.get(request)
    if (!input) {
      const bundle = { ...originalBundle }
      for (const [fileName, source] of getTailwindStyleOwners(ctx)) {
        // 仅供编译器处理的内存资产；最终文件仍由 Vite emit/write 创建。
        bundle[fileName] = { type: 'asset', fileName, source, names: [], originalFileNames: [] } as unknown as OutputAsset
      }
      input = { roots: new Map(roots), bundle, scope: lifecycle.capture() }
      captured.set(request, input)
    }
    // 本批没有受管入口时保持休眠；后续入口属于新的输入版本。
    if (input.roots.size === 0) {
      return {}
    }
    const compiler = await options.compiler()
    input.scope.assertActive(request.changedFiles)
    const generated = await prepareTailwindRoots(input.scope.compiler(compiler), request, input.roots, {
      cwd: ctx.configService.cwd,
      sourceId: compilerSourceId,
      isOutput: file => Boolean(ctx.configService.outDir && isPathInside(ctx.configService.outDir, file)),
      reusePreprocessedCss(file, previous, current) {
        return typeof current === 'string' && typeof previous === 'string' && file.endsWith('.vue')
          && resolveVueSfcHmrSignatures(current, file).blockSignatures?.style === resolveVueSfcHmrSignatures(previous, file).blockSignatures?.style
      },
    }).catch((error: unknown) => {
      if (error instanceof CompilerHmrResyncError && !error.files.length) {
        throw new CompilerHmrResyncError(request.changedFiles, error.message)
      }
      throw error
    })
    input.scope.assertActive(request.changedFiles)
    const entries: CompilerGenerateResult[] = []
    for (const [index, entry] of generated) {
      entries[index] = entry
      if (roots.get(index) === input.roots.get(index)) {
        invalidation.observeDependencies(index, entry.dependencies)
      }
    }
    if (disposed) {
      throw new Error('Tailwind HMR adapter is disposed')
    }
    const snapshot = compiler.mergeSnapshots(entries.flatMap(entry => [entry.snapshot]))
    const bundle = Object.fromEntries(Object.entries(input.bundle).map(([file, output]) => [file, { ...output }])) as OutputBundle
    const canonicalStyles = new Set([...input.roots.values()].flatMap(root => [
      ...root.request.sourceOptions?.cssEntries ?? [],
      ...root.request.sourceOptions?.cssSources?.flatMap(source => source.file ? [source.file] : []) ?? [],
    ]).map((file) => {
      const outputFile = changeFileExtension(file, extensions.styleExtension)
      return ctx.configService.relativeOutputPath?.(outputFile) ?? path.relative(ctx.configService.absoluteSrcRoot ?? ctx.configService.cwd, outputFile)
    }))
    const ownedStyles = new Set(Object.values(bundle).flatMap((output) => {
      if (output.type !== 'asset' || !output.fileName.endsWith(`.${extensions.styleExtension}`)) {
        return []
      }
      const css = typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source)
      return canonicalStyles.has(output.fileName) || hasManagedTailwindcssOutputMarker(css) || findManagedTailwindcssEntryMarker(css) >= 0 ? [output.fileName] : []
    }))
    await options.render(bundle, entries, snapshot)
    input.scope.assertActive(request.changedFiles)
    const assets = Object.values(bundle).flatMap(output => output.type === 'asset' && (ownedStyles.has(output.fileName) || canonicalStyles.has(output.fileName))
      ? [{ fileName: output.fileName, code: typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source) }]
      : [])
    // 无样式变化的脚本批次无需提交 CSS；变更或清空样式仍必须具备输出归属。
    if (!assets.length && entries.some((entry, index) => entry.css !== input.roots.get(index)?.result.css)) {
      throw new CompilerHmrResyncError(request.changedFiles, 'Tailwind HMR 没有可提交的样式归属，需要完整重同步。')
    }
    return createTailwindPreparation(compiler, snapshot, assets)
  }

  function removeRoot(index: number) {
    registrations.delete(index)
    roots.delete(index)
    invalidation.removeRoot(index)
    lifecycle.remove(index)
    rebuildOwnedWatchFiles()
  }

  function dispose() {
    disposed = true
    stopWatching?.()
    stopWatching = undefined
    roots.clear()
    lifecycle.clear()
    registrations.clear()
    invalidation.clear()
    watchFiles.clear()
    nativeDependencies.clear()
    discoveredSources.clear()
    originalBundle = {}
    captured = new WeakMap()
  }

  return {
    captureFile,
    configureServer,
    prepare,
    rememberBundle,
    rememberRoot,
    removeRoot,
    dispose,
    watchFiles,
    deferContentInvalidation: (file: string) => invalidation.defer(file),
    beginRootGeneration(index: number) {
      const token = Symbol('tailwind-root-generation')
      registrations.set(index, token)
      return token
    },
    generateDisk: (compiler: Compiler, request: CompilerGenerateRequest) => invalidation.generateDisk(compiler, request),
    async generateDiskRoot(compiler: Compiler, request: CompilerGenerateRequest, index: number, token: symbol) {
      const result = await invalidation.generateDisk(compiler, request)
      if (registrations.get(index) !== token || disposed) {
        throw new CompilerHmrResyncError(request.sourceOptions?.cssEntries ?? [], 'Tailwind 编译入口在生成期间发生变化，需要完整重同步。')
      }
      return result
    },
    rememberDependencies: (index: number, files: readonly string[]) => invalidation.rememberDependencies(index, files),
  }
}
