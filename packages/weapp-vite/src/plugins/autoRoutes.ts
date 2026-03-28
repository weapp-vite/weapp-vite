import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import chokidar from 'chokidar'
import { vueExtensions } from '../constants'
import { logger } from '../context/shared'
import {
  isAutoRoutesPagesRelatedPath,
  resolveAutoRoutesAliasTargets,
  resolveAutoRoutesMatcherContext,
} from '../runtime/autoRoutesPlugin/shared'
import { createSidecarWatchOptions } from '../runtime/watch/options'
import { normalizeWatchPath } from '../utils/path'
import {
  collectAutoRoutesWatchDirs,
  isAutoRoutesWatchFile,
  isAutoRoutesWatchMode,
  resolveAutoRoutesHotUpdateAction,
  resolveAutoRoutesVirtualId,
  resolveAutoRoutesWatchChangeEvent,
  RESOLVED_VIRTUAL_ID,
} from './autoRoutes.shared'

/**
 * 路由文件监听器的唯一标识，用于在 sidecarWatcherMap 中注册。
 */
const ROUTE_WATCHER_KEY = '__auto-routes-vue-watcher__'

function createAutoRoutesPlugin(ctx: CompilerContext): Plugin {
  const service = ctx.autoRoutesService
  let resolvedConfig: ResolvedConfig | undefined
  const autoRoutesAliasTargets = new Set<string>()
  let routeWatcherStarted = false

  const refreshAutoRoutesAliasTargets = () => {
    autoRoutesAliasTargets.clear()
    for (const target of resolveAutoRoutesAliasTargets(ctx.configService?.packageInfo?.rootPath)) {
      autoRoutesAliasTargets.add(target)
    }
  }

  const addWatchTargets = (pluginCtx: Pick<Plugin, 'name'> & { addWatchFile?: (id: string) => void }) => {
    for (const file of service.getWatchFiles()) {
      try {
        pluginCtx.addWatchFile?.(normalizeWatchPath(file))
      }
      catch { }
    }

    for (const dir of service.getWatchDirectories()) {
      try {
        pluginCtx.addWatchFile?.(normalizeWatchPath(dir))
      }
      catch { }
    }
  }

  function isPagesRelatedPath(id: string) {
    const configService = ctx.configService
    if (!configService) {
      return false
    }
    const { autoRoutesConfig, subPackageRoots } = resolveAutoRoutesMatcherContext(ctx)
    return isAutoRoutesPagesRelatedPath(id, {
      cwd: configService.cwd,
      absoluteSrcRoot: configService.absoluteSrcRoot,
      include: autoRoutesConfig.include,
      subPackageRoots,
    })
  }

  /**
   * 启动 chokidar 监听 pages 目录下的路由文件增删。
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
    if (routeWatcherStarted) {
      return
    }

    const configService = ctx.configService
    if (!configService?.isDev) {
      return
    }

    const { autoRoutesConfig, matcher: resolvedMatcher } = resolveAutoRoutesMatcherContext(ctx)
    if (!autoRoutesConfig.enabled || !autoRoutesConfig.watch || !service.isEnabled()) {
      return
    }

    const allowedExtensions = new Set(vueExtensions.map(ext => `.${ext}`))
    const watchDirs = collectAutoRoutesWatchDirs(
      service.getWatchDirectories(),
      resolvedMatcher.getWatchRoots(configService.absoluteSrcRoot),
    )

    if (watchDirs.length === 0) {
      return
    }

    const watcher = chokidar.watch(watchDirs, createSidecarWatchOptions(configService, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 80,
        pollInterval: 20,
      },
    }))

    watcher.on('add', (filePath) => {
      if (!isAutoRoutesWatchFile(filePath, allowedExtensions, isPagesRelatedPath)) {
        return
      }
      logger.info(`[auto-routes:watch] 新增路由文件 ${configService.relativeCwd(filePath)}`)
      void service.handleFileChange(filePath, 'create')
    })

    watcher.on('unlink', (filePath) => {
      if (!isAutoRoutesWatchFile(filePath, allowedExtensions, isPagesRelatedPath)) {
        return
      }
      logger.info(`[auto-routes:watch] 删除路由文件 ${configService.relativeCwd(filePath)}`)
      void service.handleFileChange(filePath, 'delete')
    })

    // 注册到 sidecarWatcherMap，由 watcherService.closeAll() 统一回收
    const { sidecarWatcherMap } = ctx.runtimeState.watcher
    sidecarWatcherMap.set(ROUTE_WATCHER_KEY, {
      close: () => void watcher.close(),
    })

    routeWatcherStarted = true
  }

  return {
    name: 'weapp-vite:auto-routes',
    enforce: 'pre',

    configResolved(config) {
      resolvedConfig = config
      refreshAutoRoutesAliasTargets()
    },

    buildStart() {
      refreshAutoRoutesAliasTargets()
      startRouteFileWatcher()
    },

    resolveId(id) {
      return resolveAutoRoutesVirtualId(id, autoRoutesAliasTargets)
    },

    async load(id) {
      if (resolveAutoRoutesVirtualId(id, autoRoutesAliasTargets) !== RESOLVED_VIRTUAL_ID) {
        return null
      }

      await service.ensureFresh()
      if (isAutoRoutesWatchMode(ctx.configService)) {
        addWatchTargets(this as any)
      }
      startRouteFileWatcher()

      return {
        code: service.getModuleCode(),
        map: { mappings: '' },
      }
    },

    async watchChange(id, change) {
      const event = change?.event
      if (service.isRouteFile(id)) {
        await service.handleFileChange(id, event)
        return
      }

      if (!isPagesRelatedPath(id)) {
        return
      }

      // 仅在结构性变化（如新增/删除文件）时，对未命中的 pages 路径触发全量重扫。
      const resolvedEvent = resolveAutoRoutesWatchChangeEvent(event)
      if (resolvedEvent) {
        await service.handleFileChange(id, resolvedEvent)
      }
    },

    async handleHotUpdate(context) {
      const routeFile = service.isRouteFile(context.file)
      const hotUpdateAction = resolveAutoRoutesHotUpdateAction(resolvedConfig?.command, {
        isRouteFile: routeFile,
        isPagesRelatedPath: routeFile ? false : isPagesRelatedPath(context.file),
      })
      if (!hotUpdateAction.shouldHandle) {
        return
      }
      if (hotUpdateAction.shouldUpdateRouteFile) {
        await service.handleFileChange(context.file, 'update')
      }

      const virtualModule = context.server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID)
      if (virtualModule) {
        return [virtualModule]
      }

      return context.modules.filter(module => module.id === RESOLVED_VIRTUAL_ID)
    },
  }
}

export function autoRoutes(ctx: CompilerContext): Plugin[] {
  return [createAutoRoutesPlugin(ctx)]
}
