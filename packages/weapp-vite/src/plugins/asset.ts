import type { Buffer } from 'node:buffer'
import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import type { CopyGlobs } from '../types'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'
import path from 'pathe'
import { defaultAssetExtensions, defaultExcluded } from '../defaults'

interface AssetCandidate {
  file: string
  buffer: Buffer
}

interface AssetPluginState {
  ctx: CompilerContext
  resolvedConfig?: ResolvedConfig
  pendingAssets?: Promise<AssetCandidate[]>
}

export function asset(ctx: CompilerContext): Plugin[] {
  const state: AssetPluginState = { ctx }
  return [createAssetCollector(state)]
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

      state.pendingAssets = scanAssetFiles(configService, state.resolvedConfig)
    },

    async buildEnd() {
      const assets = await state.pendingAssets
      if (!assets?.length) {
        return
      }

      for (const candidate of assets) {
        this.emitFile({
          type: 'asset',
          fileName: configService.relativeAbsoluteSrcRoot(candidate.file),
          source: candidate.buffer,
        })
      }
    },
  }
}

function scanAssetFiles(configService: CompilerContext['configService'], config: ResolvedConfig) {
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

  const roots = new Set<string>([configService.absoluteSrcRoot])
  if (configService.absolutePluginRoot) {
    roots.add(configService.absolutePluginRoot)
  }

  const crawlPromises = Array.from(roots).map((root) => {
    return new Fdir({
      includeDirs: false,
      pathSeparator: '/',
    })
      .withFullPaths()
      .globWithOptions(patterns, {
        ignore,
        dot: false,
      })
      .crawl(root)
      .withPromise()
  })

  return Promise.all(crawlPromises)
    .then((groups) => {
      const files = new Set<string>()
      for (const group of groups) {
        for (const file of group) {
          files.add(file)
        }
      }
      return Promise.all(
        Array.from(files)
          .filter(filter)
          .map(async (file) => {
            return {
              file,
              buffer: await fs.readFile(file),
            }
          }),
      )
    })
}

function normalizeCopyGlobs(globs?: CopyGlobs): string[] {
  return Array.isArray(globs) ? globs : []
}
