import type { ArtifactSource } from '../kernel'
import path from 'node:path'

export const HEADLESS_PLUGIN_VIRTUAL_ROOT = '__plugins__'

export interface HeadlessPluginDescriptor {
  alias: string
  config: Record<string, any>
  provider: string
  rootPath: string
  virtualRoot: string
}

const PLUGIN_URL_RE = /^plugin:\/\/([^/]+)\/(.+)$/

export function createPluginVirtualRoot(alias: string) {
  return `${HEADLESS_PLUGIN_VIRTUAL_ROOT}/${alias}`
}

export function resolvePluginRequest(
  plugins: HeadlessPluginDescriptor[],
  request: string,
  kind: 'page' | 'publicComponent',
) {
  const match = PLUGIN_URL_RE.exec(request)
  if (!match) {
    return undefined
  }
  const [, alias, publicName] = match
  const plugin = plugins.find(item => item.alias === alias)
  const registry = kind === 'page' ? plugin?.config.pages : plugin?.config.publicComponents
  const resourcePath = registry && typeof registry === 'object' && !Array.isArray(registry)
    ? registry[publicName]
    : undefined
  if (!plugin || typeof resourcePath !== 'string' || !resourcePath) {
    return undefined
  }
  return {
    plugin,
    publicName,
    resourcePath: `${plugin.virtualRoot}/${resourcePath}`,
  }
}

export function createPluginArtifactSource(
  fallback: ArtifactSource,
  miniprogramRootPath: string,
  plugins: HeadlessPluginDescriptor[],
): ArtifactSource {
  function resolvePhysicalPath(filePath: string) {
    const normalizedPath = path.resolve(filePath)
    for (const plugin of plugins) {
      const virtualRootPath = path.resolve(miniprogramRootPath, plugin.virtualRoot)
      const relativePath = path.relative(virtualRootPath, normalizedPath)
      if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
        return path.resolve(plugin.rootPath, relativePath)
      }
    }
    return normalizedPath
  }

  return {
    has: filePath => fallback.has(resolvePhysicalPath(filePath)),
    readText: filePath => fallback.readText(resolvePhysicalPath(filePath)),
  }
}
