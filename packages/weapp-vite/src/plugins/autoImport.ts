import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '@/context'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import { defaultExcluded } from '../defaults'
import { getAutoImportConfig } from '../runtime/autoImport/config'
import { toPosixPath } from '../utils'

interface AutoImportState {
  ctx: CompilerContext
  resolvedConfig?: ResolvedConfig
  initialScanDone?: boolean
  lastGlobsKey?: string
}

interface WatchFileRegistrar {
  addWatchFile?: (id: string) => void
}

function isEnabledOutputOption(option: unknown) {
  if (option === true) {
    return true
  }
  if (typeof option === 'string') {
    return option.trim().length > 0
  }
  return false
}

function shouldBootstrapWithoutGlobs(autoImportConfig: ReturnType<typeof getAutoImportConfig>) {
  if (!autoImportConfig) {
    return false
  }

  const resolvers = autoImportConfig.resolvers
  if (Array.isArray(resolvers) && resolvers.length > 0) {
    return true
  }

  if (autoImportConfig.output !== false) {
    return true
  }

  if (isEnabledOutputOption(autoImportConfig.typedComponents)) {
    return true
  }
  if (isEnabledOutputOption(autoImportConfig.htmlCustomData)) {
    return true
  }
  if (isEnabledOutputOption(autoImportConfig.vueComponents)) {
    return true
  }

  return false
}

function normalizeChangedPath(id: string) {
  if (!id || id.startsWith('\0')) {
    return undefined
  }

  const [pathWithoutQuery] = id.split('?')
  return pathWithoutQuery
}

function resolveAbsolutePath(ctx: AutoImportState['ctx'], candidate: string) {
  const { configService } = ctx
  if (!configService) {
    return undefined
  }

  if (path.isAbsolute(candidate)) {
    return candidate
  }

  const resolvedFromSrc = path.resolve(configService.absoluteSrcRoot, candidate)
  if (resolvedFromSrc.startsWith(configService.absoluteSrcRoot)) {
    return resolvedFromSrc
  }

  return path.resolve(configService.cwd, candidate)
}

function matchesAutoImportGlobs(ctx: AutoImportState['ctx'], candidate: string) {
  const { autoImportService, configService } = ctx
  if (!autoImportService || !configService) {
    return false
  }

  const targets = new Set<string>([
    candidate,
    configService.relativeCwd(candidate),
    configService.relativeAbsoluteSrcRoot(candidate),
  ])

  targets.add(`/${configService.relativeAbsoluteSrcRoot(candidate)}`)
  targets.add(toPosixPath(candidate))

  for (const target of targets) {
    if (!target) {
      continue
    }
    if (autoImportService.filter(target)) {
      return true
    }
  }

  return false
}

async function findAutoImportCandidates(state: AutoImportState, globs: string[]) {
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

function registerAutoImportWatchTargets(
  state: AutoImportState,
  globs: string[] | undefined,
  registrar: WatchFileRegistrar | undefined,
) {
  if (!globs?.length || typeof registrar?.addWatchFile !== 'function') {
    return
  }

  const { configService } = state.ctx
  const watchTargets = new Set<string>([configService.absoluteSrcRoot])

  for (const pattern of globs) {
    const normalizedPattern = toPosixPath(pattern).replace(/^\.\//, '').replace(/^\/+/, '')
    const wildcardIndex = normalizedPattern.search(/[*?[{]/)
    const base = wildcardIndex >= 0 ? normalizedPattern.slice(0, wildcardIndex) : normalizedPattern
    const cleanedBase = base.replace(/\/+$/, '')

    if (!cleanedBase) {
      continue
    }

    watchTargets.add(path.resolve(configService.absoluteSrcRoot, cleanedBase))
  }

  for (const target of watchTargets) {
    registrar.addWatchFile(target)
  }
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
      if (!state.resolvedConfig) {
        return
      }

      const autoImportConfig = getAutoImportConfig(configService)
      const globs = autoImportConfig?.globs
      registerAutoImportWatchTargets(state, globs, this as unknown as WatchFileRegistrar)
      const globsKey = globs?.join('\0') ?? ''
      if (globsKey !== state.lastGlobsKey) {
        state.initialScanDone = false
        state.lastGlobsKey = globsKey
      }

      if (!globs?.length) {
        if (!state.initialScanDone && shouldBootstrapWithoutGlobs(autoImportConfig)) {
          autoImportService.reset()
          state.initialScanDone = true
        }
        return
      }

      if (state.initialScanDone) {
        if (configService?.isDev) {
          const files = await findAutoImportCandidates(state, globs)
          await Promise.all(files.map(file => autoImportService.registerPotentialComponent(file)))
        }
        return
      }

      autoImportService.reset()

      const files = await findAutoImportCandidates(state, globs)
      await Promise.all(files.map(file => autoImportService.registerPotentialComponent(file)))

      state.initialScanDone = true
    },

    async closeBundle() {
      await autoImportService.awaitManifestWrites()
    },

    async watchChange(id, change) {
      if (!state.initialScanDone || !state.resolvedConfig) {
        return
      }

      const filePath = normalizeChangedPath(id)
      if (!filePath) {
        return
      }

      const absolutePath = resolveAbsolutePath(ctx, filePath)
      if (!absolutePath) {
        return
      }

      if (!matchesAutoImportGlobs(ctx, absolutePath)) {
        return
      }

      if (change.event === 'delete') {
        autoImportService.removePotentialComponent(absolutePath)
        return
      }

      await autoImportService.registerPotentialComponent(absolutePath)
    },
  }
}

export function autoImport(ctx: CompilerContext): Plugin[] {
  const state: AutoImportState = { ctx }
  return [createAutoImportPlugin(state)]
}
