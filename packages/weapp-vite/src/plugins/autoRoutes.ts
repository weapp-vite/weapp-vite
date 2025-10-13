import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'

const AUTO_ROUTES_ID = 'weapp-vite/auto-routes'
const VIRTUAL_MODULE_ID = 'virtual:weapp-vite-auto-routes'
const RESOLVED_VIRTUAL_ID = '\0weapp-vite:auto-routes'

function createAutoRoutesPlugin(ctx: CompilerContext): Plugin {
  const service = ctx.autoRoutesService
  let resolvedConfig: ResolvedConfig | undefined

  return {
    name: 'weapp-vite:auto-routes',
    enforce: 'pre',

    configResolved(config) {
      resolvedConfig = config
    },

    async buildStart() {
      await service.ensureFresh()
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

      for (const file of service.getWatchFiles()) {
        try {
          this.addWatchFile(file)
        }
        catch { }
      }

      for (const dir of service.getWatchDirectories()) {
        try {
          this.addWatchFile(dir)
        }
        catch { }
      }

      return {
        code: service.getModuleCode(),
        map: { mappings: '' },
      }
    },

    async watchChange(id) {
      if (!service.isRouteFile(id)) {
        return
      }
      await service.handleFileChange(id)
    },

    async handleHotUpdate(context) {
      if (!service.isRouteFile(context.file)) {
        return
      }

      if (resolvedConfig?.command === 'serve') {
        await service.ensureFresh()
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
