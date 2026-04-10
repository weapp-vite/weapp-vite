import process from 'node:process'
import { fs } from '@weapp-core/shared'
import { recursive as mergeRecursive } from 'merge'
import path from 'pathe'
import { parse } from 'vue/compiler-sfc'
import { inlineAutoRoutesImports, resolveAutoRoutesInlineSnapshot } from './autoRoutes'

const vueConfigCache = new Map<string, {
  config?: Record<string, any>
  fileMtimeMs?: number
  dependencies: string[]
  dependencyMtimeMs: Map<string, number>
}>()
const configMtimeInFlight = new Map<string, Promise<number | undefined>>()
const NODE_MODULES_RE = /[\\/]node_modules[\\/]/
const JSON_MACRO_HINT_RE = /\bdefine(?:App|Page|Component|Sitemap|Theme)Json\s*\(/

function getMtimeCached(filePath: string) {
  const pending = configMtimeInFlight.get(filePath)
  if (pending) {
    return pending
  }
  const next = fs.stat(filePath)
    .then(stat => stat.mtimeMs)
    .catch(() => undefined)
    .finally(() => {
      configMtimeInFlight.delete(filePath)
    })
  configMtimeInFlight.set(filePath, next)
  return next
}

async function isVueConfigCacheValid(vueFilePath: string, cache: {
  fileMtimeMs?: number
  dependencies: string[]
  dependencyMtimeMs: Map<string, number>
}) {
  const nextMtime = await getMtimeCached(vueFilePath)
  if (nextMtime === undefined || cache.fileMtimeMs === undefined) {
    return false
  }
  if (nextMtime !== cache.fileMtimeMs) {
    return false
  }
  if (cache.dependencies.length === 0) {
    return true
  }
  for (const dep of cache.dependencies) {
    const nextDepMtime = await getMtimeCached(dep)
    const cachedDepMtime = cache.dependencyMtimeMs.get(dep)
    if (nextDepMtime === undefined || cachedDepMtime === undefined || nextDepMtime !== cachedDepMtime) {
      return false
    }
  }
  return true
}

/**
 * 从 .vue 文件中提取 <json> 块的内容
 * @param vueFilePath .vue 文件的路径
 * @returns 提取的配置对象，如果不存在或解析失败则返回 undefined
 */
export async function extractConfigFromVue(vueFilePath: string): Promise<Record<string, any> | undefined> {
  try {
    const cached = vueConfigCache.get(vueFilePath)
    if (cached && await isVueConfigCacheValid(vueFilePath, cached)) {
      return cached.config
    }

    const content = await fs.readFile(vueFilePath, 'utf-8')
    const { descriptor, errors } = parse(content, { filename: vueFilePath })

    if (errors.length > 0) {
      return undefined
    }

    const mergedConfig: Record<string, any> = {}
    const macroDependencies: string[] = []
    const { parse: parseJson } = await import('comment-json')

    const jsonBlocks = descriptor.customBlocks.filter(block => block.type === 'json')
    for (const block of jsonBlocks) {
      try {
        const lang = (block.lang || 'json').toLowerCase()
        if (lang === 'json' || lang === 'jsonc' || lang === 'json5' || lang === 'txt') {
          const config = parseJson(block.content, undefined, true)
          if (config && typeof config === 'object' && !Array.isArray(config)) {
            Object.assign(mergedConfig, config)
          }
          continue
        }
      }
      catch {
        // 忽略解析错误
      }
    }

    const setupContent = descriptor.scriptSetup?.content
    const hasMacroHint = typeof setupContent === 'string'
      && JSON_MACRO_HINT_RE.test(setupContent)

    if (hasMacroHint) {
      const { extractJsonMacroFromScriptSetup } = await import('wevu/compiler')
      try {
        const autoRoutesInline = await resolveAutoRoutesInlineSnapshot()
        const macroEvalPreamble = descriptor.script?.content
          ? inlineAutoRoutesImports(descriptor.script.content, autoRoutesInline)
          : undefined
        const macroEvalContent = inlineAutoRoutesImports(setupContent, autoRoutesInline)
        const extracted = await extractJsonMacroFromScriptSetup(
          macroEvalContent,
          vueFilePath,
          descriptor.scriptSetup?.lang,
          {
            preambleContent: macroEvalPreamble,
          },
        )
        if (extracted.dependencies?.length) {
          macroDependencies.push(...extracted.dependencies)
        }
        if (extracted.config && typeof extracted.config === 'object' && !Array.isArray(extracted.config)) {
          mergeRecursive(mergedConfig, extracted.config)
        }
      }
      catch (error) {
        if (jsonBlocks.length === 0) {
          throw error
        }
      }
    }

    const normalizedDependencies = [...new Set(
      macroDependencies
        .filter(dep => dep && !NODE_MODULES_RE.test(dep))
        .map(dep => path.normalize(dep)),
    )]
    const dependencyMtimeMs = new Map<string, number>()
    await Promise.all(
      normalizedDependencies.map(async (dep) => {
        const mtime = await getMtimeCached(dep)
        if (mtime !== undefined) {
          dependencyMtimeMs.set(dep, mtime)
        }
      }),
    )
    const fileMtimeMs = await getMtimeCached(vueFilePath)
    const hasConfig = Object.keys(mergedConfig).length > 0
    vueConfigCache.set(vueFilePath, {
      config: hasConfig ? mergedConfig : undefined,
      fileMtimeMs,
      dependencies: normalizedDependencies,
      dependencyMtimeMs,
    })

    return hasConfig ? mergedConfig : undefined
  }
  catch (error) {
    if (process.env.__WEAPP_VITE_DEBUG_VUE_CONFIG__) {
      // eslint-disable-next-line no-console
      console.error('[extractConfigFromVue] failed:', vueFilePath, error)
    }
    return undefined
  }
}
