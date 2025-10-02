import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { Entry } from '../types'
import { parse as parseJson } from 'comment-json'
import fs from 'fs-extra'
import { bundleRequire } from 'rolldown-require'
import { FileCache } from '../cache'
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
  const cache = new FileCache<any>()

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
      if (/\.json\.[jt]s$/.test(filepath)) {
        const { mod } = await bundleRequire({
          filepath,
          cwd: ctx.configService.options.cwd,
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
