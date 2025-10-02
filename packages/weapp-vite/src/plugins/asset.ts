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

  const fdir = new Fdir({
    includeDirs: false,
    pathSeparator: '/',
  })

  const patterns = [
    `**/*.{${defaultAssetExtensions.join(',')}}`,
    ...include,
  ]

  return fdir
    .withFullPaths()
    .globWithOptions(patterns, {
      ignore,
      dot: false,
    })
    .crawl(configService.absoluteSrcRoot)
    .withPromise()
    .then((files) => {
      return Promise.all(
        files
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
