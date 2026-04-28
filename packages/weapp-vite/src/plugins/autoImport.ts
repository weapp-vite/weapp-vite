import type { Plugin, ResolvedConfig } from 'vite'
import type { ComponentsMap } from '../types'
import type { CompilerContext } from '@/context'
import { removeExtensionDeep } from '@weapp-core/shared'
import chokidar from 'chokidar'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import { configExtensions, jsExtensions, templateExtensions, vueExtensions } from '../constants'
import { logger, resolvedComponentName } from '../context/shared'
import { defaultExcluded } from '../defaults'
import { getAutoImportConfig } from '../runtime/autoImport/config'
import { createSidecarWatchOptions } from '../runtime/watch/options'
import { findJsEntry, findVueEntry, toPosixPath, touch } from '../utils'

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
const AUTO_IMPORT_CONFIG_SUFFIXES = configExtensions.map(ext => `.${ext}`)
const AUTO_IMPORT_JS_SUFFIXES = new Set(jsExtensions.map(ext => `.${ext}`))
const AUTO_IMPORT_TEMPLATE_SUFFIXES = new Set(templateExtensions.map(ext => `.${ext}`))
const AUTO_IMPORT_VUE_SUFFIXES = new Set(vueExtensions.map(ext => `.${ext}`))

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

function getAutoImportCandidateKind(filePath: string) {
  if (AUTO_IMPORT_CONFIG_SUFFIXES.some(suffix => filePath.endsWith(suffix))) {
    return 'config'
  }
  if (AUTO_IMPORT_VUE_SUFFIXES.has(path.extname(filePath))) {
    return 'vue'
  }
  if (AUTO_IMPORT_TEMPLATE_SUFFIXES.has(path.extname(filePath))) {
    return 'template'
  }
  if (AUTO_IMPORT_JS_SUFFIXES.has(path.extname(filePath))) {
    return 'script'
  }
  return undefined
}

function getAutoImportCandidateBase(filePath: string, kind: ReturnType<typeof getAutoImportCandidateKind>) {
  if (!kind) {
    return undefined
  }
  if (kind === 'config') {
    const suffix = AUTO_IMPORT_CONFIG_SUFFIXES.find(item => filePath.endsWith(item))
    return suffix ? filePath.slice(0, -suffix.length) : undefined
  }
  return filePath.slice(0, -path.extname(filePath).length)
}

function rankAutoImportCandidate(kind: ReturnType<typeof getAutoImportCandidateKind>) {
  switch (kind) {
    case 'vue':
      return 4
    case 'template':
      return 3
    case 'script':
      return 2
    case 'config':
      return 1
    default:
      return 0
  }
}

function collectDistinctAutoImportCandidates(files: string[]) {
  const bestByBase = new Map<string, { filePath: string, rank: number }>()

  for (const filePath of files) {
    const kind = getAutoImportCandidateKind(filePath)
    const base = getAutoImportCandidateBase(filePath, kind)
    if (!kind || !base) {
      continue
    }

    const rank = rankAutoImportCandidate(kind)
    const existing = bestByBase.get(base)
    if (!existing || rank > existing.rank || (rank === existing.rank && filePath < existing.filePath)) {
      bestByBase.set(base, { filePath, rank })
    }
  }

  return Array.from(bestByBase.values(), entry => entry.filePath).sort((a, b) => a.localeCompare(b))
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

  const files = await fdir
    .withFullPaths()
    .globWithOptions(globs.map(pattern => path.resolve(configService.absoluteSrcRoot, pattern)), {
      ignore,
    })
    .crawl(configService.absoluteSrcRoot)
    .withPromise()

  return collectDistinctAutoImportCandidates(files)
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

async function refreshAutoImportImporters(ctx: AutoImportState['ctx'], filePath: string) {
  const { wxmlService, configService, autoImportService } = ctx
  if (!wxmlService || !configService) {
    return
  }

  const { componentName } = resolvedComponentName(removeExtensionDeep(filePath))
  if (!componentName) {
    return
  }

  const touchedImporters = new Set<string>()
  const entries = Array.from(wxmlService.wxmlComponentsMap.entries()) as Array<[string, ComponentsMap]>
  for (const [baseName, components] of entries) {
    if (!Object.hasOwn(components, componentName)) {
      continue
    }

    const pendingEntriesByImporter = ctx.runtimeState?.autoImport?.pendingEntriesByImporter
    const resolvedComponent = autoImportService?.resolve(componentName, baseName)
    const pendingEntry = resolvedComponent?.value.from
    if (pendingEntriesByImporter && pendingEntry) {
      const pendingEntries = pendingEntriesByImporter.get(baseName) ?? new Set<string>()
      pendingEntries.add(pendingEntry)
      pendingEntriesByImporter.set(baseName, pendingEntries)
    }

    const vueEntry = await findVueEntry(baseName)
    if (vueEntry) {
      touchedImporters.add(vueEntry)
      continue
    }

    const scriptEntry = await findJsEntry(baseName)
    if (scriptEntry.path) {
      touchedImporters.add(scriptEntry.path)
    }
  }

  if (touchedImporters.size === 0) {
    return
  }

  for (const importer of touchedImporters) {
    try {
      await touch(importer)
    }
    catch {}
  }

  logger.info(`[auto-import:watch] 刷新组件引用方 ${Array.from(touchedImporters, importer => configService.relativeCwd(importer)).join(', ')}`)
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

    const watcher = chokidar.watch(Array.from(watchTargets, target => String(target)), createSidecarWatchOptions(configService, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 80,
        pollInterval: 20,
      },
    }))

    watcher.on('add', (filePath) => {
      if (!getAutoImportCandidateKind(filePath)) {
        return
      }
      if (!matchesAutoImportGlobs(ctx, filePath)) {
        return
      }
      logger.info(`[auto-import:watch] 新增组件文件 ${configService.relativeCwd(filePath)}`)
      void autoImportService.registerPotentialComponent(filePath)
        .then(async () => {
          await refreshAutoImportImporters(ctx, filePath)
        })
    })

    watcher.on('unlink', (filePath) => {
      if (!getAutoImportCandidateKind(filePath)) {
        return
      }
      if (!matchesAutoImportGlobs(ctx, filePath)) {
        return
      }
      logger.info(`[auto-import:watch] 删除组件文件 ${configService.relativeCwd(filePath)}`)
      autoImportService.removePotentialComponent(filePath)
      void refreshAutoImportImporters(ctx, filePath)
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
      if (!getAutoImportCandidateKind(absolutePath)) {
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
