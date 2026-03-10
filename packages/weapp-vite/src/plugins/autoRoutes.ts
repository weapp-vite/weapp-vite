import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import process from 'node:process'
import chokidar from 'chokidar'
import path from 'pathe'
import { vueExtensions } from '../constants'
import { logger } from '../context/shared'
import { normalizePath, normalizeWatchPath, toPosixPath } from '../utils/path'
import { normalizeFsResolvedId } from '../utils/resolvedId'

const AUTO_ROUTES_ID = 'weapp-vite/auto-routes'
const VIRTUAL_MODULE_ID = 'virtual:weapp-vite-auto-routes'
const RESOLVED_VIRTUAL_ID = '\0weapp-vite:auto-routes'

function createAutoRoutesPlugin(ctx: CompilerContext): Plugin {
  const service = ctx.autoRoutesService
  let resolvedConfig: ResolvedConfig | undefined
  const autoRoutesAliasTargets = new Set<string>()
  let routeWatcher: ReturnType<typeof chokidar.watch> | undefined

  const normalizeTargetId = (id: string) => {
    return path.normalize(normalizeFsResolvedId(id))
  }

  const refreshAutoRoutesAliasTargets = () => {
    autoRoutesAliasTargets.clear()
    const packageRoot = ctx.configService?.packageInfo?.rootPath
    if (!packageRoot) {
      return
    }
    const candidates = [
      path.resolve(packageRoot, 'src/auto-routes.ts'),
      path.resolve(packageRoot, 'auto-routes.ts'),
      path.resolve(packageRoot, 'dist/auto-routes.mjs'),
      path.resolve(packageRoot, 'dist/auto-routes.js'),
    ]
    for (const candidate of candidates) {
      autoRoutesAliasTargets.add(path.normalize(candidate))
    }
  }

  const isAliasedAutoRoutesId = (id: string) => {
    return autoRoutesAliasTargets.has(normalizeTargetId(id))
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

    const [pathWithoutQuery] = id.split('?')
    if (!pathWithoutQuery) {
      return false
    }

    const normalizedSrcRoot = normalizePath(configService.absoluteSrcRoot)
    const normalizedCandidate = normalizePath(
      path.isAbsolute(pathWithoutQuery)
        ? pathWithoutQuery
        : path.resolve(configService.cwd, pathWithoutQuery),
    )
    const relative = toPosixPath(path.relative(normalizedSrcRoot, normalizedCandidate))
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return false
    }

    return relative === 'pages'
      || relative.startsWith('pages/')
      || relative.includes('/pages/')
  }

  /**
   * 启动 chokidar 监听 pages 目录下的路由文件增删。
   * Rolldown 的 watcher 不会为新建文件触发 watchChange，
   * 因此需要独立的文件监听来补偿。
   */
  function startRouteFileWatcher() {
    if (routeWatcher) {
      return
    }

    const configService = ctx.configService
    if (!configService?.isDev) {
      return
    }

    // 测试环境或显式禁用时跳过
    if (
      process.env.VITEST === 'true'
      || process.env.NODE_ENV === 'test'
    ) {
      return
    }

    if (!service.isEnabled()) {
      return
    }

    const srcRoot = configService.absoluteSrcRoot
    const vueGlobs = vueExtensions.map(ext => `**/*.${ext}`)
    const watchDirs: string[] = []

    // 收集所有 pages 目录
    for (const dir of service.getWatchDirectories()) {
      watchDirs.push(dir)
    }

    // 至少监听 srcRoot/pages
    const defaultPagesDir = path.join(srcRoot, 'pages')
    if (!watchDirs.some(d => normalizePath(d) === normalizePath(defaultPagesDir))) {
      watchDirs.push(defaultPagesDir)
    }

    const patterns = watchDirs.flatMap(dir =>
      vueGlobs.map(glob => path.join(dir, glob)),
    )

    if (!patterns.length) {
      return
    }

    routeWatcher = chokidar.watch(patterns, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 80,
        pollInterval: 20,
      },
    })

    routeWatcher.on('add', (filePath) => {
      if (!isPagesRelatedPath(filePath)) {
        return
      }
      logger.info(`[auto-routes:watch] 新增路由文件 ${configService.relativeCwd(filePath)}`)
      void service.handleFileChange(filePath, 'create')
    })

    routeWatcher.on('unlink', (filePath) => {
      if (!isPagesRelatedPath(filePath)) {
        return
      }
      logger.info(`[auto-routes:watch] 删除路由文件 ${configService.relativeCwd(filePath)}`)
      void service.handleFileChange(filePath, 'delete')
    })
  }

  function stopRouteFileWatcher() {
    if (routeWatcher) {
      void routeWatcher.close()
      routeWatcher = undefined
    }
  }

  return {
    name: 'weapp-vite:auto-routes',
    enforce: 'pre',

    configResolved(config) {
      resolvedConfig = config
      refreshAutoRoutesAliasTargets()
    },

    async buildStart() {
      await service.ensureFresh()
      refreshAutoRoutesAliasTargets()
      addWatchTargets(this as any)
      startRouteFileWatcher()
    },

    resolveId(id) {
      if (id === AUTO_ROUTES_ID || id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_ID
      }
      if (id === RESOLVED_VIRTUAL_ID) {
        return RESOLVED_VIRTUAL_ID
      }
      if (isAliasedAutoRoutesId(id)) {
        return RESOLVED_VIRTUAL_ID
      }
      return null
    },

    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID && !isAliasedAutoRoutesId(id)) {
        return null
      }

      await service.ensureFresh()
      addWatchTargets(this as any)

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

      // 目录级新增/删除、或未命中的 pages 路径变化，统一触发一次全量重扫，保证路由增删改一致性。
      if (event === 'create' || event === 'delete' || event === 'update') {
        await service.handleFileChange(id, 'rename')
      }
    },

    async handleHotUpdate(context) {
      if (resolvedConfig?.command === 'serve') {
        if (service.isRouteFile(context.file)) {
          await service.handleFileChange(context.file, 'update')
        }
        else if (isPagesRelatedPath(context.file)) {
          await service.handleFileChange(context.file, 'rename')
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

    closeBundle() {
      stopRouteFileWatcher()
    },
  }
}

export function autoRoutes(ctx: CompilerContext): Plugin[] {
  return [createAutoRoutesPlugin(ctx)]
}
