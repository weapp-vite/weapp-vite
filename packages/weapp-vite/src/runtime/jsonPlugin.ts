import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { Entry } from '../types'
import type { FileCache } from '@/cache'
import { createRequire } from 'node:module'
import process from 'node:process'
import { parse as parseJson } from 'comment-json'
import fs from 'fs-extra'
import { bundleRequire } from 'rolldown-require'
import { debug, logger } from '../context/shared'
import { resolveJson } from '../utils'

export interface JsonService {
  read: (filepath: string) => Promise<any>
  resolve: (entry: Partial<Pick<Entry, 'json' | 'jsonPath' | 'type'>>) => string | undefined
  cache: FileCache<any>
}

export function parseCommentJson(json: string) {
  return parseJson(json, undefined, true)
}

function createJsonService(ctx: MutableCompilerContext): JsonService {
  const cache = ctx.runtimeState.json.cache
  const nodeRequire = createRequire(import.meta.url)

  async function read(filepath: string) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before reading json')
    }

    try {
      const invalid = await cache.isInvalidate(filepath)
      if (!invalid) {
        return cache.get(filepath)
      }
      let resultJson: any
      if (/app\.json(?:\.[jt]s)?$/.test(filepath)) {
        await ctx.autoRoutesService?.ensureFresh()
      }
      if (/\.json\.[jt]s$/.test(filepath)) {
        const routesReference = ctx.autoRoutesService?.getReference()
        const fallbackRoutes = routesReference ?? { pages: [], entries: [], subPackages: [] }
        const routesModule = {
          routes: fallbackRoutes,
          default: fallbackRoutes,
          pages: fallbackRoutes.pages,
          entries: fallbackRoutes.entries,
          subPackages: fallbackRoutes.subPackages,
        }
        const customRequire = async (id: string, meta: { format: 'esm' | 'cjs' }) => {
          if (process.env.__WEAPP_VITE_DEBUG_AUTO_ROUTES__) {
            logger.debug('[auto-routes] bundleRequire import', id, meta.format)
          }
          if (id === 'weapp-vite/auto-routes' || id === 'weapp-vite/auto-routes.mjs' || id === 'weapp-vite/auto-routes.cjs') {
            return routesModule
          }
          if (id.startsWith('file://')) {
            if (id.endsWith('/auto-routes.mjs') || id.endsWith('/auto-routes.cjs')) {
              return routesModule
            }
            return await import(id)
          }
          if (meta.format === 'esm') {
            return await import(id)
          }
          return nodeRequire(id)
        }

        const { mod } = await bundleRequire({
          filepath,
          cwd: ctx.configService.options.cwd,
          preserveTemporaryFile: true,
          require: customRequire,
          rolldownOptions: {
            input: {
              define: ctx.configService.defineImportMetaEnv,
            },
            output: {
              exports: 'named',
            },
          },
        })
        resultJson = typeof mod.default === 'function'
          ? await mod.default(ctx)
          : mod.default
      }
      else {
        resultJson = parseCommentJson(await fs.readFile(filepath, 'utf8'))
      }
      cache.set(filepath, resultJson)
      return resultJson
    }
    catch (error) {
      logger.error(`残破的JSON文件: ${filepath}`)
      debug?.(error)
    }
  }

  function resolve(entry: Partial<Pick<Entry, 'json' | 'jsonPath' | 'type'>>) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before resolving json')
    }
    return resolveJson(entry, ctx.configService.aliasEntries)
  }

  return {
    cache,
    read,
    resolve,
  }
}

export function createJsonServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createJsonService(ctx)
  ctx.jsonService = service

  return {
    name: 'weapp-runtime:json-service',
  }
}
