import type { OutputBundle } from 'rolldown'
import type { ViteDevServer } from 'vite'
import type { Compiler, CompilerGenerateRequest, CompilerGenerateResult, CompilerSnapshot } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation, WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { createTailwindV4CompiledSourceEntries, createTailwindV4SourceEntryMatcher, resolveProjectSourceFiles } from '@weapp-tailwindcss/engine'
import path from 'pathe'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { changeFileExtension } from '../../utils/file'
import { resolveOutputExtensions } from '../../utils/outputExtensions'
import { isPathInside } from '../../utils/path'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { labelSourceMapInput } from '../../utils/sourcemap'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { findManagedTailwindcssEntryMarker, hasManagedTailwindcssOutputMarker } from '../tailwindcssMarker'

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
  const isCompilerAsset = (file: string) => file.endsWith(`.${extensions.styleExtension}`) || file.endsWith(`.${extensions.templateExtension}`)
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
    const next = { ...originalBundle }
    for (const [file, output] of Object.entries(bundle)) {
      if (output.type === 'asset' && isCompilerAsset(file)) {
        next[file] = { ...output }
      }
    }
    originalBundle = next
  }

  const captured = new WeakMap<WeappCompilerHmrRequest, { roots: Map<number, Root>, bundle: OutputBundle }>()
  const generatedRoots = new WeakMap<Root, { signature: string, result: CompilerGenerateResult }>()

  async function prepare(request: WeappCompilerHmrRequest): Promise<WeappCompilerHmrPreparation> {
    let input = captured.get(request)
    if (!input) {
      input = { roots: new Map(roots), bundle: originalBundle }
      captured.set(request, input)
    }
    const compiler = await options.compiler()
    const entries: CompilerGenerateResult[] = []
    for (const [index, root] of input.roots) {
      const base = root.request.sourceOptions?.projectRoot ?? root.request.source?.base ?? ctx.configService.cwd
      const matches = createTailwindV4SourceEntryMatcher(createTailwindV4CompiledSourceEntries(
        root.result.root,
        [...root.result.sources],
        base,
      ))
      const sources = [...request.sources].flatMap(([file, content]) => content !== null && matches?.(file)
        && !(ctx.configService.outDir && isPathInside(ctx.configService.outDir, file))
        ? [{ content, extension: path.extname(file).slice(1) }]
        : [])
      const sourceOptions = root.request.sourceOptions
      if (!sourceOptions) {
        throw new Error('Tailwind HMR requires a captured source entry')
      }
      const cssSources = sourceOptions.cssSources?.map((source) => {
        if (!source.file) {
          return source
        }
        const id = compilerSourceId(source.file ?? '')
        const raw = request.sources.get(id)
        const previous = root.rawSources.get(id)
        if (raw === previous || raw === undefined) {
          return source
        }
        if (typeof raw === 'string' && typeof previous === 'string' && id.endsWith('.vue')
          && resolveVueSfcHmrSignatures(raw, id).blockSignatures?.style === resolveVueSfcHmrSignatures(previous, id).blockSignatures?.style) {
          return source
        }
        if (typeof raw !== 'string' || source.css !== previous) {
          throw new CompilerHmrResyncError(request.changedFiles, 'Compiler root requires a new preprocessed input')
        }
        return { ...source, css: raw }
      })
      const entrySources = (sourceOptions.cssEntries ?? []).map((file) => {
        const css = request.sources.get(compilerSourceId(file))
        if (typeof css !== 'string') {
          throw new TypeError(`Missing captured Tailwind CSS input: ${file}`)
        }
        return { file, css, base: path.dirname(file), dependencies: [file] }
      })
      const memoryRoots = new Set([...cssSources ?? [], ...entrySources].flatMap(source => source.file ? [compilerSourceId(source.file)] : []))
      const dependencyVersions = new Map<string, string>()
      const checkDependency = (file: string) => {
        const id = compilerSourceId(file)
        if (memoryRoots.has(id)) {
          return
        }
        const expected = request.sources.get(id)
        const source = readFileSync(file, 'utf8')
        const stat = statSync(file, { bigint: true })
        const version = `${stat.mtimeNs}:${stat.ctimeNs}:${stat.ino}:${stat.size}`
        if (expected !== source || (dependencyVersions.has(id) && dependencyVersions.get(id) !== version)) {
          throw new CompilerHmrResyncError(request.changedFiles, 'Compiler dependency changed outside the captured input view')
        }
        dependencyVersions.set(id, version)
      }
      for (const file of root.result.dependencies) {
        checkDependency(file)
      }
      const signature = createHash('sha256').update(JSON.stringify([cssSources, entrySources, sources, [...dependencyVersions]])).digest('hex')
      const cached = generatedRoots.get(root)
      // 候选由 core 从完整内存来源提取；后续磁盘保存不能参与本次扫描。
      entries[index] = cached?.signature === signature
        ? cached.result
        : await compiler.generate({
            ...root.request,
            sourceOptions: { ...sourceOptions, cssEntries: [], cssSources: [...cssSources ?? [], ...entrySources] },
            sources,
            scanSources: false,
          })
      for (const file of entries[index]!.dependencies) {
        checkDependency(file)
      }
      generatedRoots.set(root, { signature, result: entries[index]! })
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
    if (!assets.length && entries.some(entry => entry.css.trim().length > 0)) {
      throw new CompilerHmrResyncError(request.changedFiles, 'Tailwind HMR 没有可提交的样式归属，需要完整重同步。')
    }
    return {
      assets,
      dependencies: snapshot.dependencies,
      transformTemplate: async ({ code, fileName }) => ({
        code: await compiler.transformTemplate(code, snapshot, { filename: fileName }),
      }),
      transformJavaScript: async ({ code, fileName }) => {
        const transformed = await compiler.transformJavaScript(code, snapshot, { filename: fileName, generateMap: true })
        if (transformed.error) {
          throw transformed.error
        }
        return { code: transformed.code, map: labelSourceMapInput(transformed.map, fileName, code) }
      },
    }
  }

  return { captureFile, configureServer, prepare, rememberBundle, rememberRoot, watchFiles }
}
