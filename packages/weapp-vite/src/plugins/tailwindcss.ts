import type { OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import type { Plugin, ResolvedConfig } from 'vite'
import type { createContext as createTailwindContext, UserDefinedOptions } from 'weapp-tailwindcss/core'
import type { TailwindV4SourceOptions, WeappTailwindcssGeneratorTarget } from 'weapp-tailwindcss/generator'
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
import {
  createManagedTailwindcssEntryMarker,
  createManagedTailwindcssOutputMarker,
  normalizeManagedTailwindcssEntryPath,
  registerManagedTailwindcssEntries,
  stripManagedTailwindcssOutputMarkers,
} from './tailwindcssMarker'

const CORE_NODE_RANGE = '^22.18.0 || >=24.11.0'
const MANAGED_PLUGIN_NAME = 'weapp-vite:tailwindcss'
const VIRTUAL_ENTRY_PREFIX = '\0weapp-vite:managed-tailwindcss-entry:'
const TAILWIND_IMPORT_RE = /@import\s+(?:url\(\s*)?['"]tailwindcss['"]\s*\)?(?:\s|;|$)/

type TailwindCoreContext = ReturnType<typeof createTailwindContext>

interface ResolvedManagedTailwindcssOptions {
  basedir: string
  cssEntries: string[]
  generatorTarget: WeappTailwindcssGeneratorTarget
  autoDetected: boolean
  options: UserDefinedOptions
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function resolveCssEntries(
  ctx: CompilerContext,
  options: UserDefinedOptions,
  basedir: string,
) {
  const entries = unique([
    ...(options.cssEntries ?? []),
    ...(options.tailwindcss?.v4?.cssEntries ?? []),
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
  const userOptions: UserDefinedOptions = input === true ? {} : input
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

function createVirtualEntryId(index: number, source: string) {
  const queryIndex = source.indexOf('?')
  const query = queryIndex >= 0 ? source.slice(queryIndex) : ''
  return `${VIRTUAL_ENTRY_PREFIX}${index}.css${query}`
}

function parseVirtualEntryIndex(id: string) {
  if (!id.startsWith(VIRTUAL_ENTRY_PREFIX)) {
    return undefined
  }
  const value = Number.parseInt(id.slice(VIRTUAL_ENTRY_PREFIX.length), 10)
  return Number.isInteger(value) ? value : undefined
}

function parseManagedEntryIndex(id: string, entries: Map<string, number>) {
  const sourceId = normalizeFsResolvedId(id.split('?')[0], { stripLeadingNullByte: true })
  return entries.get(normalizeManagedTailwindcssEntryPath(sourceId))
}

function isVueStyleModuleId(id: string) {
  return id.includes('?weapp-vite-vue&type=style&')
}

function resolveManagedEntryIndex(
  id: string,
  code: string,
  entries: Map<string, number>,
) {
  const directIndex = parseManagedEntryIndex(id, entries)
  if (directIndex !== undefined || !isVueStyleModuleId(id)) {
    return directIndex
  }
  for (const [entry, index] of entries) {
    try {
      if (fs.readFileSync(entry, 'utf8') === code) {
        return index
      }
    }
    catch {
      // buildStart 已校验入口存在，这里忽略 HMR 期间的瞬时读取失败。
    }
  }
}

function createTailwindV4SourceOptions(
  resolved: ResolvedManagedTailwindcssOptions,
  entry: string,
): TailwindV4SourceOptions {
  const tailwindcss = resolved.options.tailwindcss
  const v4 = tailwindcss?.v4
  return {
    projectRoot: resolved.basedir,
    cwd: tailwindcss?.cwd,
    base: v4?.base,
    cssSources: v4?.cssSources,
    cssEntries: [entry],
    packageName: tailwindcss?.packageName ?? 'tailwindcss',
  }
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

async function stripTailwindSourceDirectives(css: string) {
  if (!/@(?:config|custom-variant|layer|plugin|reference|source|tailwind|theme|utility|variant)\b/.test(css)) {
    return css
  }
  const {
    postcss,
    removeTailwindSourceDirectivesRoot,
  } = await import('@weapp-tailwindcss/postcss')
  const root = postcss.parse(css)
  removeTailwindSourceDirectivesRoot(root)
  return root.toString()
}

export function createTailwindcssPlugin(ctx: CompilerContext): Plugin[] {
  const resolved = resolveManagedTailwindcssOptions(ctx)
  if (!resolved) {
    return []
  }

  registerManagedTailwindcssEntries(ctx, resolved.cssEntries)
  const entryIndex = new Map(resolved.cssEntries.map((entry, index) => [normalizeManagedTailwindcssEntryPath(entry), index]))
  const previousEntrySources = new Map<string, string>()
  const resolvedEntryIndexes = new Set<number>()
  const loadedEntryIndexes = new Set<number>()
  const previousGeneratedCss = new Map<number, string>()
  const generatedOutputEntries = new Map<string, Set<number>>()
  let generatedEntriesPromise: Promise<Awaited<ReturnType<typeof generateEntryCss>>[]> | undefined
  let coreContextPromise: Promise<TailwindCoreContext> | undefined
  let resolvedConfig: ResolvedConfig | undefined
  let loaded = false

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

  async function getCoreContext() {
    coreContextPromise ??= import('weapp-tailwindcss/core').then(({ createContext }) => createContext(resolved.options))
    const coreContext = await coreContextPromise
    if (!loaded) {
      loaded = true
      resolved.options.onLoad?.()
    }
    return coreContext
  }

  async function generateEntryCss(entry: string) {
    const {
      createWeappTailwindcssGenerator,
      resolveTailwindV4Source,
    } = await import('weapp-tailwindcss/generator')
    const source = await resolveTailwindV4Source(createTailwindV4SourceOptions(resolved, entry))
    const generator = createWeappTailwindcssGenerator(source)
    try {
      const generated = await generator.generate({
        target: resolved.generatorTarget,
        scanSources: true,
        bareArbitraryValues: resolved.options.arbitraryValues?.bareArbitraryValues,
        styleOptions: typeof resolved.options.generator === 'object'
          ? resolved.options.generator.styleOptions
          : undefined,
      })
      if (generated.target !== 'weapp') {
        return generated
      }
      const { finalizeMiniProgramCss } = await import('@weapp-tailwindcss/postcss')
      return {
        ...generated,
        css: finalizeMiniProgramCss(generated.css, { isTailwindcssV4: true }),
      }
    }
    finally {
      generator.dispose?.()
    }
  }

  async function transformBundle(this: any, bundle: OutputBundle, options: { styles?: boolean, templates?: boolean } = {}) {
    if (resolved.autoDetected && resolved.cssEntries.length === 0) {
      return
    }
    const transformStyles = options.styles !== false
    const transformTemplates = options.templates !== false
    const coreContext = await getCoreContext()
    const generatedEntries = resolved.options.generator === false
      ? []
      : await (generatedEntriesPromise ??= Promise.all(resolved.cssEntries.map(generateEntryCss)))
    const seenEntries = new Set<number>()
    const styleExtension = ctx.configService.outputExtensions.wxss
    const templateExtension = ctx.configService.outputExtensions.wxml
    const scriptSourceMap = Boolean(resolvedConfig?.build.sourcemap)

    for (const output of Object.values(bundle)) {
      if (!transformStyles) {
        break
      }
      if (output.type !== 'asset') {
        continue
      }
      let source = outputAssetSource(output)
      source = await stripTailwindSourceDirectives(source)
      let hasManagedEntry = false
      let isMainChunk = output.fileName === `app.${styleExtension}`
      for (let index = 0; index < generatedEntries.length; index++) {
        const marker = createManagedTailwindcssEntryMarker(index)
        const outputMarker = createManagedTailwindcssOutputMarker(index)
        const hasEntryMarker = source.includes(marker)
        const hasOutputMarker = source.includes(outputMarker)
        const previousCss = previousGeneratedCss.get(index)
        const outputEntries = generatedOutputEntries.get(output.fileName)
        const isTrackedOutput = outputEntries?.has(index) === true
        const expectedOutputFile = typeof ctx.configService.relativeOutputPath === 'function'
          ? ctx.configService.relativeOutputPath(
              changeFileExtension(resolved.cssEntries[index]!, styleExtension),
            )
          : undefined
        const isCanonicalOutput = expectedOutputFile !== undefined
          && normalizeManagedTailwindcssEntryPath(expectedOutputFile) === normalizeManagedTailwindcssEntryPath(output.fileName)
        if (!hasEntryMarker && !hasOutputMarker && !isTrackedOutput && !isCanonicalOutput) {
          continue
        }
        const generated = generatedEntries[index]!
        hasManagedEntry = true
        isMainChunk ||= normalizeManagedTailwindcssEntryPath(resolved.cssEntries[index]!)
          === normalizeManagedTailwindcssEntryPath(path.resolve(ctx.configService.absoluteSrcRoot, 'app.css'))
        seenEntries.add(index)
        const replacement = `${outputMarker}\n${generated.css}`
        if (hasEntryMarker) {
          const markerIndex = source.indexOf(marker)
          source = source.slice(0, markerIndex)
            + replacement
            + source.slice(markerIndex + marker.length).replaceAll(marker, '')
        }
        else if (previousCss !== undefined) {
          source = source.includes(outputMarker)
            ? source.replace(`${outputMarker}\n${previousCss}`, replacement)
            : `${replacement}\n${source}`
        }
        else if (isCanonicalOutput) {
          source = `${replacement}\n${await stripTailwindSourceDirectives(source)}`
        }
        else {
          source = source.replace(outputMarker, replacement)
        }
        previousGeneratedCss.set(index, generated.css)
        const trackedEntries = generatedOutputEntries.get(output.fileName) ?? new Set<number>()
        trackedEntries.add(index)
        generatedOutputEntries.set(output.fileName, trackedEntries)
        for (const dependency of generated.dependencies) {
          this.addWatchFile(dependency)
        }
      }
      if (!hasManagedEntry && !output.fileName.endsWith(`.${styleExtension}`)) {
        continue
      }
      const transformed = await coreContext.transformWxss(source, {
        isMainChunk,
      })
      output.source = stripManagedTailwindcssOutputMarkers(transformed.css)
    }

    if (transformStyles && !ctx.configService.isDev && resolved.options.generator !== false) {
      const activeEntries = resolved.cssEntries.filter((_entry, index) =>
        resolvedEntryIndexes.has(index) || loadedEntryIndexes.has(index),
      )
      const missing = activeEntries.filter(entry => !seenEntries.has(resolved.cssEntries.indexOf(entry)))
      const stages = missing.map((entry) => {
        const index = resolved.cssEntries.indexOf(entry)
        return `${entry} (resolved: ${resolvedEntryIndexes.has(index)}, loaded: ${loadedEntryIndexes.has(index)})`
      })
      if (stages.length > 0) {
        throw new Error(`weapp.tailwindcss CSS entries must be imported by the build graph: ${stages.join(', ')}`)
      }
    }

    if (!transformTemplates) {
      return
    }
    const runtimeSet = await coreContext.getRuntimeSet({ forceCollect: true, forceRefresh: true })
    for (const output of Object.values(bundle)) {
      if (output.type === 'asset' && output.fileName.endsWith(`.${templateExtension}`)) {
        output.source = await coreContext.transformWxml(outputAssetSource(output), { runtimeSet })
        continue
      }
      if (output.type !== 'chunk' || !output.fileName.endsWith('.js')) {
        continue
      }
      const transformed = await coreContext.transformJs(output.code, {
        filename: output.fileName,
        generateMap: scriptSourceMap,
        runtimeSet,
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
      async handler(_options, bundle) {
        generatedEntriesPromise = undefined
        resolved.options.onStart?.()
        try {
          await transformBundle.call(this, bundle as unknown as OutputBundle, { templates: false })
        }
        finally {
          resolved.options.onEnd?.()
        }
      },
    },
    buildStart() {
      assertRuntimeRequirements(resolved)
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
      if (!sidecar || sidecar.kind !== 'style') {
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
      return createVirtualEntryId(index, source)
    },
    load(id) {
      if (resolved.options.generator === false) {
        return null
      }
      const virtualIndex = parseVirtualEntryIndex(id)
      const normalizedId = virtualIndex === undefined
        ? normalizeFsResolvedId(id.split('?')[0])
        : normalizeFsResolvedId(resolved.cssEntries[virtualIndex] ?? '')
      const index = virtualIndex ?? entryIndex.get(normalizedId)
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
      return createManagedTailwindcssEntryMarker(index)
    },
    transform(code, id) {
      if (resolved.options.generator === false) {
        return null
      }
      const index = resolveManagedEntryIndex(id, code, entryIndex) ?? resolveAutoEntryIndex(id, code)
      if (index === undefined) {
        return null
      }
      loadedEntryIndexes.add(index)
      return {
        code: createManagedTailwindcssEntryMarker(index),
        map: null,
      }
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
          await transformBundle.call(this, bundle as unknown as OutputBundle, { styles: false })
        }
        finally {
          resolved.options.onEnd?.()
        }
      },
    },
  }

  return [managerPlugin, outputPlugin]
}
