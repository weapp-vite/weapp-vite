import type { OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import type { Plugin, ResolvedConfig } from 'vite'
import type {
  Compiler,
  CompilerGenerateRequest,
  CompilerGenerateResult,
  CompilerSnapshot,
  CompilerTarget,
  CreateCompilerOptions,
} from 'weapp-tailwindcss/core'
import type { UserDefinedOptions } from 'weapp-tailwindcss/types'
import type { CompilerContext } from '../context'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import process from 'node:process'
import path from 'pathe'
import { parseSidecarSourceRequest } from '../moduleGraph/protocol'
import { safeGetPackageInfoSync } from '../runtime/localPkg'
import { changeFileExtension } from '../utils'
import { applyOutputChunkTransform } from '../utils/outputChunk'
import { normalizeFsResolvedId } from '../utils/resolvedId'
import { processCssWithCache } from './css/shared/preprocessor'
import { createStyleSourceMeta } from './css/styleOwnership'
import { resolveVueStyleSource } from './tailwindcss/vueStyle'
import {
  createManagedTailwindcssEntryMarker,
  createManagedTailwindcssOutputMarker,
  normalizeManagedTailwindcssEntryPath,
  registerManagedTailwindcssEntries,
  stripManagedTailwindcssOutputMarkers,
} from './tailwindcssMarker'
import { parseWeappVueStyleRequest } from './vue/transform/styleRequest'

const CORE_NODE_RANGE = '^22.18.0 || >=24.11.0'
const MANAGED_PLUGIN_NAME = 'weapp-vite:tailwindcss'
const TAILWIND_IMPORT_RE = /@import\s+(?:url\(\s*)?['"]tailwindcss['"]\s*\)?(?:\s|;|$)/
const TAILWIND_SOURCE_DIRECTIVE_RE = /@(?:config|custom-variant|layer|plugin|reference|source|tailwind|theme|utility|variant)\b/

interface TailwindV4SourcePattern {
  base: string
  pattern: string
  negated: boolean
}
type TailwindV4SourceOptions = Extract<CompilerGenerateRequest, { sourceOptions: unknown }>['sourceOptions'] & {
  sources?: TailwindV4SourcePattern[]
}
type TailwindcssRuntimeConfig = NonNullable<UserDefinedOptions['tailwindcss']>
type TailwindcssConfigWithNestedRuntime = TailwindcssRuntimeConfig & {
  tailwindcss?: TailwindcssRuntimeConfig
}
type ManagedTailwindcssOptions = UserDefinedOptions & Pick<CreateCompilerOptions, 'compiler'>

interface ResolvedManagedTailwindcssOptions {
  basedir: string
  cssEntries: string[]
  generatorTarget: CompilerTarget
  autoDetected: boolean
  options: ManagedTailwindcssOptions
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function resolveCssEntries(
  ctx: CompilerContext,
  options: ManagedTailwindcssOptions,
  basedir: string,
) {
  const tailwindcss = options.tailwindcss as TailwindcssConfigWithNestedRuntime | undefined
  const nestedTailwindcss = tailwindcss?.tailwindcss
  const entries = unique([
    ...(options.cssEntries ?? []),
    ...(options.tailwindcss?.v4?.cssEntries ?? []),
    ...(nestedTailwindcss?.v4?.cssEntries ?? []),
    ...(options.tailwindcssRuntimeOptions?.tailwindcss?.v4?.cssEntries ?? []),
  ]).map(entry => path.isAbsolute(entry) ? path.normalize(entry) : path.resolve(basedir, entry))

  return entries.length > 0
    ? entries
    : [path.resolve(ctx.configService.absoluteSrcRoot, 'app.css')]
}

export function resolveManagedTailwindcssOptions(
  ctx: CompilerContext,
): ResolvedManagedTailwindcssOptions | undefined {
  const input = ctx.configService.weappViteConfig?.tailwindcss
  if (input === undefined) {
    const packageInfo = safeGetPackageInfoSync('tailwindcss', { paths: [ctx.configService.cwd] })
    const version = packageInfo?.version
    if (!version || Number.parseInt(version.split('.')[0] ?? '', 10) !== 4) {
      return undefined
    }
    return {
      basedir: ctx.configService.cwd,
      cssEntries: [],
      generatorTarget: 'weapp',
      autoDetected: true,
      options: {
        appType: 'weapp-vite',
        platform: ctx.configService.platform,
        tailwindcssBasedir: ctx.configService.cwd,
      },
    }
  }
  if (input === false) {
    return undefined
  }
  const userOptions: ManagedTailwindcssOptions = input === true ? {} : input
  if (userOptions.disabled === true || (typeof userOptions.disabled === 'object' && userOptions.disabled.plugin === true)) {
    return undefined
  }
  const cwd = ctx.configService.cwd
  const basedir = userOptions.tailwindcssBasedir
    ? path.resolve(cwd, userOptions.tailwindcssBasedir)
    : cwd
  const cssEntries = resolveCssEntries(ctx, userOptions, basedir)
  const generatorTarget = typeof userOptions.generator === 'object' && userOptions.generator.target
    ? userOptions.generator.target
    : 'weapp'

  return {
    basedir,
    cssEntries,
    generatorTarget,
    autoDetected: false,
    options: {
      ...userOptions,
      appType: 'weapp-vite',
      cssEntries,
      platform: userOptions.platform ?? ctx.configService.platform,
      tailwindcssBasedir: basedir,
    },
  }
}

function outputAssetSource(asset: OutputAsset) {
  return typeof asset.source === 'string'
    ? asset.source
    : Buffer.from(asset.source).toString('utf8')
}

function parseManagedEntryIndex(id: string, entries: Map<string, number>) {
  const sourceId = normalizeFsResolvedId(id.split('?')[0], { stripLeadingNullByte: true })
  return entries.get(normalizeManagedTailwindcssEntryPath(sourceId))
}

function createTailwindV4SourceOptions(
  resolved: ResolvedManagedTailwindcssOptions,
  entry: string,
): TailwindV4SourceOptions {
  const configuredTailwindcss = resolved.options.tailwindcss as TailwindcssConfigWithNestedRuntime | undefined
  const tailwindcss = configuredTailwindcss?.tailwindcss ?? configuredTailwindcss
  const v4 = tailwindcss?.v4
  const runtimeV4 = resolved.options.tailwindcssRuntimeOptions?.tailwindcss?.v4
  return {
    projectRoot: resolved.basedir,
    cwd: tailwindcss?.cwd,
    base: v4?.base,
    cssSources: v4?.cssSources,
    cssEntries: [entry],
    sources: v4?.sources ?? runtimeV4?.sources,
    packageName: tailwindcss?.packageName ?? 'tailwindcss',
  }
}

function createCompilerRootId(index: number, entry: string) {
  return `weapp-vite:tailwindcss:${index}:${normalizeManagedTailwindcssEntryPath(entry)}`
}

function assertRuntimeRequirements(resolved: ResolvedManagedTailwindcssOptions) {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number)
  const supported = (major === 22 && minor >= 18) || (major >= 24 && (major > 24 || minor >= 11))
  if (!supported) {
    throw new Error(
      `weapp.tailwindcss requires Node ${CORE_NODE_RANGE}; current version is ${process.versions.node}.`,
    )
  }
  for (const entry of resolved.cssEntries) {
    if (!fs.existsSync(entry)) {
      throw new Error(`weapp.tailwindcss CSS entry does not exist: ${entry}`)
    }
  }
}

function hasTailwindImport(code: string) {
  return TAILWIND_IMPORT_RE.test(code)
}

export function createTailwindcssPlugin(ctx: CompilerContext): Plugin[] {
  registerManagedTailwindcssEntries(ctx, [])
  const managedOptions = resolveManagedTailwindcssOptions(ctx)
  if (!managedOptions) {
    return []
  }
  const resolved: ResolvedManagedTailwindcssOptions = managedOptions

  registerManagedTailwindcssEntries(ctx, resolved.cssEntries)
  const entryIndex = new Map(resolved.cssEntries.map((entry, index) => [normalizeManagedTailwindcssEntryPath(entry), index]))
  const requestSources = new Map<string, string>()
  const sourceSlots = new Map<string, number>()
  const claimedSlots = new Set<number>()
  const contextualSlots = new Set<number>()
  const dirtySlots = new Set<number>()
  const transformedSources = new Map<number, string>()
  const previousEntrySources = new Map<string, string>()
  const resolvedEntryIndexes = new Set<number>()
  const loadedEntryIndexes = new Set<number>()
  const compilerRootIds = new Map<number, string>()
  const compilerSourceOptions = new Map<number, TailwindV4SourceOptions>()
  const compilerSnapshots = new Map<number, CompilerSnapshot>()
  let generatedEntriesPromise: Promise<CompilerGenerateResult[]> | undefined
  let coreModulePromise: Promise<typeof import('weapp-tailwindcss/core')> | undefined
  let compilerPromise: Promise<Compiler> | undefined
  let resolvedConfig: ResolvedConfig | undefined
  let loaded = false
  let compilerDisposed = false

  function getSourceSlot(id: string, entry: number) {
    const style = parseWeappVueStyleRequest(id)
    const key = style ? `${style.filename}?style=${style.index}` : resolved.cssEntries[entry]!
    const existing = sourceSlots.get(key)
    if (existing !== undefined) {
      return existing
    }
    const index = claimedSlots.has(entry) ? resolved.cssEntries.push(resolved.cssEntries[entry]!) - 1 : entry
    sourceSlots.set(key, index)
    claimedSlots.add(index)
    if (style) {
      contextualSlots.add(index)
    }
    return index
  }

  function resolveAutoEntryIndex(id: string, code: string) {
    if (!resolved.autoDetected || !hasTailwindImport(code)) {
      return undefined
    }
    const sourceId = normalizeFsResolvedId(id.split('?')[0], { stripLeadingNullByte: true })
    if (!sourceId || !/\.(?:css|pcss|postcss|sss|scss|sass|less|styl|stylus)$/.test(sourceId)) {
      return undefined
    }
    const normalizedEntry = normalizeManagedTailwindcssEntryPath(sourceId)
    const existingIndex = entryIndex.get(normalizedEntry)
    if (existingIndex !== undefined) {
      return existingIndex
    }
    const index = resolved.cssEntries.length
    resolved.cssEntries.push(sourceId)
    entryIndex.set(normalizedEntry, index)
    registerManagedTailwindcssEntries(ctx, resolved.cssEntries)
    return index
  }

  function getCoreModule() {
    coreModulePromise ??= import('weapp-tailwindcss/core')
    return coreModulePromise
  }

  async function getCompiler() {
    compilerPromise ??= getCoreModule().then(({ createCompiler }) => createCompiler(resolved.options))
    const compiler = await compilerPromise
    if (!loaded) {
      loaded = true
      resolved.options.onLoad?.()
    }
    return compiler
  }

  async function stripResidualTailwindSourceDirectives(css: string) {
    if (!TAILWIND_SOURCE_DIRECTIVE_RE.test(css)) {
      return css
    }
    const { postcss, removeTailwindSourceDirectivesRoot } = await getCoreModule()
    const root = postcss.parse(css)
    removeTailwindSourceDirectivesRoot(root)
    return root.toString()
  }

  async function generateEntryCss(compiler: Compiler, index: number, entry: string) {
    if (dirtySlots.has(index)) {
      throw new Error(`Tailwind CSS entry must be transformed after invalidation: ${entry}`)
    }
    const configuredSource = createTailwindV4SourceOptions(resolved, entry)
    const transformedSource = transformedSources.get(index)
    const sourceOptions = transformedSource === undefined
      ? compilerSourceOptions.get(index) ?? configuredSource
      : {
          ...configuredSource,
          cssEntries: [],
          cssSources: [
            ...(configuredSource.cssSources ?? []),
            { css: transformedSource, file: entry, base: path.dirname(entry), dependencies: [entry] },
          ],
        }
    compilerSourceOptions.set(index, sourceOptions)
    const id = compilerRootIds.get(index) ?? createCompilerRootId(index, entry)
    compilerRootIds.set(index, id)
    const generated = await compiler.generate({
      id,
      sourceOptions,
      target: resolved.generatorTarget,
      scanSources: true,
      bareArbitraryValues: resolved.options.arbitraryValues?.bareArbitraryValues,
      styleOptions: typeof resolved.options.generator === 'object'
        ? resolved.options.generator.styleOptions
        : undefined,
    })
    compilerSnapshots.set(index, generated.snapshot)
    return generated
  }

  async function disposeCompiler() {
    if (compilerDisposed) {
      return
    }
    compilerDisposed = true
    await compilerPromise?.then(compiler => compiler.dispose())
  }

  async function invalidateCompilerForFile(id: string, event: 'create' | 'update' | 'delete') {
    const compiler = await getCompiler()
    const normalizedId = normalizeFsResolvedId(id.split('?')[0], { stripLeadingNullByte: true })
    const indexes = resolved.cssEntries.flatMap((entry, index) =>
      normalizeManagedTailwindcssEntryPath(entry) === normalizeManagedTailwindcssEntryPath(normalizedId) ? [index] : [],
    )
    generatedEntriesPromise = undefined
    for (const index of indexes) {
      compilerSourceOptions.delete(index)
      if (event === 'delete') {
        const rootId = compilerRootIds.get(index)
        if (rootId) {
          await compiler.remove(rootId)
        }
        transformedSources.delete(index)
        dirtySlots.delete(index)
      }
      else if (transformedSources.has(index)) {
        dirtySlots.add(index)
      }
    }
    if (event === 'delete' && indexes.length > 0) {
      return
    }
    compiler.invalidate([normalizedId])
  }

  function prepareBundleStyles(bundle: OutputBundle) {
    for (const output of Object.values(bundle)) {
      if (output.type !== 'asset') {
        continue
      }
      const originalSource = outputAssetSource(output)
      let source = originalSource
      for (let index = 0; index < resolved.cssEntries.length; index++) {
        source = source.replaceAll(
          createManagedTailwindcssEntryMarker(index),
          createManagedTailwindcssOutputMarker(index),
        )
      }
      if (source !== originalSource) {
        output.source = source
      }
    }
  }

  async function transformBundle(this: any, bundle: OutputBundle) {
    if (resolved.autoDetected && resolved.cssEntries.length === 0) {
      return
    }
    const compiler = await getCompiler()
    const generatedEntries = resolved.options.generator === false
      ? []
      : await (generatedEntriesPromise ??= Promise.all(resolved.cssEntries.map((entry, index) =>
          generateEntryCss(compiler, index, entry))))
    const snapshots = generatedEntries.length > 0
      ? generatedEntries.map((generated, index) => compilerSnapshots.get(index) ?? generated.snapshot)
      : [compiler.createSnapshot({
          id: `${MANAGED_PLUGIN_NAME}:disabled`,
          classSet: [],
          target: resolved.generatorTarget,
        })]
    const snapshot = compiler.mergeSnapshots(snapshots)
    const seenEntries = new Set<number>()
    const styleExtension = ctx.configService.outputExtensions.wxss
    const templateExtension = ctx.configService.outputExtensions.wxml
    const scriptSourceMap = Boolean(resolvedConfig?.build.sourcemap)

    for (const output of Object.values(bundle)) {
      if (output.type !== 'asset') {
        continue
      }
      let source = outputAssetSource(output)
      let hasManagedEntry = false
      let isMainChunk = output.fileName === `app.${styleExtension}`
      for (let index = 0; index < generatedEntries.length; index++) {
        const marker = createManagedTailwindcssEntryMarker(index)
        const outputMarker = createManagedTailwindcssOutputMarker(index)
        const hasEntryMarker = source.includes(marker)
        const hasOutputMarker = source.includes(outputMarker)
        const expectedOutputFile = typeof ctx.configService.relativeOutputPath === 'function'
          ? ctx.configService.relativeOutputPath(
              changeFileExtension(resolved.cssEntries[index]!, styleExtension),
            )
          : undefined
        const isCanonicalOutput = !contextualSlots.has(index) && expectedOutputFile !== undefined
          && normalizeManagedTailwindcssEntryPath(expectedOutputFile) === normalizeManagedTailwindcssEntryPath(output.fileName)
        if (!hasEntryMarker && !hasOutputMarker && !isCanonicalOutput) {
          continue
        }
        const generated = generatedEntries[index]!
        const generatedCss = await processCssWithCache(generated.css, ctx.configService)
        hasManagedEntry = true
        isMainChunk ||= normalizeManagedTailwindcssEntryPath(resolved.cssEntries[index]!)
          === normalizeManagedTailwindcssEntryPath(path.resolve(ctx.configService.absoluteSrcRoot, 'app.css'))
        seenEntries.add(index)
        // 入口标记随 owner 的 emitFile 合并或改名，生成 CSS 只在最后输出阶段注入。
        if (hasEntryMarker || hasOutputMarker) {
          const pendingMarker = hasEntryMarker ? marker : outputMarker
          const markerIndex = source.indexOf(pendingMarker)
          source = source.slice(0, markerIndex)
            + generatedCss
            + source.slice(markerIndex + pendingMarker.length)
          source = source.replaceAll(marker, '').replaceAll(outputMarker, '')
        }
        else {
          source = `${generatedCss}\n${source}`
        }
        for (const dependency of generated.dependencies) {
          this.addWatchFile(dependency)
        }
      }
      if (!hasManagedEntry && !output.fileName.endsWith(`.${styleExtension}`)) {
        continue
      }
      const transformed = await compiler.transformCss(source, snapshot, {
        isMainChunk,
      })
      output.source = stripManagedTailwindcssOutputMarkers(
        await stripResidualTailwindSourceDirectives(transformed.css),
      )
    }

    if (!ctx.configService.isDev && resolved.options.generator !== false) {
      const stages = resolved.cssEntries.flatMap((entry, index) =>
        (resolvedEntryIndexes.has(index) || loadedEntryIndexes.has(index)) && !seenEntries.has(index)
          ? [`${entry} (resolved: ${resolvedEntryIndexes.has(index)}, loaded: ${loadedEntryIndexes.has(index)})`]
          : [],
      )
      if (stages.length > 0) {
        throw new Error(`weapp.tailwindcss CSS entries must be imported by the build graph: ${stages.join(', ')}`)
      }
    }

    for (const output of Object.values(bundle)) {
      if (output.type === 'asset' && output.fileName.endsWith(`.${templateExtension}`)) {
        output.source = await compiler.transformTemplate(outputAssetSource(output), snapshot, {
          filename: output.fileName,
        })
        continue
      }
      if (output.type !== 'chunk' || !output.fileName.endsWith('.js')) {
        continue
      }
      const transformed = await compiler.transformJavaScript(output.code, snapshot, {
        filename: output.fileName,
        generateMap: scriptSourceMap,
      })
      if (transformed.error) {
        throw transformed.error
      }
      applyOutputChunkTransform(output as OutputChunk, transformed.code, transformed.map as any)
    }
  }

  const managerPlugin: Plugin = {
    name: MANAGED_PLUGIN_NAME,
    enforce: 'pre',
    generateBundle: {
      order: 'pre',
      handler(_options, bundle) {
        generatedEntriesPromise = undefined
        prepareBundleStyles(bundle as unknown as OutputBundle)
      },
    },
    async buildStart() {
      generatedEntriesPromise = undefined
      assertRuntimeRequirements(resolved)
      if (ctx.configService.isDev) {
        const pendingChanges = ctx.moduleGraphService?.getPendingChanges?.() ?? []
        if (pendingChanges.length > 0) {
          await Promise.all(pendingChanges.map(change => invalidateCompilerForFile(change.file, change.event as 'create' | 'update' | 'delete')))
        }
      }
      resolvedEntryIndexes.clear()
      loadedEntryIndexes.clear()
      for (const entry of resolved.cssEntries) {
        this.addWatchFile(entry)
      }
    },
    configResolved(config) {
      resolvedConfig = config
    },
    resolveId(source) {
      if (resolved.options.generator === false) {
        return null
      }
      const sidecar = parseSidecarSourceRequest(source)
      if (!sidecar) {
        const styleRequest = parseWeappVueStyleRequest(source)
        if (!styleRequest) {
          return null
        }
        return resolveVueStyleSource(styleRequest, this.resolve.bind(this)).then((sourceId) => {
          if (!sourceId) {
            return null
          }
          requestSources.set(source, sourceId)
          const queryIndex = source.indexOf('?')
          requestSources.set(`${styleRequest.filename}${source.slice(queryIndex)}`, sourceId)
          let index = parseManagedEntryIndex(sourceId, entryIndex)
          if (index === undefined && resolved.autoDetected) {
            try {
              index = resolveAutoEntryIndex(sourceId, fs.readFileSync(sourceId, 'utf8'))
            }
            catch {
              return null
            }
          }
          if (index === undefined) {
            return null
          }
          resolvedEntryIndexes.add(index)
          return source
        })
      }
      if (sidecar.kind !== 'style' || sidecar.dependencyOnly) {
        return null
      }
      let index = entryIndex.get(normalizeManagedTailwindcssEntryPath(sidecar.sourceId))
      if (index === undefined && resolved.autoDetected) {
        try {
          index = resolveAutoEntryIndex(sidecar.sourceId, fs.readFileSync(sidecar.sourceId, 'utf8'))
        }
        catch {
          // 入口不存在或正在被删除时交给后续模块解析处理。
        }
      }
      if (index === undefined) {
        return null
      }
      resolvedEntryIndexes.add(index)
      requestSources.set(source, sidecar.sourceId)
      return source
    },
    load(id) {
      if (resolved.options.generator === false || parseSidecarSourceRequest(id)?.dependencyOnly || parseWeappVueStyleRequest(id)) {
        return null
      }
      const normalizedId = normalizeManagedTailwindcssEntryPath(requestSources.get(id) ?? id.split('?')[0]!)
      const index = entryIndex.get(normalizedId)
      if (index === undefined) {
        return null
      }
      loadedEntryIndexes.add(index)
      const code = fs.readFileSync(normalizedId, 'utf8')
      const previous = previousEntrySources.get(normalizedId)
      if (previous !== undefined && previous !== code) {
        resolved.options.onUpdate?.(normalizedId, previous, code)
      }
      previousEntrySources.set(normalizedId, code)
      // load 只提供原文，用户 pre 插件必须先看到真实 CSS；占位发生在后续 transform。
      return code
    },
    transform(code, id) {
      if (resolved.options.generator === false || parseSidecarSourceRequest(id)?.dependencyOnly) {
        return null
      }
      const sourceId = requestSources.get(id) ?? id
      const entry = parseManagedEntryIndex(sourceId, entryIndex) ?? resolveAutoEntryIndex(sourceId, code)
      if (entry === undefined) {
        return null
      }
      const index = getSourceSlot(id, entry)
      dirtySlots.delete(index)
      loadedEntryIndexes.add(index)
      if (transformedSources.get(index) !== code) {
        transformedSources.set(index, code)
        compilerSourceOptions.delete(index)
        generatedEntriesPromise = undefined
      }
      const previousSources: unknown = this.getModuleInfo?.(id)?.meta.weappViteStyleSources
      return {
        code: createManagedTailwindcssEntryMarker(index),
        map: null,
        meta: createStyleSourceMeta([
          resolved.cssEntries[index]!,
          ...(Array.isArray(previousSources) ? previousSources.filter((source): source is string => typeof source === 'string') : []),
        ]),
      }
    },
    shouldTransformCachedModule({ id }) {
      const sourceId = requestSources.get(id) ?? id
      const index = parseManagedEntryIndex(sourceId, entryIndex)
      if (index !== undefined && dirtySlots.has(getSourceSlot(id, index))) {
        return true
      }
    },
    async watchChange(id, change) {
      await invalidateCompilerForFile(id, change.event)
    },
    async handleHotUpdate({ file }) {
      await invalidateCompilerForFile(file, 'update')
    },
    async closeWatcher() {
      await disposeCompiler()
    },
  }

  const outputPlugin: Plugin = {
    name: `${MANAGED_PLUGIN_NAME}:output`,
    enforce: 'post',
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        resolved.options.onStart?.()
        try {
          await transformBundle.call(this, bundle as unknown as OutputBundle)
        }
        finally {
          resolved.options.onEnd?.()
        }
      },
    },
    async closeBundle() {
      if (!ctx.configService.isDev) {
        await disposeCompiler()
      }
    },
  }

  return [managerPlugin, outputPlugin]
}
