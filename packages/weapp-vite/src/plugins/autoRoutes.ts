import type { PluginContext } from 'rolldown'
import type { EnvironmentModuleNode, Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { WeappViteRuntime } from '../pluginHost'
import type { AutoRoutesService } from '../runtime/autoRoutesPlugin/service'
import { realpath } from 'node:fs/promises'
import {
  WEAPP_VITE_WEB_AUTO_ROUTES_RESOLVED_MODULE_ID,
  WEAPP_VITE_WEB_ENTRY_RESOLVED_MODULE_ID,
  WEVU_AUTO_ROUTES_MODULE_ID,
  WEVU_AUTO_ROUTES_VIRTUAL_MODULE_ID,
} from '@weapp-core/constants'
import { removeExtensionDeep } from '@weapp-core/shared'
import chokidar from 'chokidar'
import { mayContainPageDeclaration, stripPageDeclaration } from 'wevu/compiler'
import { scriptExtensions, vueExtensions } from '../constants'
import { logger } from '../context/shared'
import { resolveAutoRoutesManagedOutputPaths } from '../runtime/autoRoutesPlugin/generatedPaths'
import {
  isAutoRoutesPagesRelatedPath,
  resolveAutoRoutesAliasTargets,
  resolveAutoRoutesMatcherContext,
  resolveAutoRoutesPath,
} from '../runtime/autoRoutesPlugin/shared'
import { publishAutoRoutesTopology, registerAutoRoutesTopologySource } from '../runtime/autoRoutesPlugin/topology'
import { createAutoRoutesWatchDirectoryRegistry } from '../runtime/autoRoutesPlugin/watchDirectories'
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
const AUTO_ROUTES_RESOLVED_IDS: readonly string[] = [
  RESOLVED_VIRTUAL_ID,
  WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID,
  // Web 的路由快照由扫描入口生成，刷新前必须失效入口与其路由模块。
  WEAPP_VITE_WEB_ENTRY_RESOLVED_MODULE_ID,
  WEAPP_VITE_WEB_AUTO_ROUTES_RESOLVED_MODULE_ID,
]
const AUTO_ROUTES_VUE_SUFFIXES = vueExtensions.map(extension => `.${extension}`)

interface AutoRoutesWatcherSubscriber {
  readonly topologyDirtyEntries: Set<string>
  readonly devServer?: ViteDevServer
}

interface AutoRoutesWatcherController {
  addWatchTargets: (paths: string[]) => void
  readonly ownsFile: (filePath: string) => boolean
  readonly subscribers: Map<WeappViteRuntime, AutoRoutesWatcherSubscriber>
  readonly servingSubscribers: Map<WeappViteRuntime, AutoRoutesWatcherSubscriber>
  close: () => void | Promise<void>
}

interface PendingRouteStructureChange {
  filePath: string
  event: 'create' | 'delete'
  controller: AutoRoutesWatcherController
  receivedAtMs: number
}

interface RouteStructureChangeResult {
  controller: AutoRoutesWatcherController
  changedSource: string
  declarationOwners: Set<string>
  didChangeRoutes: boolean
  change: {
    file: string
    event: 'create' | 'delete'
    topologyChanged: boolean
    receivedAtMs: number
  }
}

function isAutoRoutesWatcherController(watcher: unknown): watcher is AutoRoutesWatcherController {
  return Boolean(
    watcher
    && typeof watcher === 'object'
    && 'addWatchTargets' in watcher
    && typeof watcher.addWatchTargets === 'function'
    && 'ownsFile' in watcher
    && typeof watcher.ownsFile === 'function'
    && 'close' in watcher
    && typeof watcher.close === 'function'
    && 'subscribers' in watcher
    && watcher.subscribers instanceof Map
    && 'servingSubscribers' in watcher
    && watcher.servingSubscribers instanceof Map,
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
  let pendingRouteStructureChanges: PendingRouteStructureChange[] = []
  let routeStructureChangeTimer: ReturnType<typeof setTimeout> | undefined
  // sidecar 可能在同一次文件操作中同时发出 add/unlink。所有扫描必须串行，
  // 否则后完成的旧快照会覆盖较新的路由拓扑（尤其是目录 rename）。
  let routeStructureChangeQueue = Promise.resolve()
  const autoRoutesAliasTargets = new Set<string>()
  const autoRoutesTopologyDirtyEntries = new Set<string>()
  const watcherSubscriber: AutoRoutesWatcherSubscriber = {
    topologyDirtyEntries: autoRoutesTopologyDirtyEntries,
    get devServer() {
      return devServer
    },
  }

  function createPageDeclarationSourceResolver(pluginContext: PluginContext): Parameters<AutoRoutesService['setPageDeclarationSourceResolver']>[0] {
    return typeof pluginContext.resolve === 'function'
      ? async (source, importer) => {
        const resolved = await pluginContext.resolve(source, importer, { skipSelf: true })
        return resolved?.id
      }
      : undefined
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
      controller.servingSubscribers.get('web')?.topologyDirtyEntries.add(normalizeFsResolvedId(appEntry))
    }
    return markAppEntryForAutoRoutesTopology(ctx, {
      resolvedEntryMap: ctx.runtimeState.build.hmr.resolvedEntryMap as Map<string, unknown>,
      markEntryDirty(entryId) {
        const hmr = ctx.runtimeState.build.hmr
        for (const subscriber of new Set([...controller.subscribers.values(), ...controller.servingSubscribers.values()])) {
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

  function isCurrentRouteWatcher(controller: AutoRoutesWatcherController) {
    return ctx.runtimeState.watcher.sidecarWatcherMap.get(ROUTE_WATCHER_KEY) === controller
  }

  function reportRouteStructureChangeError(
    filePath: string,
    event: 'create' | 'delete',
    error: unknown,
    controller: AutoRoutesWatcherController,
  ) {
    if (!isCurrentRouteWatcher(controller)) {
      return
    }
    const action = event === 'create' ? '新增' : '删除'
    const reason = error instanceof Error ? error.message : String(error)
    const routeError = new Error(
      `[auto-routes:watch] ${action}路由文件 ${ctx.configService?.relativeCwd(filePath) ?? filePath} 处理失败：${reason}`,
    )
    const servers = new Set<ViteDevServer>()
    for (const subscriber of controller.servingSubscribers.values()) {
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

  async function applyRouteStructureChange(
    filePath: string,
    event: 'create' | 'delete',
    controller: AutoRoutesWatcherController,
    receivedAtMs: number,
  ): Promise<RouteStructureChangeResult | undefined> {
    if (!isCurrentRouteWatcher(controller)) {
      return undefined
    }
    const changedSource = normalizeFsResolvedId(filePath)
    const declarationOwners = new Set(service.getPageDeclarationOwners(changedSource))
    const previousSignature = service.getSignature()
    const didChangeRoutes = await service.handleFileChange(filePath, resolveAutoRoutesWatchChangeEvent(event))
    // 关闭或替换期间完成的扫描不再拥有 watcher、构建图和错误通知。
    if (!isCurrentRouteWatcher(controller)) {
      return undefined
    }
    controller.addWatchTargets([...service.getWatchDirectories()])
    const change = {
      file: filePath,
      event,
      topologyChanged: previousSignature !== service.getSignature(),
      receivedAtMs,
    }
    for (const owner of service.getPageDeclarationOwners(changedSource)) {
      declarationOwners.add(owner)
    }
    return { controller, changedSource, declarationOwners, didChangeRoutes, change }
  }

  async function publishRouteStructureChanges(results: RouteStructureChangeResult[]) {
    const current = results.filter(result => isCurrentRouteWatcher(result.controller))
    if (current.length === 0) {
      return
    }
    const controller = current[0]!.controller
    const didChangeRoutes = current.some(result => result.didChangeRoutes)
    const topologyChanged = didChangeRoutes || current.some(result => result.change.topologyChanged)
    const servers = new Set<ViteDevServer>()
    if (topologyChanged) {
      for (const subscriber of controller.servingSubscribers.values()) {
        if (subscriber.devServer) {
          servers.add(subscriber.devServer)
        }
      }
      for (const server of servers) {
        invalidateAutoRoutesVirtualModules(server, AUTO_ROUTES_RESOLVED_IDS)
      }
      markAutoRoutesTopologyDirty(controller)
      ctx.scanService?.markDirty()
    }
    // 一次递归删除通常会产生多个 unlink；全部扫描完成后只向宿主发布一次，
    // 避免在文件集合处于中间态时启动 snapshot 构建。
    const last = current[current.length - 1]!
    const change = {
      ...last.change,
      topologyChanged,
      // 一次发布可以合并多个结构事件，但来源不能压缩为最后一个文件。
      ...(current.length > 1 ? { sourceChanges: current.map(result => result.change) } : {}),
    }
    const nativeNotified = publishAutoRoutesTopology(ctx, change)
    if (!topologyChanged) {
      return
    }
    const notificationFiles = new Set<string>()
    for (const result of current) {
      for (const owner of result.declarationOwners) {
        if (owner !== result.changedSource) {
          notificationFiles.add(owner)
        }
      }
    }
    const appEntryPath = ctx.scanService?.appEntry?.path
    if (appEntryPath) {
      notificationFiles.add(appEntryPath)
    }
    const webSubscriber = controller.servingSubscribers.get('web')
    const fullReloadServers = new Set<ViteDevServer>()
    const notificationServers = new Map<ViteDevServer, AutoRoutesWatcherSubscriber>()
    for (const [runtime, subscriber] of controller.servingSubscribers) {
      if (!subscriber.devServer) {
        continue
      }
      if (runtime === 'web') {
        fullReloadServers.add(subscriber.devServer)
      }
      else if (!(runtime === 'miniprogram' && nativeNotified)) {
        notificationServers.set(subscriber.devServer, subscriber)
      }
    }
    // Web 的扫描状态由 Web plugin 的 watchChange 维护。sidecar 事件绕过
    // Vite watcher 时，必须等待它完成扫描，再发送 full-reload，否则入口会
    // 在旧的页面脚本集合上重新求值，路由表虽已更新但页面 loader 仍缺失。
    for (const server of fullReloadServers) {
      for (const result of current) {
        if (!isCurrentRouteWatcher(controller) || controller.servingSubscribers.get('web') !== webSubscriber || webSubscriber?.devServer !== server) {
          break
        }
        await server.pluginContainer.watchChange(result.changedSource, {
          event: result.change.event,
        })
      }
    }
    if (!isCurrentRouteWatcher(controller)) {
      return
    }
    // Web 的入口在创建 router 时会捕获路由快照。扫描完成后直接发送一次
    // full-reload，避免把 app entry 伪装成文件变更而被 Vite watcher 丢弃。
    for (const server of fullReloadServers) {
      if (controller.servingSubscribers.get('web') === webSubscriber && webSubscriber?.devServer === server) {
        server.ws.send({ type: 'full-reload' })
      }
    }
    for (const [server, subscriber] of notificationServers) {
      if (subscriber.devServer !== server || ![...controller.servingSubscribers.values()].includes(subscriber)) {
        continue
      }
      for (const file of notificationFiles) {
        server.watcher.emit('change', file)
      }
    }
  }

  async function processRouteStructureChangeBatch(changes: PendingRouteStructureChange[]) {
    const results: RouteStructureChangeResult[] = []
    for (const { filePath, event, controller, receivedAtMs } of changes) {
      try {
        const result = await applyRouteStructureChange(filePath, event, controller, receivedAtMs)
        if (result) {
          results.push(result)
        }
      }
      catch (error) {
        reportRouteStructureChangeError(filePath, event, error, controller)
      }
    }
    await publishRouteStructureChanges(results)
  }

  function enqueueRouteStructureChangeBatch(changes: PendingRouteStructureChange[]) {
    const run = routeStructureChangeQueue
      .catch(() => { })
      .then(() => processRouteStructureChangeBatch(changes))
      .catch((error) => {
        const first = changes[0]
        if (first) {
          reportRouteStructureChangeError(first.filePath, first.event, error, first.controller)
        }
      })
    routeStructureChangeQueue = run
    return run
  }

  function scheduleRouteStructureChange(filePath: string, event: 'create' | 'delete', controller: AutoRoutesWatcherController) {
    const receivedAtMs = performance.now()
    pendingRouteStructureChanges.push({ filePath, event, controller, receivedAtMs })
    clearTimeout(routeStructureChangeTimer)
    // chokidar 不会为 unlink 应用 awaitWriteFinish；增删使用同一稳定窗口，
    // 让目录重命名、递归删除只发布一次完整拓扑。
    routeStructureChangeTimer = setTimeout(() => {
      routeStructureChangeTimer = undefined
      const changes = pendingRouteStructureChanges
      pendingRouteStructureChanges = []
      void enqueueRouteStructureChangeBatch(changes)
    }, 80)
    routeStructureChangeTimer.unref?.()
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
    const isServingSubscriber = resolvedConfig?.command === 'serve' || Boolean(devServer)
    const { sidecarWatcherMap } = ctx.runtimeState.watcher
    const activeWatcher = sidecarWatcherMap.get(ROUTE_WATCHER_KEY)
    if (isAutoRoutesWatcherController(activeWatcher)) {
      activeWatcher.addWatchTargets(watchDirs)
      activeWatcher.subscribers.set(subscriberId, watcherSubscriber)
      // snapshot 只替换本轮缓存失效接收者，不能夺走长期宿主的通知与清理所有权。
      if (isServingSubscriber) {
        activeWatcher.servingSubscribers.set(subscriberId, watcherSubscriber)
      }
      return
    }
    if (activeWatcher) {
      return
    }
    const subscribers = new Map<WeappViteRuntime, AutoRoutesWatcherSubscriber>([
      [subscriberId, watcherSubscriber],
    ])
    const servingSubscribers = new Map<WeappViteRuntime, AutoRoutesWatcherSubscriber>()
    if (isServingSubscriber) {
      servingSubscribers.set(subscriberId, watcherSubscriber)
    }

    const watchDirectories = createAutoRoutesWatchDirectoryRegistry()
    // 源目录作为持久锚点，页面根目录整体删除后仍能观察其恢复。
    const watcher = chokidar.watch(watchDirectories.add([...watchDirs, configService.absoluteSrcRoot]), createSidecarWatchOptions(configService, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 80,
        pollInterval: 20,
      },
    }))
    const sidecarWatcher = createAutoRoutesSidecarWatcher(watcher)
    const ownsTopologyFile = (filePath: string) => {
      const { autoRoutesConfig: currentConfig, matcher } = resolveAutoRoutesMatcherContext(ctx)
      const resolved = resolveAutoRoutesPath(filePath, configService)
      const matchesRoute = service.isPageDeclarationSource(filePath)
        || Boolean(resolved && isPagesRelatedPath(filePath) && matcher.matches(removeExtensionDeep(resolved.relativePath)))
      return currentConfig.enabled && currentConfig.watch && service.isEnabled() && isAutoRoutesWatchFile(
        filePath,
        allowedExtensions,
        () => matchesRoute,
        service.isPageDeclarationSource,
      )
    }
    const releaseTopologySource = registerAutoRoutesTopologySource(ctx, ownsTopologyFile)
    const controller: AutoRoutesWatcherController = {
      ownsFile: ownsTopologyFile,
      addWatchTargets(paths) {
        const additions = watchDirectories.add(paths)
        if (additions.length > 0) {
          watcher.add(additions)
        }
      },
      subscribers,
      servingSubscribers,
      async close() {
        if (pendingRouteStructureChanges.some(change => change.controller === controller)) {
          pendingRouteStructureChanges = pendingRouteStructureChanges.filter(change => change.controller !== controller)
          if (pendingRouteStructureChanges.length === 0) {
            clearTimeout(routeStructureChangeTimer)
            routeStructureChangeTimer = undefined
          }
        }
        releaseTopologySource()
        if (sidecarWatcherMap.get(ROUTE_WATCHER_KEY) === controller) {
          sidecarWatcherMap.delete(ROUTE_WATCHER_KEY)
        }
        controller.subscribers.clear()
        controller.servingSubscribers.clear()
        await sidecarWatcher.close()
      },
    }

    watcher.on('add', (filePath) => {
      if (!isCurrentRouteWatcher(controller) || !ownsTopologyFile(filePath)) {
        return
      }
      logger.info(`[auto-routes:watch] 新增路由文件 ${configService.relativeCwd(filePath)}`)
      scheduleRouteStructureChange(filePath, 'create', controller)
    })

    watcher.on('unlink', (filePath) => {
      if (!isCurrentRouteWatcher(controller) || !ownsTopologyFile(filePath)) {
        return
      }
      logger.info(`[auto-routes:watch] 删除路由文件 ${configService.relativeCwd(filePath)}`)
      scheduleRouteStructureChange(filePath, 'delete', controller)
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
      refreshAutoRoutesAliasTargets()
      if (this.meta?.watchMode && service.isEnabled()) {
        return service.ensureFresh(createPageDeclarationSourceResolver(this)).then(async () => {
          addAutoRoutesWatchTargets(this, {
            files: service.getWatchFiles(),
            // 原生 watcher 按真实路径登记目录；符号链接根目录不能漏掉新增文件。
            directories: await Promise.all([...service.getWatchDirectories()].map(dir => realpath(dir).catch(() => dir))),
          })
          if (resolvedConfig?.command === 'serve' && resolvedConfig.weappVite?.runtime === 'web') {
            startRouteFileWatcher()
          }
        })
      }
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
      if (resolvedId === WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID && !service.isEnabled()) {
        this.error(`${WEVU_AUTO_ROUTES_MODULE_ID} 需要启用 weapp.autoRoutes。`)
      }

      await service.ensureFresh(createPageDeclarationSourceResolver(this))
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
      if (!mayContainPageDeclaration(code)) {
        return null
      }
      const normalizedId = normalizeFsResolvedId(id)
      if (!isPageScriptTransformRequest(id, normalizedId)) {
        return null
      }
      await service.ensureFresh(createPageDeclarationSourceResolver(this))
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
      const event = change?.event
      if (resolvedConfig?.command === 'serve'
        && (resolvedConfig.weappVite?.runtime === 'web' || resolvedConfig.weappVite?.runtime === 'miniprogram')
        && (event === 'create' || event === 'delete')) {
        const watcher = ctx.runtimeState.watcher.sidecarWatcherMap.get(ROUTE_WATCHER_KEY)
        if (isAutoRoutesWatcherController(watcher)
          && watcher.servingSubscribers.get(resolvedConfig.weappVite?.runtime ?? 'miniprogram') === watcherSubscriber
          && watcher.ownsFile(id)) {
          // sidecar 独占结构变更；提前重扫并 add 新目录会吞掉 ignoreInitial 下的新增事件。
          return
        }
      }
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

    hotUpdate: {
      // 共享路由先刷新，Web consumer 才能在本轮 HMR 发布完整入口。
      order: 'pre',
      async handler(context) {
        if (this.environment.name !== 'client') {
          return
        }
        const webRuntime = resolvedConfig?.weappVite?.runtime === 'web'
        if (context.type !== 'update') {
          const watcher = ctx.runtimeState.watcher.sidecarWatcherMap.get(ROUTE_WATCHER_KEY)
          // 路由 watcher 扫描完成后统一通知 App，避免 Vite 提前刷新后再次重置页面。
          if (webRuntime && isAutoRoutesWatcherController(watcher)
            && watcher.servingSubscribers.get('web') === watcherSubscriber
            && watcher.ownsFile(context.file)) {
            return []
          }
          return
        }
        const moduleGraph = this.environment.moduleGraph
        const changedSource = normalizeFsResolvedId(context.file)
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
          if (webRuntime && didChangeRoutes) {
            ctx.scanService?.markDirty()
          }
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
          && (servedRouteSignature === undefined ? topologyChanged : signature !== servedRouteSignature)
        const modules = new Set<EnvironmentModuleNode>(!webRuntime || reloadRoutes
          ? AUTO_ROUTES_RESOLVED_IDS
              .map(id => moduleGraph.getModuleById(id))
              .filter((module): module is EnvironmentModuleNode => Boolean(module))
          : context.modules)
        for (const owner of declarationOwners) {
          const ownerModules = moduleGraph.getModulesByFile(owner)
          if (ownerModules) {
            for (const module of ownerModules) {
              modules.add(module)
            }
            continue
          }
          const ownerModule = moduleGraph.getModuleById(owner)
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
    },

    async closeBundle() {
      if (resolvedConfig?.command !== 'serve') {
        return
      }
      const watcher = ctx.runtimeState.watcher.sidecarWatcherMap.get(ROUTE_WATCHER_KEY)
      const subscriberId = resolvedConfig.weappVite?.runtime ?? 'miniprogram'
      if (
        !isAutoRoutesWatcherController(watcher)
        || watcher.servingSubscribers.get(subscriberId) !== watcherSubscriber
      ) {
        return
      }
      watcher.servingSubscribers.delete(subscriberId)
      // 已确认当前宿主仍持有租约；同 runtime 的 snapshot 缓存不能独立延长 watcher 生命周期。
      watcher.subscribers.delete(subscriberId)
      if (watcher.subscribers.size === 0 && watcher.servingSubscribers.size === 0) {
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
