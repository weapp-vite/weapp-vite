import type { PluginContext } from 'rolldown'
import type { ModuleNode, Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { WeappViteRuntime } from '../pluginHost'
import type { AutoRoutesService } from '../runtime/autoRoutesPlugin/service'
import { WEVU_AUTO_ROUTES_MODULE_ID, WEVU_AUTO_ROUTES_VIRTUAL_MODULE_ID, WEVU_DEFINE_PAGE_MACRO } from '@weapp-core/constants'
import chokidar from 'chokidar'
import { stripPageDeclaration } from 'wevu/compiler'
import { scriptExtensions, vueExtensions } from '../constants'
import { logger } from '../context/shared'
import { resolveAutoRoutesManagedOutputPaths } from '../runtime/autoRoutesPlugin/generatedPaths'
import {
  isAutoRoutesPagesRelatedPath,
  resolveAutoRoutesAliasTargets,
  resolveAutoRoutesMatcherContext,
} from '../runtime/autoRoutesPlugin/shared'
import { createSidecarWatchOptions } from '../runtime/watch/options'
import { recordHmrProfileDuration, recordHmrProfileOperation } from '../utils/hmrProfile'
import { normalizeFsResolvedId } from '../utils/resolvedId'
import { normalizeEncodedSourceMapLike } from '../utils/sourcemap'
import {
  addAutoRoutesWatchTargets,
  collectAutoRoutesReloadModules,
  collectAutoRoutesWatchDirs,
  createAutoRoutesSidecarWatcher,
  invalidateAutoRoutesVirtualModules,
  isAutoRoutesWatchFile,
  isAutoRoutesWatchMode,
  resolveAutoRoutesHotUpdateAction,
  resolveAutoRoutesVirtualId,
  resolveAutoRoutesWatchChangeEvent,
  RESOLVED_VIRTUAL_ID,
  shouldStartAutoRoutesWatcher,
  WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID,
} from './autoRoutes.shared'
import { markAppEntryForAutoRoutesTopology } from './core/lifecycle/autoRoutesTopology'
import { parseRequest } from './utils/parse'

/**
 * 路由文件监听器的唯一标识，用于在 sidecarWatcherMap 中注册。
 */
const ROUTE_WATCHER_KEY = '__auto-routes-source-watcher__'
const AUTO_ROUTES_RESOLVED_IDS: readonly string[] = [RESOLVED_VIRTUAL_ID, WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID]
const AUTO_ROUTES_VUE_SUFFIXES = vueExtensions.map(extension => `.${extension}`)

interface AutoRoutesWatcherSubscriber {
  readonly topologyDirtyEntries: Set<string>
  readonly devServer?: ViteDevServer
}

interface AutoRoutesWatcherController {
  addWatchTargets: (paths: string[]) => void
  readonly subscribers: Map<WeappViteRuntime, AutoRoutesWatcherSubscriber>
  close: () => void | Promise<void>
}

function isAutoRoutesWatcherController(watcher: unknown): watcher is AutoRoutesWatcherController {
  return Boolean(
    watcher
    && typeof watcher === 'object'
    && 'addWatchTargets' in watcher
    && typeof watcher.addWatchTargets === 'function'
    && 'close' in watcher
    && typeof watcher.close === 'function'
    && 'subscribers' in watcher
    && watcher.subscribers instanceof Map,
  )
}

/**
 * 这里只排除非脚本 Vue 子资源；外部脚本是否属于页面声明由 service 的依赖所有权判定。
 */
function isPageScriptTransformRequest(id: string, normalizedId: string) {
  const query = id.includes('?') ? parseRequest(id).query : undefined
  if (AUTO_ROUTES_VUE_SUFFIXES.some(suffix => normalizedId.endsWith(suffix))) {
    return query?.type === 'script'
  }
  return !query || !('vue' in query) || query.type === 'script'
}

function createAutoRoutesPlugin(ctx: MutableCompilerContext, service: AutoRoutesService): Plugin {
  let resolvedConfig: ResolvedConfig | undefined
  let devServer: ViteDevServer | undefined
  let servedRouteSignature: string | undefined
  const autoRoutesAliasTargets = new Set<string>()
  const autoRoutesTopologyDirtyEntries = new Set<string>()
  const watcherSubscriber: AutoRoutesWatcherSubscriber = {
    topologyDirtyEntries: autoRoutesTopologyDirtyEntries,
    get devServer() {
      return devServer
    },
  }

  function registerPageDeclarationSourceResolver(pluginContext: PluginContext) {
    service.setPageDeclarationSourceResolver(
      typeof pluginContext.resolve === 'function'
        ? async (source, importer) => {
          const resolved = await pluginContext.resolve(source, importer, { skipSelf: true })
          return resolved?.id
        }
        : undefined,
    )
  }

  const refreshAutoRoutesAliasTargets = () => {
    autoRoutesAliasTargets.clear()
    for (const target of resolveAutoRoutesAliasTargets(ctx.configService?.packageInfo?.rootPath)) {
      autoRoutesAliasTargets.add(target)
    }
  }

  function isPagesRelatedPath(id: string) {
    if (service.isPageDeclarationSource(id)) {
      return true
    }
    const configService = ctx.configService
    if (!configService) {
      return false
    }
    const { autoRoutesConfig, subPackageRoots } = resolveAutoRoutesMatcherContext(ctx)
    return isAutoRoutesPagesRelatedPath(id, {
      cwd: configService.cwd,
      absoluteSrcRoot: configService.absoluteSrcRoot,
      include: autoRoutesConfig.include,
      managedOutputPaths: resolveAutoRoutesManagedOutputPaths(ctx),
      subPackageRoots,
    })
  }

  function markAutoRoutesTopologyDirty(controller: AutoRoutesWatcherController) {
    const appEntry = ctx.scanService?.appEntry?.path
    if (appEntry) {
      controller.subscribers.get('web')?.topologyDirtyEntries.add(normalizeFsResolvedId(appEntry))
    }
    return markAppEntryForAutoRoutesTopology(ctx, {
      resolvedEntryMap: ctx.runtimeState.build.hmr.resolvedEntryMap as Map<string, unknown>,
      markEntryDirty(entryId) {
        const hmr = ctx.runtimeState.build.hmr
        for (const subscriber of controller.subscribers.values()) {
          subscriber.topologyDirtyEntries.add(entryId)
        }
        hmr.dirtyEntrySet.add(entryId)
        hmr.dirtyEntryReasons.set(entryId, 'direct')
        hmr.loadedEntrySet.delete(entryId)
        hmr.dirtyVueEntryIds ??= new Set<string>()
        hmr.dirtyVueEntryIds.add(entryId)
      },
    })
  }

  function reportRouteStructureChangeError(
    filePath: string,
    event: 'create' | 'delete',
    error: unknown,
    controller: AutoRoutesWatcherController,
  ) {
    const action = event === 'create' ? '新增' : '删除'
    const reason = error instanceof Error ? error.message : String(error)
    const routeError = new Error(
      `[auto-routes:watch] ${action}路由文件 ${ctx.configService?.relativeCwd(filePath) ?? filePath} 处理失败：${reason}`,
    )
    const servers = new Set<ViteDevServer>()
    for (const subscriber of controller.subscribers.values()) {
      if (subscriber.devServer) {
        servers.add(subscriber.devServer)
      }
    }
    if (servers.size === 0) {
      logger.error(routeError)
      return
    }
    for (const server of servers) {
      server.ws.send({
        type: 'error',
        err: {
          message: routeError.message,
          stack: routeError.stack ?? routeError.message,
          id: filePath,
          plugin: 'weapp-vite:auto-routes',
        },
      })
    }
  }

  async function handleRouteStructureChange(
    filePath: string,
    event: 'create' | 'delete',
    controller: AutoRoutesWatcherController,
  ) {
    const changedSource = normalizeFsResolvedId(filePath)
    const declarationOwners = new Set(service.getPageDeclarationOwners(changedSource))
    const didChangeRoutes = await service.handleFileChange(filePath, resolveAutoRoutesWatchChangeEvent(event))
    controller.addWatchTargets([...service.getWatchDirectories()])
    if (!didChangeRoutes) {
      return
    }
    for (const owner of service.getPageDeclarationOwners(changedSource)) {
      declarationOwners.add(owner)
    }
    const servers = new Set<ViteDevServer>()
    for (const subscriber of controller.subscribers.values()) {
      if (subscriber.devServer) {
        servers.add(subscriber.devServer)
      }
    }
    for (const server of servers) {
      invalidateAutoRoutesVirtualModules(server, AUTO_ROUTES_RESOLVED_IDS)
    }
    const appEntryPath = ctx.scanService?.appEntry?.path
    markAutoRoutesTopologyDirty(controller)
    ctx.scanService?.markDirty()
    const notificationFiles = new Set<string>()
    for (const owner of declarationOwners) {
      if (owner !== changedSource) {
        notificationFiles.add(owner)
      }
    }
    if (appEntryPath) {
      notificationFiles.add(appEntryPath)
    }
    for (const server of servers) {
      for (const file of notificationFiles) {
        server.watcher.emit('change', file)
      }
    }
  }

  /**
   * 启动 chokidar 监听页面路由源文件及其外部声明依赖所在目录的增删。
   * Rolldown 的 watcher 不会为新建文件触发 watchChange，
   * 因此需要独立的文件监听来补偿。
   *
   * 注意：chokidar v5 在 macOS 上使用 glob 模式时无法检测新建文件，
   * 必须直接监听目录，然后在事件回调中按扩展名过滤。
   *
   * 生命周期：watcher 注册到 sidecarWatcherMap，由 watcherService.closeAll()
   * 统一回收，不在 closeBundle 中销毁（build watch 模式下 closeBundle 每次
   * 重编译都会触发，提前销毁会导致后续文件变更无法感知）。
   */
  function startRouteFileWatcher() {
    const configService = ctx.configService
    if (!configService) {
      return
    }

    const { autoRoutesConfig, matcher: resolvedMatcher } = resolveAutoRoutesMatcherContext(ctx)
    const allowedExtensions = new Set([...vueExtensions, ...scriptExtensions].map(ext => `.${ext}`))
    const watchDirs = collectAutoRoutesWatchDirs(
      service.getWatchDirectories(),
      resolvedMatcher.getWatchRoots(configService.absoluteSrcRoot),
    )

    if (!shouldStartAutoRoutesWatcher({
      // 已存在的 watcher 仍需接收 ensureFresh 后发现的新依赖目录。
      routeWatcherStarted: false,
      isDev: configService.isDev,
      autoRoutesEnabled: autoRoutesConfig.enabled,
      autoRoutesWatch: autoRoutesConfig.watch,
      serviceEnabled: service.isEnabled(),
      watchDirsLength: watchDirs.length,
    })) {
      return
    }

    const subscriberId = resolvedConfig?.weappVite?.runtime ?? 'miniprogram'
    const { sidecarWatcherMap } = ctx.runtimeState.watcher
    const activeWatcher = sidecarWatcherMap.get(ROUTE_WATCHER_KEY)
    if (isAutoRoutesWatcherController(activeWatcher)) {
      activeWatcher.addWatchTargets(watchDirs)
      activeWatcher.subscribers.set(subscriberId, watcherSubscriber)
      return
    }
    if (activeWatcher) {
      return
    }
    const subscribers = new Map<WeappViteRuntime, AutoRoutesWatcherSubscriber>([
      [subscriberId, watcherSubscriber],
    ])

    const watcher = chokidar.watch(watchDirs, createSidecarWatchOptions(configService, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 80,
        pollInterval: 20,
      },
    }))
    const sidecarWatcher = createAutoRoutesSidecarWatcher(watcher)
    const controller: AutoRoutesWatcherController = {
      addWatchTargets(paths) {
        watcher.add(paths)
      },
      subscribers,
      async close() {
        if (sidecarWatcherMap.get(ROUTE_WATCHER_KEY) === controller) {
          sidecarWatcherMap.delete(ROUTE_WATCHER_KEY)
        }
        controller.subscribers.clear()
        await sidecarWatcher.close()
      },
    }

    watcher.on('add', (filePath) => {
      if (!isAutoRoutesWatchFile(
        filePath,
        allowedExtensions,
        isPagesRelatedPath,
        service.isPageDeclarationSource,
      )) {
        return
      }
      logger.info(`[auto-routes:watch] 新增路由文件 ${configService.relativeCwd(filePath)}`)
      void handleRouteStructureChange(filePath, 'create', controller).catch((error) => {
        reportRouteStructureChangeError(filePath, 'create', error, controller)
      })
    })

    watcher.on('unlink', (filePath) => {
      if (!isAutoRoutesWatchFile(
        filePath,
        allowedExtensions,
        isPagesRelatedPath,
        service.isPageDeclarationSource,
      )) {
        return
      }
      logger.info(`[auto-routes:watch] 删除路由文件 ${configService.relativeCwd(filePath)}`)
      void handleRouteStructureChange(filePath, 'delete', controller).catch((error) => {
        reportRouteStructureChangeError(filePath, 'delete', error, controller)
      })
    })

    // 注册到 sidecarWatcherMap，由 watcherService.closeAll() 统一回收
    sidecarWatcherMap.set(ROUTE_WATCHER_KEY, controller)
  }

  return {
    name: 'weapp-vite:auto-routes',
    enforce: 'pre',

    config() {
      return {
        resolve: {
          alias: [{ find: WEVU_AUTO_ROUTES_MODULE_ID, replacement: WEVU_AUTO_ROUTES_VIRTUAL_MODULE_ID }],
        },
      }
    },

    configResolved(config) {
      resolvedConfig = config
      refreshAutoRoutesAliasTargets()
    },

    configureServer(server) {
      devServer = server
    },

    buildStart() {
      registerPageDeclarationSourceResolver(this)
      refreshAutoRoutesAliasTargets()
      startRouteFileWatcher()
    },

    resolveId(id) {
      const startedAt = performance.now()
      try {
        return resolveAutoRoutesVirtualId(id, autoRoutesAliasTargets)
      }
      finally {
        const profile = ctx.runtimeState?.build?.hmr?.profile
        recordHmrProfileDuration(profile, 'pluginResolveMs', performance.now() - startedAt)
        recordHmrProfileOperation(profile, 'resolveCount')
      }
    },

    async load(id) {
      const resolvedId = resolveAutoRoutesVirtualId(id, autoRoutesAliasTargets)
      if (!resolvedId) {
        return null
      }
      registerPageDeclarationSourceResolver(this)

      if (resolvedId === WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID && !service.isEnabled()) {
        this.error(`${WEVU_AUTO_ROUTES_MODULE_ID} 需要启用 weapp.autoRoutes。`)
      }

      await service.ensureFresh()
      if (isAutoRoutesWatchMode(ctx.configService)) {
        // serve 的 addWatchFile 会创建隐式导入，不能让纯数据模块反向依赖页面。
        const watchContext = resolvedConfig?.command === 'serve'
          ? { addWatchFile: (file: string) => devServer?.watcher.add(file) }
          : this
        addAutoRoutesWatchTargets(watchContext, {
          files: service.getWatchFiles(),
          directories: resolvedConfig?.command === 'serve' ? [] : service.getWatchDirectories(),
        })
      }
      startRouteFileWatcher()
      if (resolvedConfig?.weappVite?.runtime === 'web') {
        servedRouteSignature ??= service.getSignature()
      }

      return {
        code: resolvedId === WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID
          ? service.getNamedModuleCode()
          : service.getModuleCode(),
        map: { mappings: '' },
      }
    },

    async transform(code, id) {
      if (!code.includes(WEVU_DEFINE_PAGE_MACRO) && !code.includes('\\')) {
        return null
      }
      const normalizedId = normalizeFsResolvedId(id)
      if (!isPageScriptTransformRequest(id, normalizedId)) {
        return null
      }
      registerPageDeclarationSourceResolver(this)
      await service.ensureFresh()
      startRouteFileWatcher()
      if (!service.isPageDeclarationSource(normalizedId)) {
        return null
      }
      const stripped = stripPageDeclaration(code, id)
      return stripped
        ? { code: stripped.code, map: normalizeEncodedSourceMapLike(stripped.map) }
        : null
    },

    shouldTransformCachedModule({ id }) {
      return autoRoutesTopologyDirtyEntries.delete(id) || undefined
    },

    async watchChange(id, change) {
      registerPageDeclarationSourceResolver(this)
      const event = change?.event
      if (service.isRouteFile(id)) {
        if (resolvedConfig?.command === 'serve' && event === 'update') {
          return
        }
        await service.handleFileChange(id, resolveAutoRoutesWatchChangeEvent(event) ?? event)
        startRouteFileWatcher()
        return
      }

      if (!isPagesRelatedPath(id)) {
        return
      }

      // 仅在结构性变化（如新增/删除文件）时，对未命中的 pages 路径触发全量重扫。
      const resolvedEvent = resolveAutoRoutesWatchChangeEvent(event)
      if (resolvedEvent) {
        await service.handleFileChange(id, resolvedEvent)
        startRouteFileWatcher()
      }
    },

    async handleHotUpdate(context) {
      const changedSource = normalizeFsResolvedId(context.file)
      const webRuntime = resolvedConfig?.weappVite?.runtime === 'web'
      const topologyChanged = webRuntime && autoRoutesTopologyDirtyEntries.delete(changedSource)
      const declarationOwners = new Set(service.getPageDeclarationOwners(changedSource))
      const routeFile = service.isRouteFile(context.file)
      const hotUpdateAction = resolveAutoRoutesHotUpdateAction(resolvedConfig?.command, {
        isRouteFile: routeFile,
        isPagesRelatedPath: routeFile ? false : isPagesRelatedPath(context.file),
      })
      if (!hotUpdateAction.shouldHandle && !topologyChanged) {
        return
      }
      let didChangeRoutes = false
      if (hotUpdateAction.shouldUpdateRouteFile) {
        didChangeRoutes = await service.handleFileChange(context.file, 'update')
        startRouteFileWatcher()
        for (const owner of service.getPageDeclarationOwners(changedSource)) {
          declarationOwners.add(owner)
        }
      }

      declarationOwners.delete(changedSource)
      if (
        resolvedConfig?.command === 'serve'
        && routeFile
        && !didChangeRoutes
        && declarationOwners.size === 0
      ) {
        return
      }

      const signature = webRuntime ? service.getSignature() : undefined
      const reloadRoutes = webRuntime
        && (topologyChanged || (servedRouteSignature !== undefined && signature !== servedRouteSignature))
      const modules = new Set<ModuleNode>(!webRuntime || reloadRoutes
        ? AUTO_ROUTES_RESOLVED_IDS
            .map(id => context.server.moduleGraph.getModuleById(id))
            .filter((module): module is ModuleNode => Boolean(module))
        : context.modules)
      for (const owner of declarationOwners) {
        const ownerModules = context.server.moduleGraph.getModulesByFile(owner)
        if (ownerModules) {
          for (const module of ownerModules) {
            modules.add(module)
          }
          continue
        }
        const ownerModule = context.server.moduleGraph.getModuleById(owner)
        if (ownerModule) {
          modules.add(ownerModule)
        }
      }
      if (topologyChanged) {
        for (const module of context.modules) {
          modules.add(module)
        }
      }
      if (modules.size > 0) {
        if (reloadRoutes) {
          servedRouteSignature = signature
          return collectAutoRoutesReloadModules(modules)
        }
        return [...modules]
      }

      return context.modules.filter((module) => {
        return module.id !== null
          && (AUTO_ROUTES_RESOLVED_IDS.includes(module.id) || declarationOwners.has(normalizeFsResolvedId(module.id)))
      })
    },

    async closeBundle() {
      if (resolvedConfig?.command !== 'serve') {
        return
      }
      const watcher = ctx.runtimeState.watcher.sidecarWatcherMap.get(ROUTE_WATCHER_KEY)
      const subscriberId = resolvedConfig.weappVite?.runtime ?? 'miniprogram'
      if (
        !isAutoRoutesWatcherController(watcher)
        || watcher.subscribers.get(subscriberId) !== watcherSubscriber
      ) {
        return
      }
      watcher.subscribers.delete(subscriberId)
      if (watcher.subscribers.size === 0) {
        await watcher.close()
      }
    },
  }
}

export function autoRoutes(ctx: MutableCompilerContext): Plugin[] {
  if (!ctx.autoRoutesService || !ctx.configService) {
    return []
  }
  return [createAutoRoutesPlugin(ctx, ctx.autoRoutesService)]
}
