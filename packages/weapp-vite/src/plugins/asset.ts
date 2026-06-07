import type { OutputBundle } from 'rolldown'
import type { Plugin, ResolvedConfig } from 'vite'
import type { BuildTarget, CompilerContext } from '../context'
import type { CopyGlobs } from '../types'
import { Buffer } from 'node:buffer'
import {
  WEVU_SLOT_NAMES_PROP,
  WEVU_SLOT_OWNER_ID_ATTR,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_PROPS_ATTR,
  WEVU_SLOT_SCOPE_ATTR,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/fs'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import picomatch from 'picomatch'
import { defaultAssetExtensions, defaultExcluded } from '../defaults'
import { resolveJson, WEAPP_SCOPED_SLOT_GENERIC_COMPONENT_PLACEHOLDER } from '../utils'
import { normalizePath, toPosixPath } from '../utils/path'
import { emitAlipayGenericPlaceholderAssetsByBase, resolveWeappScopedSlotGenericPlaceholderBase } from './vue/transform/bundle/platform'
import { injectScopedSlotHostPropertiesInJs } from './vue/transform/injectSetDataPick'

interface AssetPluginState {
  ctx: CompilerContext
  buildTarget: BuildTarget
  resolvedConfig?: ResolvedConfig
  pendingAssets?: Promise<string[]>
}

function normalizeCopyGlobs(globs?: CopyGlobs): string[] {
  return Array.isArray(globs) ? globs : []
}

function stripQueryAndHash(value: string) {
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  const endIndex = [queryIndex, hashIndex]
    .filter(index => index >= 0)
    .reduce((min, index) => Math.min(min, index), Number.POSITIVE_INFINITY)
  return Number.isFinite(endIndex) ? value.slice(0, endIndex) : value
}

function createPathMatcher(patterns: string[], options?: picomatch.PicomatchOptions) {
  if (!patterns.length) {
    return () => false
  }

  return picomatch(patterns.map(pattern => normalizePath(pattern)), options)
}

function createAssetPathVariants(file: string, roots: string[]) {
  const variants = [file]
  for (const root of roots) {
    const relative = path.relative(root, file)
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      variants.push(relative)
    }
  }
  return variants.map(variant => normalizePath(variant))
}

function parseJsonBuffer(buffer: Buffer) {
  try {
    const parsed = JSON.parse(buffer.toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }
    return parsed as Record<string, any>
  }
  catch {
    return undefined
  }
}

function getScopedSlotGenericKeys(ctx: CompilerContext, fileName: string) {
  const componentBase = `/${toPosixPath(fileName.replace(/\.(?:json|wxml|js)$/, ''))}`
  return ctx.runtimeState.asset.scopedSlotGenerics.get(componentBase)
}

function withScopedSlotComponentGenerics(
  ctx: CompilerContext,
  fileName: string,
  buffer: Buffer,
) {
  const keys = getScopedSlotGenericKeys(ctx, fileName)
  if (!keys?.size) {
    return buffer
  }

  const parsed = parseJsonBuffer(buffer)
  if (!parsed) {
    return buffer
  }

  const componentGenerics = parsed.componentGenerics && typeof parsed.componentGenerics === 'object' && !Array.isArray(parsed.componentGenerics)
    ? { ...parsed.componentGenerics }
    : {}
  for (const key of keys) {
    if (!componentGenerics[key]) {
      componentGenerics[key] = {
        default: WEAPP_SCOPED_SLOT_GENERIC_COMPONENT_PLACEHOLDER,
      }
      continue
    }
    if (componentGenerics[key] === true) {
      continue
    }
    if (typeof componentGenerics[key] === 'object' && !Array.isArray(componentGenerics[key])) {
      const value = componentGenerics[key]
      componentGenerics[key] = typeof value.default === 'string' && value.default.trim()
        ? { ...value }
        : {
            ...value,
            default: WEAPP_SCOPED_SLOT_GENERIC_COMPONENT_PLACEHOLDER,
          }
      continue
    }
  }
  parsed.componentGenerics = componentGenerics

  const normalized = resolveJson({ json: parsed }, undefined, ctx.configService.platform)
  return Buffer.from(normalized ?? JSON.stringify(parsed, null, 2))
}

