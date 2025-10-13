import type { Plugin } from 'vite'
import type { ResolvedValue, Resolver } from '../auto-import-components/resolvers'
import type { MutableCompilerContext } from '../context'
import type { SubPackageMetaValue } from '../types'
import type { LocalAutoImportMatch } from './autoImport/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'
import path from 'pathe'
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

function getAutoImportConfig(configService?: MutableCompilerContext['configService']) {
  const weappConfig = configService?.weappViteConfig
  return weappConfig?.autoImportComponents ?? weappConfig?.enhance?.autoImportComponents
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
  awaitManifestWrites: () => Promise<void>
}

function createAutoImportService(ctx: MutableCompilerContext): AutoImportService {
  const autoImportState = ctx.runtimeState.autoImport
  const registry = autoImportState.registry
  const manifestFileName = 'auto-import-components.json'
  let pendingWrite: Promise<void> | undefined
  let writeRequested = false

  function resolveManifestOutputPath(): string | undefined {
    const configService = ctx.configService
    if (!configService) {
      return undefined
    }

    const autoImportConfig = getAutoImportConfig(configService)
    if (!autoImportConfig) {
      return undefined
    }

    const baseDir = (() => {
      const configFilePath = configService.configFilePath
      if (configFilePath) {
        return path.dirname(configFilePath)
      }
      return configService.cwd
    })()

    const outputOption = autoImportConfig.output
    if (outputOption === false) {
      return undefined
    }

    if (typeof outputOption === 'string' && outputOption.length > 0) {
      return path.isAbsolute(outputOption) ? outputOption : path.resolve(baseDir, outputOption)
    }

    return path.resolve(baseDir, manifestFileName)
  }

  function collectResolverComponents(): Record<string, string> {
    const resolvers = getAutoImportConfig(ctx.configService)?.resolvers
    if (!Array.isArray(resolvers)) {
      return {}
    }

    const entries: [string, string][] = []
    for (const resolver of resolvers as Resolver[]) {
      const map = resolver?.components
      if (!map) {
        continue
      }
      for (const [name, from] of Object.entries(map)) {
        entries.push([name, from])
      }
    }

    return Object.fromEntries(entries)
  }

  async function writeManifestFile(outputPath: string) {
    const resolverEntries = Object.entries(collectResolverComponents())
    const localEntries = Array.from(registry.entries())
      .filter((entry): entry is [string, LocalAutoImportMatch] => entry[1].kind === 'local')

    const manifestMap = new Map<string, string>()
    for (const [componentName, from] of resolverEntries) {
      manifestMap.set(componentName, from)
    }
    for (const [componentName, match] of localEntries) {
      manifestMap.set(componentName, match.value.from)
    }

    const manifest = Object.fromEntries(
      Array.from(manifestMap.entries()).sort(([a], [b]) => a.localeCompare(b)),
    )

    await fs.outputJson(outputPath, manifest, { spaces: 2 })
  }

  function scheduleManifestWrite(shouldWrite: boolean) {
    if (!shouldWrite) {
      return
    }

    const configService = ctx.configService
    if (!getAutoImportConfig(configService)) {
      return
    }

    writeRequested = true
    if (pendingWrite) {
      return
    }

    pendingWrite = Promise.resolve()
      .then(async () => {
        while (writeRequested) {
          writeRequested = false
          const outputPath = resolveManifestOutputPath()
          if (!outputPath) {
            return
          }
          try {
            await writeManifestFile(outputPath)
          }
          catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            logger.error(`自动导出组件清单失败: ${message}`)
          }
        }
      })
      .finally(() => {
        pendingWrite = undefined
      })
  }

  function removeRegisteredComponent(paths: {
    baseName?: string
    templatePath?: string
    jsEntry?: string
    jsonPath?: string
  }) {
    const { baseName, templatePath, jsEntry, jsonPath } = paths
    let removed = false
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
        removed = registry.delete(key) || removed
      }
    }

    return removed
  }

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

    const removed = removeRegisteredComponent({
      baseName,
      templatePath,
      jsEntry,
      jsonPath,
    })

    if (!jsEntry || !jsonPath || !templatePath) {
      scheduleManifestWrite(removed)
      return
    }

    const json = await ctx.jsonService.read(jsonPath)
    if (!json?.component) {
      scheduleManifestWrite(removed)
      return
    }

    const { componentName, base } = resolvedComponentName(baseName)
    if (!componentName) {
      scheduleManifestWrite(removed)
      return
    }

    const hasComponent = registry.has(componentName)
    if (hasComponent && base !== 'index') {
      logWarnOnce(`发现 \`${componentName}\` 组件重名! 跳过组件 \`${ctx.configService.relativeCwd(baseName)}\` 的自动引入`)
      scheduleManifestWrite(removed)
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

    scheduleManifestWrite(true)
  }

  function ensureMatcher() {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before filtering components')
    }
    const globs = getAutoImportConfig(ctx.configService)?.globs
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
    const resolvers = getAutoImportConfig(ctx.configService)?.resolvers
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
      scheduleManifestWrite(true)
    },

    async registerPotentialComponent(filePath: string) {
      await registerLocalComponent(filePath)
    },

    removePotentialComponent(filePath: string) {
      const removed = removeRegisteredComponent({
        baseName: removeExtensionDeep(filePath),
        templatePath: filePath,
      })
      scheduleManifestWrite(removed)
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
    awaitManifestWrites() {
      return pendingWrite ?? Promise.resolve()
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
