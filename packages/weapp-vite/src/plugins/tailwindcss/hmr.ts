import type { OutputAsset, OutputBundle } from 'rolldown'
import type { ViteDevServer } from 'vite'
import type { Compiler, CompilerGenerateRequest, CompilerGenerateResult, CompilerSnapshot } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation, WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import { readFileSync } from 'node:fs'
import { createTailwindV4CompiledSourceEntries, createTailwindV4SourceEntryMatcher, resolveProjectSourceFiles } from '@weapp-tailwindcss/engine'
import { createTailwindPreparation, prepareTailwindRoots } from '@weapp-vite/tailwindcss'
import path from 'pathe'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { changeFileExtension } from '../../utils/file'
import { resolveOutputExtensions } from '../../utils/outputExtensions'
import { isPathInside } from '../../utils/path'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { findManagedTailwindcssEntryMarker, hasManagedTailwindcssOutputMarker } from '../tailwindcssMarker'
import { getTailwindStyleOwners, rememberTailwindStyleOwners } from './styleOwners'

interface Root {
  request: CompilerGenerateRequest
  result: CompilerGenerateResult
  rawSources: ReadonlyMap<string, string | null | undefined>
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
  let originalBundle: OutputBundle = {}

  const watchFiles = new Set<string>()
  const nativeDependencies = new Set<string>()
  const discoveredSources = new Set<string>()
  let server: ViteDevServer | undefined

  async function rememberRoot(index: number, request: CompilerGenerateRequest, result: CompilerGenerateResult) {
    // 初始编译发现的扫描文件也属于下一次更新的完整输入视图。
    const sources = createTailwindV4CompiledSourceEntries(result.root, [...result.sources], request.sourceOptions?.projectRoot ?? ctx.configService.cwd)
    if (ctx.configService.outDir) {
      sources.push({ base: ctx.configService.outDir, pattern: '**/*', negated: true })
    }
    const files = sources.some(source => !source.negated) ? await resolveProjectSourceFiles({ cwd: ctx.configService.cwd, sources, filter: createTailwindV4SourceEntryMatcher(sources) }) : []
    server?.watcher.add(sources.filter(source => !source.negated).map(source => source.base))
    for (const file of [...result.dependencies, ...files]) {
      if (ctx.configService.outDir && isPathInside(ctx.configService.outDir, file)) {
        continue
      }
      watchFiles.add(file)
      nativeDependencies.add(compilerSourceId(file))
      try {
        host.seed(file, readFileSync(file, 'utf8'))
      }
      catch {
        host.seed(file, null)
      }
    }
    const inputs = [...request.sourceOptions?.cssEntries ?? [], ...request.sourceOptions?.cssSources?.flatMap(source => source.file ? [source.file] : []) ?? []]
    roots.set(index, { request, result, rawSources: new Map(inputs.map(file => [compilerSourceId(file), host.readSource(file)])) })
  }

  function captureFile(file: string, deleted: boolean) {
    if (ctx.configService.outDir && isPathInside(ctx.configService.outDir, file)) {
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
    server = currentServer
    const added = async (file: string) => {
      if (!host.onDependencyChange || host.isNativeSource(file) || nativeDependencies.has(compilerSourceId(file))
        || (ctx.configService.outDir && isPathInside(ctx.configService.outDir, file))) {
        return
      }
      for (const root of roots.values()) {
        const sources = createTailwindV4CompiledSourceEntries(root.result.root, [...root.result.sources], ctx.configService.cwd)
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
        if (!selected.length || host.isNativeSource(file)) {
          return
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
    currentServer.httpServer?.once('close', () => {
      currentServer.watcher.off('add', listener).off('change', changed).off('unlink', removed)
      server = undefined
    })
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

  const captured = new WeakMap<WeappCompilerHmrRequest, { roots: Map<number, Root>, bundle: OutputBundle }>()

  async function prepare(request: WeappCompilerHmrRequest): Promise<WeappCompilerHmrPreparation> {
    let input = captured.get(request)
    if (!input) {
      const bundle = { ...originalBundle }
      for (const [fileName, source] of getTailwindStyleOwners(ctx)) {
        // 仅供编译器处理的内存资产；最终文件仍由 Vite emit/write 创建。
        bundle[fileName] = { type: 'asset', fileName, source, names: [], originalFileNames: [] } as unknown as OutputAsset
      }
      input = { roots: new Map(roots), bundle }
      captured.set(request, input)
    }
    // 本批没有受管入口时保持休眠；后续入口属于新的输入版本。
    if (input.roots.size === 0) {
      return {}
    }
    const compiler = await options.compiler()
    const generated = await prepareTailwindRoots(compiler, request, input.roots, {
      cwd: ctx.configService.cwd,
      sourceId: compilerSourceId,
      isOutput: file => Boolean(ctx.configService.outDir && isPathInside(ctx.configService.outDir, file)),
      reusePreprocessedCss(file, previous, current) {
        return typeof current === 'string' && typeof previous === 'string' && file.endsWith('.vue')
          && resolveVueSfcHmrSignatures(current, file).blockSignatures?.style === resolveVueSfcHmrSignatures(previous, file).blockSignatures?.style
      },
    })
    const entries: CompilerGenerateResult[] = []
    for (const [index, entry] of generated) {
      entries[index] = entry
    }
    const snapshot = compiler.mergeSnapshots(entries.map(entry => entry.snapshot))
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
    const assets = Object.values(bundle).flatMap(output => output.type === 'asset' && (ownedStyles.has(output.fileName) || canonicalStyles.has(output.fileName))
      ? [{ fileName: output.fileName, code: typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source) }]
      : [])
    // 无样式变化的脚本批次无需提交 CSS；变更或清空样式仍必须具备输出归属。
    if (!assets.length && entries.some((entry, index) => entry.css !== input.roots.get(index)?.result.css)) {
      throw new CompilerHmrResyncError(request.changedFiles, 'Tailwind HMR 没有可提交的样式归属，需要完整重同步。')
    }
    return createTailwindPreparation(compiler, snapshot, assets)
  }

  return { captureFile, configureServer, prepare, rememberBundle, rememberRoot, watchFiles }
}
