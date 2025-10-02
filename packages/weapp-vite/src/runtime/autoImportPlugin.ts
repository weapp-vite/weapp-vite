import type { Plugin } from 'vite'
import type { ResolvedValue } from '../auto-import-components/resolvers'
import type { MutableCompilerContext } from '../context'
import type { Entry, SubPackageMetaValue } from '../types'
import { removeExtension, removeExtensionDeep } from '@weapp-core/shared'
import { LRUCache } from 'lru-cache'
import pm from 'picomatch'
import { logger, resolvedComponentName } from '../context/shared'
import { findJsEntry, findJsonEntry } from '../utils'

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

export interface AutoImportService {
  potentialComponentMap: Map<string, { entry: Entry, value: ResolvedValue }>
  scanPotentialComponentEntries: (filePath: string) => Promise<void>
  filter: (id: string, meta?: SubPackageMetaValue) => boolean
}

function createAutoImportService(ctx: MutableCompilerContext): AutoImportService {
  const potentialComponentMap = new Map<string, { entry: Entry, value: ResolvedValue }>()

  async function scanPotentialComponentEntries(filePath: string) {
    if (!ctx.configService || !ctx.jsonService) {
      throw new Error('configService/jsonService must be initialized before scanning components')
    }
    const baseName = removeExtension(filePath)
    const { path: jsEntry } = await findJsEntry(baseName)
    if (!jsEntry) {
      return
    }
    const { path: jsonPath } = await findJsonEntry(baseName)
    if (jsonPath) {
      const json = await ctx.jsonService.read(jsonPath)
      if (json?.component) {
        const partialEntry: Entry = {
          path: jsEntry,
          json,
          jsonPath,
          type: 'component',
          templatePath: filePath,
        }
        const { componentName, base } = resolvedComponentName(baseName)
        if (componentName) {
          const hasComponent = potentialComponentMap.has(componentName)
          if (hasComponent && base !== 'index') {
            logWarnOnce(`发现 \`${componentName}\` 组件重名! 跳过组件 \`${ctx.configService.relativeCwd(baseName)}\` 的自动引入`)
            return
          }

          const from = `/${ctx.configService.relativeSrcRoot(
            ctx.configService.relativeCwd(
              removeExtensionDeep(partialEntry.jsonPath!),
            ),
          )}`
          potentialComponentMap.set(componentName, {
            entry: partialEntry,
            value: {
              name: componentName,
              from,
            },
          })
        }
      }
    }
  }

  function filter(id: string) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before filtering components')
    }
    if (ctx.configService.weappViteConfig?.enhance?.autoImportComponents?.globs) {
      const isMatch = pm(ctx.configService.weappViteConfig.enhance.autoImportComponents.globs, {
        cwd: ctx.configService.cwd,
        windows: true,
        posixSlashes: true,
      })
      return isMatch(id)
    }
    return false
  }

  return {
    potentialComponentMap,
    scanPotentialComponentEntries,
    filter,
  }
}

export function createAutoImportServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createAutoImportService(ctx)
  ctx.autoImportService = service

  return {
    name: 'weapp-runtime:auto-import-service',
  }
}
