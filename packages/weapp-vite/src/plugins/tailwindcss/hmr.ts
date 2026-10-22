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
import { rememberTailwindGeneration } from './generation'
import { copyGenerationValue, equalGenerationValue } from './generation/inputs'
import { captureImportedTailwindGeneration, importedGenerationRequest } from './importedGeneration'
import { rememberImportedTailwindPreparation } from './importedPreparation'
import { createImportedTailwindValidation } from './importedValidation'
import { TailwindContentInvalidation } from './invalidation'
import { TailwindRootLifecycle } from './lifecycle'
import { resolveTailwindContentSourceRules } from './sourceRules'
import { getTailwindStyleOwners, rememberTailwindStyleOwners } from './styleOwners'

interface Root {
  generation: symbol
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
  generationOptions?: () => unknown
  importedOptions?: () => unknown
}

/** 使用上游的来源匹配和内存输入能力；宿主只保存内容版本，不提取或猜测候选。 */
export function createTailwindHmrAdapter(ctx: CompilerContext, options: Options) {
  const host = getCompilerHmrHost(ctx)
  const extensions = resolveOutputExtensions(ctx.configService.outputExtensions)
  const roots = new Map<number | string, Root>()
  const registrations = new Map<number | string, symbol>()
  const lifecycle = new TailwindRootLifecycle()
  const invalidation = new TailwindContentInvalidation({ sourceId: compilerSourceId, readSource: file => host.readSource(file) })
  let disposed = false

  const watchFiles = new Set<string>()
  const nativeDependencies = new Set<string>()
  const compilerDependencyOwners = new Map<number | string, ReadonlySet<string>>()
  const compilerDependencies = new Set<string>()
  const discoveredSources = new Set<string>()
  let server: ViteDevServer | undefined
  let stopWatching: (() => void) | undefined

  function rebuildOwnedWatchFiles() {
    watchFiles.clear()
    nativeDependencies.clear()
    compilerDependencies.clear()
    for (const dependencies of compilerDependencyOwners.values()) {
      for (const file of dependencies) {
        compilerDependencies.add(file)
      }
    }
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

  async function rememberRoot(index: number | string, request: CompilerGenerateRequest, result: CompilerGenerateResult, generation?: symbol) {
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
    const { createTailwindV4SourceEntryMatcher, resolveProjectSourceFiles } = await import('@weapp-tailwindcss/engine')
    const { resolveTailwindV4Source } = await import('weapp-tailwindcss/generator')
    const source = request.source ?? await resolveTailwindV4Source(request.sourceOptions)
    // 内存重编译与新增来源发现必须沿用 core 解析的 CSS base，不能扩大到项目根。
    const capturedRequest: CompilerGenerateRequest = request.sourceOptions
      ? { ...request, sourceOptions: { ...request.sourceOptions, base: source.base } }
      : request
    // 初始编译发现的扫描文件也属于下一次更新的完整输入视图。
    const sources = resolveTailwindContentSourceRules(result, ctx.configService.outDir)
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
    roots.set(index, { generation: registration, request: capturedRequest, result, sources, matches, watchFiles: [...result.dependencies, ...files].filter(file => !ctx.configService.outDir || !isPathInside(ctx.configService.outDir, file)), rawSources: new Map(inputs.map(file => [compilerSourceId(file), host.readSource(file)])) })
    compilerDependencyOwners.set(index, new Set(result.dependencies.map(compilerSourceId)))
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

  function notifyContentChange(file: string) {
    // 新增内容文件不会经过 Rolldown 的 watchChange 钩子；先登记 Tailwind
    // 内容失效原因，再让状态化引擎交付 compiler-only 批次。更新已发现文件
    // 也复用这条路径，避免空 reason 覆盖同批次的内容失效标记。
    ctx.onStatefulHmrSourceChange?.(file, ['tailwind-content:1'])
    host.onDependencyChange?.(file)
  }

  function configureServer(currentServer: ViteDevServer) {
    if (disposed) {
      return
    }
    stopWatching?.()
    server = currentServer
    const added = async (file: string) => {
      if (disposed || !host.onDependencyChange || host.isNativeSource(file) || nativeDependencies.has(compilerSourceId(file)) || compilerDependencies.has(compilerSourceId(file))
        || (ctx.configService.outDir && isPathInside(ctx.configService.outDir, file))) {
        return
      }
      if (!roots.size) {
        return
      }
      const { createTailwindV4SourceEntryMatcher, resolveProjectSourceFiles } = await import('@weapp-tailwindcss/engine')
      for (const [index, root] of roots) {
        const sources = root.sources
        const sourceMatches = createTailwindV4SourceEntryMatcher(sources)
        if (!sourceMatches?.(file)) {
          continue
        }
        const sourceId = compilerSourceId(file)
        const watchedId = normalizeFsResolvedId(file)
        const selected = await resolveProjectSourceFiles({
          cwd: ctx.configService.cwd,
          sources,
          filter: (candidate) => {
            const id = normalizeFsResolvedId(candidate)
            return (id === sourceId || id === watchedId) && sourceMatches(candidate)
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
        notifyContentChange(file)
        return
      }
    }
    const listener = (file: string) => {
      void added(file).catch(error => currentServer.config.logger.error(String(error)))
    }
    const updateMatchedSource = (file: string, deleted: boolean) => {
      const sourceId = compilerSourceId(file)
      // CSS 编译依赖由原生模块图交付；来源扫描也匹配时只刷新文本，
      // 不能抢在原生 transform 前另开批次并封存即将撤销的 root。
      // imported root 重建期间仍保留依赖归属，直到新一代成功替换或真正移除。
      if (compilerDependencies.has(sourceId)) {
        captureFile(file, deleted)
        return true
      }
      if (![...roots.values()].some(root => root.matches?.(file))) {
        return false
      }
      // 初始 Tailwind 来源通常已被原生入口捕获，compiler dependency watcher
      // 会跳过这类文件；仍需刷新宿主中的文本，才能让下一次 snapshot 看到脚本的新候选。
      if (nativeDependencies.has(sourceId) || host.isNativeSource(file)) {
        captureFile(file, deleted)
        notifyContentChange(file)
        return true
      }
      return false
    }
    const updateDiscovered = (file: string, deleted: boolean) => {
      if (updateMatchedSource(file, deleted)) {
        return
      }
      if (discoveredSources.has(compilerSourceId(file)) && !nativeDependencies.has(compilerSourceId(file)) && !host.isNativeSource(file)) {
        captureFile(file, deleted)
        notifyContentChange(file)
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
  }

  let captured = new WeakMap<WeappCompilerHmrRequest, { roots: Map<number | string, Root>, bundle: OutputBundle, scope: ReturnType<TailwindRootLifecycle['capture']>, importedOptions: unknown }>()

  async function prepare(request: WeappCompilerHmrRequest): Promise<WeappCompilerHmrPreparation> {
    if (disposed) {
      throw new Error('Tailwind HMR adapter is disposed')
    }
    let generationOptions: unknown
    try {
      generationOptions = copyGenerationValue(options.generationOptions?.())
    }
    catch {
      // 自定义配置仍可正常编译，但不交接无法封存的生成输入。
    }
    let input = captured.get(request)
    if (!input) {
      // 此阶段只提交样式；模板由批次 preparation 在实际快照上转换一次。
      const bundle: OutputBundle = {}
      for (const [fileName, source] of getTailwindStyleOwners(ctx)) {
        // 仅供编译器处理的内存资产；最终文件仍由 Vite emit/write 创建。
        bundle[fileName] = { type: 'asset', fileName, source, names: [], originalFileNames: [] } as unknown as OutputAsset
      }
      let importedOptions: unknown
      if ([...roots.keys()].some(index => typeof index === 'string')) {
        try {
          importedOptions = copyGenerationValue(options.importedOptions?.())
        }
        catch {
          throw new CompilerHmrResyncError(request.changedFiles, 'Tailwind imported snapshot options cannot be frozen')
        }
      }
      input = { roots: new Map(roots), bundle, scope: lifecycle.capture(), importedOptions }
      captured.set(request, input)
    }
    // 本批没有受管入口时保持休眠；后续入口属于新的输入版本。
    if (input.roots.size === 0) {
      return {}
    }
    const compiler = await options.compiler()
    input.scope.assertActive(request.changedFiles)
    const hasImportedRoots = [...input.roots.keys()].some(index => typeof index === 'string')
    const effectiveRequests = new Map<number | string, CompilerGenerateRequest>()
    const generated = await prepareTailwindRoots(input.scope.compiler(compiler), request, input.roots, {
      cwd: ctx.configService.cwd,
      sourceId: compilerSourceId,
      isOutput: file => Boolean(ctx.configService.outDir && isPathInside(ctx.configService.outDir, file)),
      captureRequest: hasImportedRoots
        ? async (key, effective) => {
          effectiveRequests.set(key, await importedGenerationRequest(effective, request.sources, input.roots.get(key)!.request))
        }
        : undefined,
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
      if (typeof index === 'number') {
        entries[index] = entry
      }
      if (roots.get(index) === input.roots.get(index)) {
        invalidation.observeDependencies(index, entry.dependencies)
      }
    }
    if (disposed) {
      throw new Error('Tailwind HMR adapter is disposed')
    }
    const snapshot = compiler.mergeSnapshots([...generated.values()].map(entry => entry.snapshot))
    if (hasImportedRoots) {
      const scope = input.scope
      const owners = [...input.roots].map(([index, root]) => ({ index, root, generation: root.generation }))
      const importedOptions = input.importedOptions
      const validate = await createImportedTailwindValidation([...input.roots.values()], [...generated.values()], request, ctx.configService.cwd, () => {
        scope.assertActive(request.changedFiles)
        if (disposed || roots.size !== owners.length
          || owners.some(owner => roots.get(owner.index) !== owner.root || registrations.get(owner.index) !== owner.generation)
          || !equalGenerationValue(importedOptions, options.importedOptions?.())) {
          throw new CompilerHmrResyncError(request.changedFiles, 'Tailwind imported snapshot root generation changed')
        }
      })
      const preparation = createTailwindPreparation(compiler, snapshot)
      rememberImportedTailwindPreparation(preparation, validate, request.sources, captureImportedTailwindGeneration(effectiveRequests, generated, importedOptions, new Map([...input.roots].map(([key, root]) => [key, root.sources]))))
      return preparation
    }
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
    const preparation = createTailwindPreparation(compiler, snapshot, assets)
    const stableRoots = [...input.roots].every(([index, root], position) => typeof index === 'number' && index === position
      && root.rawSources.size > 0
      && [...root.rawSources].every(([file, source]) => typeof source === 'string' && request.sources.get(file) === source))
    if (generationOptions !== undefined && stableRoots) {
      const scope = input.scope
      const owners = [...input.roots].map(([index, root]) => ({ index, generation: root.generation }))
      const currentOptions = options.generationOptions
      rememberTailwindGeneration(preparation, request, generationOptions, [...input.roots].flatMap(([index, root]) => typeof index === 'number' ? [{ request: root.request, sources: root.sources, result: entries[index]! }] : []), () => {
        scope.assertActive(request.changedFiles)
        if (roots.size !== owners.length || owners.some(owner => roots.get(owner.index)?.generation !== owner.generation || registrations.get(owner.index) !== owner.generation)
          || !equalGenerationValue(generationOptions, currentOptions?.())) {
          throw new CompilerHmrResyncError(request.changedFiles, 'Tailwind snapshot root generation changed')
        }
      })
    }
    return preparation
  }

  function removeRoot(index: number | string) {
    registrations.delete(index)
    roots.delete(index)
    compilerDependencyOwners.delete(index)
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
    compilerDependencyOwners.clear()
    compilerDependencies.clear()
    discoveredSources.clear()
    captured = new WeakMap()
  }

  return {
    captureFile,
    configureServer,
    prepare,
    rememberBundle,
    rememberRoot,
    hasRoot: (index: number | string) => roots.has(index),
    removeRoot,
    dispose,
    watchFiles,
    deferContentInvalidation: (file: string) => invalidation.defer(file),
    beginRootGeneration(index: number | string) {
      if (typeof index === 'string') {
        // 替换先撤销旧 preparation，保留下一次磁盘生成必须 flush 的 core 失效。
        roots.delete(index)
        lifecycle.remove(index)
        rebuildOwnedWatchFiles()
      }
      const token = Symbol('tailwind-root-generation')
      registrations.set(index, token)
      return token
    },
    generateDisk: (compiler: Compiler, request: CompilerGenerateRequest) => invalidation.generateDisk(compiler, request),
    async generateDiskRoot(compiler: Compiler, request: CompilerGenerateRequest, index: number | string, token: symbol) {
      const result = await invalidation.generateDisk(compiler, request)
      if (registrations.get(index) !== token || disposed) {
        throw new CompilerHmrResyncError(request.sourceOptions?.cssEntries ?? [], 'Tailwind 编译入口在生成期间发生变化，需要完整重同步。')
      }
      return result
    },
    rememberDependencies: (index: number, files: readonly string[]) => invalidation.rememberDependencies(index, files),
  }
}
