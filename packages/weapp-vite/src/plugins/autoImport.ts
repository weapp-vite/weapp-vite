import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '@/context'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import { defaultExcluded } from '../defaults'
import { isTemplateRequest } from '../utils'

interface AutoImportState {
  ctx: CompilerContext
  resolvedConfig?: ResolvedConfig
}

export function autoImport(ctx: CompilerContext): Plugin[] {
  const state: AutoImportState = { ctx }
  return [createAutoImportPlugin(state)]
}

function createAutoImportPlugin(state: AutoImportState): Plugin {
  const { ctx } = state
  const { configService, autoImportService } = ctx

  return {
    name: 'weapp-vite:auto-import',
    enforce: 'pre',

    configResolved(config) {
      state.resolvedConfig = config
    },

    async buildStart() {
      autoImportService.reset()
      if (!state.resolvedConfig) {
        return
      }

      const globs = configService.weappViteConfig?.enhance?.autoImportComponents?.globs
      if (!globs?.length) {
        return
      }

      const files = await findTemplateCandidates(state, globs)
      await Promise.all(files.map(file => autoImportService.registerPotentialComponent(file)))
    },
  }
}

async function findTemplateCandidates(state: AutoImportState, globs: string[]) {
  const { ctx, resolvedConfig } = state
  const { configService } = ctx

  if (!resolvedConfig) {
    return []
  }

  const ignore = [
    ...defaultExcluded,
    `${resolvedConfig.build.outDir}/**`,
  ]

  const fdir = new Fdir({
    includeDirs: false,
    filters: [
      (candidate: string) => {
        return isTemplateRequest(candidate)
      },
    ],
    pathSeparator: '/',
  })

  return await fdir
    .withFullPaths()
    .globWithOptions(globs.map(pattern => path.resolve(configService.absoluteSrcRoot, pattern)), {
      ignore,
    })
    .crawl(configService.absoluteSrcRoot)
    .withPromise()
}
