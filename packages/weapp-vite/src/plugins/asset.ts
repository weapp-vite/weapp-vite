import type { OutputBundle } from 'rolldown'
import type { Plugin, ResolvedConfig } from 'vite'
import type { BuildTarget, CompilerContext } from '../context'
import type { CopyGlobs } from '../types'
import { Buffer } from 'node:buffer'
import { fs } from '@weapp-core/shared/fs'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import picomatch from 'picomatch'
import { defaultAssetExtensions, defaultExcluded } from '../defaults'
import { normalizePath } from '../utils/path'

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
  pluginContext: { emitFile: (asset: { type: 'asset', fileName: string, source: Buffer }) => void },
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
        const buffer = await fs.readFile(file)
        const fileName = ctx.configService.relativeOutputPath(file)
        const previous = ctx.runtimeState.asset.emittedBuffer.get(fileName)
        if (previous && Buffer.compare(previous, buffer) === 0) {
          continue
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
    enforce: 'pre',

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
      const files = await state.pendingAssets
      const bundledSources = collectBundledAssetSourcePaths(bundle as OutputBundle)
      const moduleSources = collectAssetModuleSourcePaths(this.getModuleIds())
      const pending = (files ?? []).filter((file) => {
        const normalizedFile = normalizePath(file)
        return !bundledSources.has(normalizedFile) && !moduleSources.has(normalizedFile)
      })
      await emitAssets(ctx, this, pending, 8)
    },
  }
}

export function asset(ctx: CompilerContext): Plugin[] {
  const state: AssetPluginState = { ctx, buildTarget: ctx.currentBuildTarget ?? 'app' }
  return [createAssetCollector(state)]
}
