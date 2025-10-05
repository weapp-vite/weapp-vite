import type { Plugin } from 'vite'
import type { ResolvedValue } from '../auto-import-components/resolvers'
import type { MutableCompilerContext } from '../context'
import type { SubPackageMetaValue } from '../types'
import type { LocalAutoImportMatch } from './autoImport/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import { LRUCache } from 'lru-cache'
import pm from 'picomatch'
import { logger, resolvedComponentName } from '../context/shared'
import { findJsEntry, findJsonEntry, findTemplateEntry } from '../utils'

export type { LocalAutoImportMatch } from './autoImport/types'

const logWarnCache = new LRUCache<string, boolean>({
  max: 512,
  ttl: 1000 * 60 * 60,
})

function logWarnOnce(message: string) {
  if (logWarnCache.get(message)) {
    return
  }
  logger.warn(message)
  logWarnCache.set(message, true)
}

export interface ResolverAutoImportMatch {
  kind: 'resolver'
  value: ResolvedValue
}

export type AutoImportMatch = LocalAutoImportMatch | ResolverAutoImportMatch

export interface AutoImportService {
  reset: () => void
  registerPotentialComponent: (filePath: string) => Promise<void>
  removePotentialComponent: (filePath: string) => void
  resolve: (componentName: string, importerBaseName?: string) => AutoImportMatch | undefined
  filter: (id: string, meta?: SubPackageMetaValue) => boolean
  getRegisteredLocalComponents: () => LocalAutoImportMatch[]
}

function createAutoImportService(ctx: MutableCompilerContext): AutoImportService {
  const autoImportState = ctx.runtimeState.autoImport
  const registry = autoImportState.registry

  async function registerLocalComponent(filePath: string) {
    if (!ctx.configService || !ctx.jsonService) {
      throw new Error('configService/jsonService must be initialized before scanning components')
    }

    const baseName = removeExtensionDeep(filePath)
    const [{ path: jsEntry }, { path: jsonPath }, { path: templatePath }] = await Promise.all([
      findJsEntry(baseName),
      findJsonEntry(baseName),
      findTemplateEntry(baseName),
    ])

    removeRegisteredComponent({
      baseName,
      templatePath,
      jsEntry,
      jsonPath,
    })

    if (!jsEntry || !jsonPath || !templatePath) {
      return
    }

    const json = await ctx.jsonService.read(jsonPath)
    if (!json?.component) {
      return
    }

    const { componentName, base } = resolvedComponentName(baseName)
    if (!componentName) {
      return
    }

    const hasComponent = registry.has(componentName)
    if (hasComponent && base !== 'index') {
      logWarnOnce(`发现 \`${componentName}\` 组件重名! 跳过组件 \`${ctx.configService.relativeCwd(baseName)}\` 的自动引入`)
      return
    }

    const sourceWithoutExt = removeExtensionDeep(jsonPath)
    const from = `/${ctx.configService.relativeSrcRoot(
      ctx.configService.relativeCwd(sourceWithoutExt),
    )}`

    registry.set(componentName, {
      kind: 'local',
      entry: {
        path: jsEntry,
        json,
        jsonPath,
        type: 'component',
        templatePath,
      },
      value: {
        name: componentName,
        from,
      },
    })
  }

  function removeRegisteredComponent(paths: {
    baseName?: string
    templatePath?: string
    jsEntry?: string
    jsonPath?: string
  }) {
    const { baseName, templatePath, jsEntry, jsonPath } = paths
    for (const [key, value] of registry) {
      if (value.kind !== 'local') {
        continue
      }
      const entry = value.entry
      const matches = Boolean(
        (templatePath && entry.templatePath === templatePath)
        || (jsonPath && entry.jsonPath === jsonPath)
        || (jsEntry && entry.path === jsEntry)
        || (baseName && removeExtensionDeep(entry.templatePath) === baseName)
        || (baseName && removeExtensionDeep(entry.path) === baseName)
        || (baseName && removeExtensionDeep(entry.jsonPath ?? '') === baseName),
      )

      if (matches) {
        registry.delete(key)
      }
    }
  }

  function ensureMatcher() {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before filtering components')
    }
    const globs = ctx.configService.weappViteConfig?.enhance?.autoImportComponents?.globs
    if (!globs || globs.length === 0) {
      autoImportState.matcher = undefined
      autoImportState.matcherKey = ''
      return undefined
    }

    const nextKey = globs.join('\0')
    if (!autoImportState.matcher || autoImportState.matcherKey !== nextKey) {
      autoImportState.matcher = pm(globs, {
        cwd: ctx.configService.cwd,
        windows: true,
        posixSlashes: true,
      })
      autoImportState.matcherKey = nextKey
    }

    return autoImportState.matcher
  }

  function resolveWithResolvers(componentName: string, importerBaseName?: string): ResolverAutoImportMatch | undefined {
    const resolvers = ctx.configService?.weappViteConfig?.enhance?.autoImportComponents?.resolvers
    if (!Array.isArray(resolvers)) {
      return undefined
    }

    for (const resolver of resolvers) {
      const value = resolver(componentName, importerBaseName ?? '')
      if (value) {
        return {
          kind: 'resolver',
          value,
        }
      }
    }

    return undefined
  }

  return {
    reset() {
      registry.clear()
      autoImportState.matcher = undefined
      autoImportState.matcherKey = ''
    },

    async registerPotentialComponent(filePath: string) {
      await registerLocalComponent(filePath)
    },

    removePotentialComponent(filePath: string) {
      removeRegisteredComponent({
        baseName: removeExtensionDeep(filePath),
        templatePath: filePath,
      })
    },

    resolve(componentName: string, importerBaseName?: string) {
      const local = registry.get(componentName)
      if (local) {
        return local
      }

      return resolveWithResolvers(componentName, importerBaseName)
    },

    filter(id: string, _meta?: SubPackageMetaValue) {
      const globMatcher = ensureMatcher()
      if (!globMatcher) {
        return false
      }
      return globMatcher(id)
    },

    getRegisteredLocalComponents() {
      return Array.from(registry.values())
    },
  }
}

export function createAutoImportServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createAutoImportService(ctx)
  ctx.autoImportService = service

  return {
    name: 'weapp-runtime:auto-import-service',
  }
}