function createScopedSlotGenericTag(key: string) {
  return `<${key} wx:if="{{${WEVU_SLOT_OWNER_ID_PROP}}}" ${WEVU_SLOT_OWNER_ID_ATTR}="{{${WEVU_SLOT_OWNER_ID_PROP}}}" ${WEVU_SLOT_PROPS_ATTR}="{{[]}}" ${WEVU_SLOT_SCOPE_ATTR}="{{${WEVU_SLOT_SCOPE_KEY}}}" />`
}

function createSlotPatchPattern(key: string) {
  const slotName = key.replace(/^scoped-slots-/, '')
  if (slotName === 'default') {
    return /<slot(\s*)\/>|<slot(\s*)><\/slot>/g
  }

  const escapedSlotName = slotName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`<slot(?=[^>]*\\bname=["']${escapedSlotName}["'])((?:\\s+[^>]*)?)\\/>|<slot(?=[^>]*\\bname=["']${escapedSlotName}["'])((?:\\s+[^>]*)?)><\\/slot>`, 'g')
}

function withScopedSlotGenericSlots(
  ctx: CompilerContext,
  fileName: string,
  buffer: Buffer,
) {
  const keys = getScopedSlotGenericKeys(ctx, fileName)
  if (!keys?.size || ctx.configService.platform !== 'weapp') {
    return buffer
  }

  let source = buffer.toString('utf8')
  let changed = false
  for (const key of keys) {
    if (source.includes(`<${key} `) || source.includes(`<${key}>`)) {
      continue
    }
    const tag = createScopedSlotGenericTag(key)
    const next = source.replace(createSlotPatchPattern(key), (matched) => {
      changed = true
      return `${matched}${tag}`
    })
    source = next
  }

  return changed ? Buffer.from(source) : buffer
}

function createScopedSlotHostPropertiesSource() {
  return `${WEVU_SLOT_NAMES_PROP}: { type: null, value: null }, ${WEVU_SLOT_OWNER_ID_PROP}: { type: String, value: "" }, ${WEVU_SLOT_SCOPE_KEY}: { type: null, value: null }`
}

