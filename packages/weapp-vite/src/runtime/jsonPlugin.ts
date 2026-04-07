import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { JsonResolvableEntry } from '../utils'
import type { FileCache } from '@/cache'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { bundleRequire } from 'rolldown-require'
import { debug, logger } from '../context/shared'
import { inlineAutoRoutesImports, parseCommentJson, resolveJson } from '../utils'
import { requireConfigService } from './utils/requireConfigService'

const APP_CONFIG_RE = /app\.json(?:\.[jt]s)?$/
const SCRIPT_JSON_CONFIG_RE = /\.json\.[jt]s$/

export interface JsonService {
  read: (filepath: string) => Promise<any>
  resolve: (entry: JsonResolvableEntry) => string | undefined
  cache: FileCache<any>
}

function createJsonService(ctx: MutableCompilerContext): JsonService {
  const cache = ctx.runtimeState.json.cache

  async function read(filepath: string) {
    const configService = requireConfigService(ctx, '读取 JSON 前必须初始化 configService。')

    try {
      const isAppConfig = APP_CONFIG_RE.test(filepath)
      let autoRoutesSignature: string | undefined
      if (isAppConfig && !ctx.runtimeState.autoRoutes.loadingAppConfig) {
        await ctx.autoRoutesService?.ensureFresh()
        autoRoutesSignature = ctx.autoRoutesService?.getSignature?.()
      }

      const invalid = await cache.isInvalidate(
        filepath,
        typeof autoRoutesSignature === 'string' ? { signature: autoRoutesSignature } : undefined,
      )
      if (!invalid) {
        return cache.get(filepath)
      }
      let resultJson: any
      if (SCRIPT_JSON_CONFIG_RE.test(filepath)) {
        const routesReference = ctx.autoRoutesService?.getReference()
        const fallbackRoutes = routesReference ?? { pages: [], entries: [], subPackages: [] }
        const scriptContent = await fs.readFile(filepath, 'utf8')
        const inlinedContent = isAppConfig
          ? inlineAutoRoutesImports(scriptContent, fallbackRoutes)
          : scriptContent
        const tempFilepath = inlinedContent === scriptContent
          ? filepath
          : path.join(path.dirname(filepath), `.${path.basename(filepath, path.extname(filepath))}.auto-routes-inline${path.extname(filepath)}`)
        try {
          if (tempFilepath !== filepath) {
            await fs.writeFile(tempFilepath, inlinedContent, 'utf8')
          }
          const { mod } = await bundleRequire({
            filepath: tempFilepath,
            cwd: configService.options.cwd,
            preserveTemporaryFile: true,
            rolldownOptions: {
              input: {
                // @ts-ignore
                define: configService.defineImportMetaEnv,
              },
              output: {
                exports: 'named',
              },
            },
          })
          const exportedConfig = Object.hasOwn(mod, 'default')
            ? mod.default
            : mod
          resultJson = typeof exportedConfig === 'function'
            ? await exportedConfig(ctx)
            : exportedConfig
        }
        finally {
          if (tempFilepath !== filepath) {
            await fs.remove(tempFilepath)
          }
        }
      }
      else {
        resultJson = parseCommentJson(await fs.readFile(filepath, 'utf8'))
      }
      cache.set(filepath, resultJson)
      return resultJson
    }
    catch (error) {
      logger.error(`残破的 JSON 文件：${filepath}`)
      debug?.(error)
    }
  }

  function resolve(entry: JsonResolvableEntry) {
    const configService = requireConfigService(ctx, '解析 JSON 前必须初始化 configService。')
    return resolveJson(entry, configService.aliasEntries, configService.platform, {
      dependencies: configService.packageJson.dependencies,
      alipayNpmMode: configService.weappViteConfig?.npm?.alipayNpmMode,
    })
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
