import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import chokidar from 'chokidar'
import path from 'pathe'
import { resolveWeappAutoRoutesConfig } from '../autoRoutesConfig'
import { vueExtensions } from '../constants'
import { logger } from '../context/shared'
import { createAutoRoutesMatcher } from '../runtime/autoRoutesPlugin/matcher'
import {
  isAliasedAutoRoutesId,
  isAutoRoutesPagesRelatedPath,
  resolveAutoRoutesAliasTargets,
} from '../runtime/autoRoutesPlugin/shared'
import { getAutoRoutesSubPackageRoots } from '../runtime/autoRoutesPlugin/subPackageRoots'
import { createSidecarWatchOptions } from '../runtime/watch/options'
import { normalizeWatchPath } from '../utils/path'

const AUTO_ROUTES_ID = 'weapp-vite/auto-routes'
const VIRTUAL_MODULE_ID = 'virtual:weapp-vite-auto-routes'
const RESOLVED_VIRTUAL_ID = '\0weapp-vite:auto-routes'

/**
 * 路由文件监听器的唯一标识，用于在 sidecarWatcherMap 中注册。
 */
const ROUTE_WATCHER_KEY = '__auto-routes-vue-watcher__'

function createAutoRoutesPlugin(ctx: CompilerContext): Plugin {
  const service = ctx.autoRoutesService
  let resolvedConfig: ResolvedConfig | undefined
  const autoRoutesAliasTargets = new Set<string>()
  let routeWatcherStarted = false

  const isWatchMode = () => {
    const configService = ctx.configService
    return Boolean(configService?.isDev || configService?.inlineConfig?.build?.watch)
  }

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
    const autoRoutesConfig = resolveWeappAutoRoutesConfig(configService.weappViteConfig?.autoRoutes)
    return isAutoRoutesPagesRelatedPath(id, {
      cwd: configService.cwd,
      absoluteSrcRoot: configService.absoluteSrcRoot,
      include: autoRoutesConfig.include,
      subPackageRoots: getAutoRoutesSubPackageRoots(ctx),
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

    const autoRoutesConfig = resolveWeappAutoRoutesConfig(configService.weappViteConfig?.autoRoutes)
    if (!autoRoutesConfig.enabled || !autoRoutesConfig.watch || !service.isEnabled()) {
      return
    }

    const srcRoot = configService.absoluteSrcRoot
    const subPackageRoots = getAutoRoutesSubPackageRoots(ctx)
    const resolvedMatcher = createAutoRoutesMatcher(autoRoutesConfig.include, subPackageRoots)
    const allowedExtensions = new Set(vueExtensions.map(ext => `.${ext}`))
    const watchDirs = new Set<string>()

    for (const dir of service.getWatchDirectories()) {
      watchDirs.add(dir)
    }

    for (const dir of resolvedMatcher.getWatchRoots(srcRoot)) {
      watchDirs.add(dir)
    }

    if (watchDirs.size === 0) {
      return
    }

    const isRouteVueFile = (filePath: string) => {
      const ext = path.extname(filePath)
      return allowedExtensions.has(ext) && isPagesRelatedPath(filePath)
    }

    const watcher = chokidar.watch([...watchDirs], createSidecarWatchOptions(configService, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 80,
        pollInterval: 20,
      },
    }))

    watcher.on('add', (filePath) => {
      if (!isRouteVueFile(filePath)) {
        return
      }
      logger.info(`[auto-routes:watch] 新增路由文件 ${configService.relativeCwd(filePath)}`)
      void service.handleFileChange(filePath, 'create')
    })

    watcher.on('unlink', (filePath) => {
      if (!isRouteVueFile(filePath)) {
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
      if (id === AUTO_ROUTES_ID || id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_ID
      }
      if (id === RESOLVED_VIRTUAL_ID) {
        return RESOLVED_VIRTUAL_ID
      }
      if (isAliasedAutoRoutesId(id, autoRoutesAliasTargets)) {
        return RESOLVED_VIRTUAL_ID
      }
      return null
    },

    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID && !isAliasedAutoRoutesId(id, autoRoutesAliasTargets)) {
        return null
      }

      await service.ensureFresh()
      if (isWatchMode()) {
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
      if (event === 'create' || event === 'delete') {
        await service.handleFileChange(id, 'rename')
      }
    },

    async handleHotUpdate(context) {
      if (resolvedConfig?.command === 'serve') {
        if (service.isRouteFile(context.file)) {
          await service.handleFileChange(context.file, 'update')
        }
        else {
          return
        }
      }
      else if (!service.isRouteFile(context.file) && !isPagesRelatedPath(context.file)) {
        return
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
