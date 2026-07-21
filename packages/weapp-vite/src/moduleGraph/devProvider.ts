import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import type { CompilerContext } from '../context'
import { createLogger, createServer, transformWithOxc } from 'vite'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { resolveNpmBuildCandidateDependenciesSync } from '../runtime/npmPlugin/service/dependencies'
import { createLogicalEntryModuleCode, createSidecarModuleCode } from './logicalEntry'
import {
  parseLogicalEntryId,
  parseSidecarModuleId,
  parseSidecarSourceRequest,
  resolveVirtualModuleId,
} from './protocol'

const DEV_EXTERNAL_PREFIX = '\0weapp-vite:module-graph-external:'

export interface DevModuleGraphProvider {
  close: () => Promise<void>
}

function isInternalPlugin(plugin: unknown): plugin is { name: string } {
  if (!plugin || typeof plugin !== 'object' || !('name' in plugin)) {
    return false
  }
  const name = (plugin as { name?: unknown }).name
  return typeof name === 'string'
    && (name.startsWith('weapp-vite:') || name.startsWith('weapp-runtime:'))
}

function collectResolverPlugins(config: InlineConfig) {
  const plugins = Array.isArray(config.plugins) ? config.plugins : config.plugins ? [config.plugins] : []
  return plugins.filter(plugin => !isInternalPlugin(plugin))
}

async function transformVueSource(code: string, id: string) {
  const { descriptor, errors } = parseSfc(code, { filename: id })
  if (errors.length) {
    throw errors[0]
  }
  const blocks = [descriptor.script, descriptor.scriptSetup].filter(block => block?.content)
  const source = blocks.map(block => block!.content).join('\n') || 'export default {}'
  const lang = blocks.some(block => block?.lang === 'tsx')
    ? 'tsx'
    : blocks.some(block => block?.lang === 'ts') ? 'ts' : 'js'
  return await transformWithOxc(source, id, {
    lang,
    sourcemap: false,
    target: 'esnext',
  })
}

async function isExternalRequest(
  source: string,
  importer: string | undefined,
  config: InlineConfig,
) {
  const buildOptions = config.build as (NonNullable<InlineConfig['build']> & {
    rolldownOptions?: { external?: unknown }
  }) | undefined
  const external = buildOptions?.rolldownOptions?.external
    ?? buildOptions?.rollupOptions?.external
  if (typeof external === 'function') {
    return await external(source, importer, false)
  }
  const patterns = Array.isArray(external) ? external : external ? [external] : []
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return pattern === source
    }
    pattern.lastIndex = 0
    return pattern.test(source)
  })
}

function createProviderPlugin(ctx: CompilerContext, config: InlineConfig): Plugin {
  const npmExternalPackages = new Set(
    ctx.configService?.packageJson
      ? resolveNpmBuildCandidateDependenciesSync(ctx, ctx.configService.packageJson)
      : [],
  )
  return {
    name: 'weapp-vite:module-graph-provider',
    enforce: 'pre',
    async resolveId(id, importer) {
      const virtualId = resolveVirtualModuleId(id)
      if (virtualId) {
        return virtualId
      }
      if (parseSidecarSourceRequest(id)) {
        return id
      }
      if (Array.from(npmExternalPackages).some(pkg => id === pkg || id.startsWith(`${pkg}/`))) {
        return `${DEV_EXTERNAL_PREFIX}${encodeURIComponent(id)}`
      }
      if (await isExternalRequest(id, importer, config)) {
        return `${DEV_EXTERNAL_PREFIX}${encodeURIComponent(id)}`
      }
      const isBareRequest = !id.startsWith('.')
        && !id.startsWith('/')
        && !id.startsWith('\0')
        && !/^[a-z]:[\\/]/i.test(id)
      if (isBareRequest) {
        const resolved = await this.resolve(id, importer, { skipSelf: true })
        if (!resolved || resolved.external) {
          return `${DEV_EXTERNAL_PREFIX}${encodeURIComponent(id)}`
        }
        return resolved
      }
      return null
    },
    load(id) {
      if (id.startsWith(DEV_EXTERNAL_PREFIX)) {
        return 'export default {}'
      }
      const logicalEntry = parseLogicalEntryId(id)
      if (logicalEntry) {
        return createLogicalEntryModuleCode(
          logicalEntry,
          ctx.moduleGraphService.getEntryDependencies(logicalEntry.sourceId),
        )
      }
      const sidecar = parseSidecarModuleId(id)
      if (sidecar) {
        return createSidecarModuleCode(sidecar.ownerId, sidecar.sourceId, sidecar.kind)
      }
      const sidecarSource = parseSidecarSourceRequest(id)
      if (sidecarSource) {
        if (sidecarSource.kind === 'style') {
          return null
        }
        return `export default ${JSON.stringify(sidecarSource.sourceId)};`
      }
      return null
    },
    async transform(code, id) {
      if (!id.endsWith('.vue')) {
        return null
      }
      return await transformVueSource(code, id)
    },
  }
}

export async function createDevModuleGraphProvider(
  ctx: CompilerContext,
  buildConfig: InlineConfig,
  onChange: (file: string) => void,
): Promise<DevModuleGraphProvider> {
  const server: ViteDevServer = await createServer({
    ...buildConfig,
    appType: 'custom',
    configFile: false,
    customLogger: createLogger('silent'),
    plugins: [
      createProviderPlugin(ctx, buildConfig),
      ...collectResolverPlugins(buildConfig),
    ],
    server: {
      ...(buildConfig.server ?? {}),
      hmr: false,
      middlewareMode: true,
    },
    build: {
      ...(buildConfig.build ?? {}),
      watch: undefined,
      write: false,
    },
  })
  ctx.moduleGraphService.bindDevServer(server)
  server.watcher.on('change', onChange)

  return {
    async close() {
      server.watcher.off('change', onChange)
      await server.close()
      ctx.moduleGraphService.bindDevServer(undefined)
    },
  }
}
