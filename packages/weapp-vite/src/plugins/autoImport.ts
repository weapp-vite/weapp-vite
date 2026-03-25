import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '@/context'
import chokidar from 'chokidar'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import { logger } from '../context/shared'
import { defaultExcluded } from '../defaults'
import { getAutoImportConfig } from '../runtime/autoImport/config'
import { createSidecarWatchOptions } from '../runtime/watch/options'
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

const LEADING_DOT_SLASH_RE = /^\.\//
const LEADING_SLASHES_RE = /^\/+/
const GLOB_WILDCARD_RE = /[*?[{]/
const TRAILING_SLASHES_RE = /\/+$/
const AUTO_IMPORT_WATCHER_KEY = '__auto-import-vue-watcher__'

function isEnabledOutputOption(option: unknown) {
  if (option === true) {
    return true
  }
  if (typeof option === 'string') {
    return option.trim().length > 0
  }
  return false
}

export function shouldBootstrapAutoImportWithoutGlobs(autoImportConfig: ReturnType<typeof getAutoImportConfig>) {
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

export async function findAutoImportCandidates(state: AutoImportState, globs: string[]) {
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
  options: {
    includeSrcRoot?: boolean
  } = {},
) {
  const { configService } = state.ctx
  if (!configService) {
    return new Set()
  }
  const watchTargets = new Set<string>()

  if (options.includeSrcRoot !== false) {
    watchTargets.add(configService.absoluteSrcRoot)
  }

  for (const pattern of globs ?? []) {
    const normalizedPattern = toPosixPath(pattern).replace(LEADING_DOT_SLASH_RE, '').replace(LEADING_SLASHES_RE, '')
    const wildcardIndex = normalizedPattern.search(GLOB_WILDCARD_RE)
    const base = wildcardIndex >= 0 ? normalizedPattern.slice(0, wildcardIndex) : normalizedPattern
    const cleanedBase = base.replace(TRAILING_SLASHES_RE, '')

    if (!cleanedBase) {
      continue
    }

    watchTargets.add(path.resolve(configService.absoluteSrcRoot, cleanedBase))
  }

  if (typeof registrar?.addWatchFile !== 'function') {
    return watchTargets
  }

  for (const target of watchTargets) {
    registrar.addWatchFile(target)
  }

  return watchTargets
}

function createAutoImportPlugin(state: AutoImportState): Plugin {
  const { ctx } = state
  const { configService, autoImportService } = ctx
  let fileWatcherStarted = false

  function startAutoImportFileWatcher(globs: string[] | undefined) {
    if (fileWatcherStarted || !configService?.isDev || !globs?.length) {
      return
    }

    const watchTargets = registerAutoImportWatchTargets(state, globs, undefined, {
      includeSrcRoot: false,
    })
    if (!watchTargets?.size) {
      return
    }

    const watcher = chokidar.watch([...watchTargets], createSidecarWatchOptions(configService, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 80,
        pollInterval: 20,
      },
    }))

    watcher.on('add', (filePath) => {
      if (!matchesAutoImportGlobs(ctx, filePath)) {
        return
      }
      logger.info(`[auto-import:watch] 新增组件文件 ${configService.relativeCwd(filePath)}`)
      void autoImportService.registerPotentialComponent(filePath)
    })

    watcher.on('unlink', (filePath) => {
      if (!matchesAutoImportGlobs(ctx, filePath)) {
        return
      }
      logger.info(`[auto-import:watch] 删除组件文件 ${configService.relativeCwd(filePath)}`)
      autoImportService.removePotentialComponent(filePath)
    })

    const sidecarWatcherMap = ctx.runtimeState?.watcher?.sidecarWatcherMap
    if (!sidecarWatcherMap) {
      return
    }

    sidecarWatcherMap.set(AUTO_IMPORT_WATCHER_KEY, {
      close: () => void watcher.close(),
    })
    fileWatcherStarted = true
  }

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
      startAutoImportFileWatcher(globs)
      const globsKey = globs?.join('\0') ?? ''
      if (globsKey !== state.lastGlobsKey) {
        state.initialScanDone = false
        state.lastGlobsKey = globsKey
      }

      if (!globs?.length) {
        if (!state.initialScanDone && shouldBootstrapAutoImportWithoutGlobs(autoImportConfig)) {
          autoImportService.reset()
          state.initialScanDone = true
        }
        return
      }

      if (state.initialScanDone) {
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