function withScopedSlotHostProperties(
  ctx: CompilerContext,
  fileName: string,
  source: string,
) {
  const keys = getScopedSlotGenericKeys(ctx, fileName)
  if (!keys?.size || ctx.configService.platform !== 'weapp' || source.includes(WEVU_SLOT_OWNER_ID_PROP)) {
    return source
  }

  const injected = injectScopedSlotHostPropertiesInJs(source)
  if (injected.transformed) {
    return injected.code
  }

  const propertySource = createScopedSlotHostPropertiesSource()
  return source.replace(/Component\(\s*\{/, matched => `${matched} properties: { ${propertySource} },`)
}

function withScopedSlotHostAsset(
  ctx: CompilerContext,
  fileName: string,
  buffer: Buffer,
) {
  if (fileName.endsWith('.json')) {
    return withScopedSlotComponentGenerics(ctx, fileName, buffer)
  }
  if (fileName.endsWith('.wxml')) {
    return withScopedSlotGenericSlots(ctx, fileName, buffer)
  }
  if (fileName.endsWith('.js')) {
    const source = buffer.toString('utf8')
    const next = withScopedSlotHostProperties(ctx, fileName, source)
    return next === source ? buffer : Buffer.from(next)
  }
  return buffer
}

function patchScopedSlotHostAssetForBundle(
  ctx: CompilerContext,
  fileName: string,
  output: Record<string, any>,
) {
  if (output.type === 'chunk') {
    const current = output.code
    if (typeof current !== 'string') {
      return false
    }
    const next = withScopedSlotHostProperties(ctx, fileName, current)
    if (next === current) {
      return false
    }
    output.code = next
    return true
  }

  const current = output.source
  if (typeof current !== 'string' && !Buffer.isBuffer(current) && !(current instanceof Uint8Array)) {
    return false
  }

  const currentBuffer = Buffer.from(current)
  const next = withScopedSlotHostAsset(ctx, fileName, currentBuffer)
  if (Buffer.compare(currentBuffer, next) === 0) {
    return false
  }

  output.source = next.toString('utf8')
  return true
}

function emitScopedSlotGenericPlaceholderAssets(
  ctx: CompilerContext,
  pluginContext: { emitFile: (asset: { type: 'asset', fileName: string, source: Buffer | string }) => void },
  bundle: Record<string, any>,
  fileName: string,
) {
  const keys = getScopedSlotGenericKeys(ctx, fileName)
  if (!keys?.size || ctx.configService.platform !== 'weapp') {
    return
  }

  const componentBase = toPosixPath(fileName.replace(/\.json$/, ''))
  emitAlipayGenericPlaceholderAssetsByBase(
    pluginContext,
    bundle,
    resolveWeappScopedSlotGenericPlaceholderBase(componentBase),
    ctx.configService.outputExtensions,
    {
      jsonConfig: { component: true, options: { virtualHost: true } },
      templateSource: '<view wx:if="{{false}}" />',
    },
  )
}

export function patchScopedSlotHostAssetsInBundle(
  ctx: CompilerContext,
  pluginContext: { emitFile: (asset: { type: 'asset', fileName: string, source: Buffer | string }) => void },
  bundle: Record<string, any>,
) {
  for (const [fileName, output] of Object.entries(bundle)) {
    if (!/\.(?:json|wxml|js)$/.test(fileName) || !output) {
      continue
    }
    if (!patchScopedSlotHostAssetForBundle(ctx, fileName, output)) {
      continue
    }
    if (fileName.endsWith('.json')) {
      emitScopedSlotGenericPlaceholderAssets(ctx, pluginContext, bundle, fileName)
    }
    const source = output.type === 'chunk' ? output.code : output.source
    ctx.runtimeState.asset.emittedBuffer.set(fileName, Buffer.from(source))
  }
}

export function collectBundledAssetSourcePaths(bundle: OutputBundle | Record<string, any>) {
  const sources = new Set<string>()

  for (const output of Object.values(bundle)) {
    if (!output || output.type !== 'asset') {
      continue
    }

    for (const originalFile of output.originalFileNames ?? []) {
      if (typeof originalFile === 'string' && originalFile) {
        sources.add(normalizePath(originalFile))
      }
    }
  }

  return sources
}

export function collectAssetModuleSourcePaths(moduleIds: Iterable<string>) {
  const sources = new Set<string>()

  for (const moduleId of moduleIds) {
    if (typeof moduleId !== 'string' || !moduleId) {
      continue
    }

    sources.add(normalizePath(stripQueryAndHash(moduleId)))
  }

  return sources
}

function scanAssetFiles(configService: CompilerContext['configService'], config: ResolvedConfig, buildTarget: BuildTarget) {
  const weappViteConfig = configService.weappViteConfig
  const include = normalizeCopyGlobs(weappViteConfig?.copy?.include)
  const exclude = normalizeCopyGlobs(weappViteConfig?.copy?.exclude)
  const filter = weappViteConfig?.copy?.filter ?? (() => true)

  const ignore = [
    ...defaultExcluded,
    path.resolve(configService.cwd, `${config.build.outDir}/**/*`),
    ...exclude,
  ]

  const patterns = [
    `**/*.{${defaultAssetExtensions.join(',')}}`,
    ...include,
  ]
  const includeMatcher = createPathMatcher(patterns, { dot: false })
  const ignoreMatcher = createPathMatcher(ignore, { dot: true })

  const roots = new Set<string>()
  if (buildTarget !== 'plugin') {
    roots.add(configService.absoluteSrcRoot)
  }
  if (configService.absolutePluginRoot && buildTarget === 'plugin') {
    roots.add(configService.absolutePluginRoot)
  }

  if (!roots.size) {
    return Promise.resolve([])
  }

  const crawlPromises = Array.from(roots).map((root) => {
    return new Fdir({
      includeDirs: false,
      pathSeparator: '/',
    })
      .withFullPaths()
      .crawl(root)
      .withPromise()
      .then((files) => {
        return files.filter((file) => {
          const variants = createAssetPathVariants(file, [root, configService.absoluteSrcRoot, configService.cwd])
          return variants.some(variant => includeMatcher(variant))
            && !variants.some(variant => ignoreMatcher(variant))
        })
      })
  })

  return Promise.all(crawlPromises)
    .then((groups) => {
      const files = new Set<string>()
      for (const group of groups) {
        for (const file of group) {
          files.add(file)
        }
      }
      return Array.from(files).filter(filter)
    })
}

async function emitAssets(
  ctx: CompilerContext,
  pluginContext: { emitFile: (asset: { type: 'asset', fileName: string, source: Buffer | string }) => void },
  bundle: Record<string, any>,
  files: string[],
  concurrency: number,
) {
  if (!files.length) {
    return
  }

  const normalizedConcurrency = Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 8
  const workerCount = Math.min(normalizedConcurrency, files.length)
  let index = 0

  await Promise.all(
    Array.from({ length: workerCount }).map(async () => {
      while (index < files.length) {
        const file = files[index++]
        const fileName = ctx.configService.relativeOutputPath(file)
        const sourceBuffer = await fs.readFile(file)
        const buffer = withScopedSlotHostAsset(ctx, fileName, sourceBuffer)
        const previous = ctx.runtimeState.asset.emittedBuffer.get(fileName)
        if (previous && Buffer.compare(previous, buffer) === 0) {
          continue
        }
        if (fileName.endsWith('.json')) {
          emitScopedSlotGenericPlaceholderAssets(ctx, pluginContext, bundle, fileName)
        }
        pluginContext.emitFile({
          type: 'asset',
          fileName,
          source: buffer,
        })
        ctx.runtimeState.asset.emittedBuffer.set(fileName, buffer)
      }
    }),
  )
}

function createAssetCollector(state: AssetPluginState): Plugin {
  const { ctx } = state
  const { configService } = ctx

  return {
    name: 'weapp-vite:asset',
    enforce: 'post',

    configResolved(config) {
      state.resolvedConfig = config
    },

    buildStart() {
      if (!state.resolvedConfig) {
        state.pendingAssets = Promise.resolve([])
        return
      }

      state.pendingAssets = scanAssetFiles(configService, state.resolvedConfig, state.buildTarget)
    },

    async generateBundle(_options, bundle) {
      patchScopedSlotHostAssetsInBundle(ctx, this, bundle as Record<string, any>)
      const files = await state.pendingAssets
      const bundledSources = collectBundledAssetSourcePaths(bundle as OutputBundle)
      const moduleSources = collectAssetModuleSourcePaths(this.getModuleIds())
      const pending = (files ?? []).filter((file) => {
        const normalizedFile = normalizePath(file)
        return !bundledSources.has(normalizedFile) && !moduleSources.has(normalizedFile)
      })
      await emitAssets(ctx, this, bundle as Record<string, any>, pending, 8)
    },
  }
}

export function asset(ctx: CompilerContext): Plugin[] {
  const state: AssetPluginState = { ctx, buildTarget: ctx.currentBuildTarget ?? 'app' }
  return [createAssetCollector(state)]
}
