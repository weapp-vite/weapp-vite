import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import path from 'pathe'
import { normalizeWatchPath, toPosixPath } from '../utils/path'

const AUTO_ROUTES_ID = 'weapp-vite/auto-routes'
const VIRTUAL_MODULE_ID = 'virtual:weapp-vite-auto-routes'
const RESOLVED_VIRTUAL_ID = '\0weapp-vite:auto-routes'

function createAutoRoutesPlugin(ctx: CompilerContext): Plugin {
  const service = ctx.autoRoutesService
  let resolvedConfig: ResolvedConfig | undefined

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

    const normalized = path.isAbsolute(pathWithoutQuery)
      ? pathWithoutQuery
      : path.resolve(configService.cwd, pathWithoutQuery)

    if (!normalized.startsWith(configService.absoluteSrcRoot)) {
      return false
    }

    const relative = toPosixPath(path.relative(configService.absoluteSrcRoot, normalized))
    if (!relative || relative.startsWith('..')) {
      return false
    }

    return relative === 'pages'
      || relative.startsWith('pages/')
      || relative.includes('/pages/')
  }

  return {
    name: 'weapp-vite:auto-routes',
    enforce: 'pre',

    configResolved(config) {
      resolvedConfig = config
    },

    async buildStart() {
      await service.ensureFresh()
      addWatchTargets(this as any)
    },

    resolveId(id) {
      if (id === AUTO_ROUTES_ID || id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_ID
      }
      if (id === RESOLVED_VIRTUAL_ID) {
        return RESOLVED_VIRTUAL_ID
      }
      return null
    },

    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) {
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
      if (event === 'create' || event === 'delete' || event === 'rename' || event === 'update') {
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
  }
}

export function autoRoutes(ctx: CompilerContext): Plugin[] {
  return [createAutoRoutesPlugin(ctx)]
}
