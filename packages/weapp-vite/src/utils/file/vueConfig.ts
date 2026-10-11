import type { MutableCompilerContext } from '../../context'
import type { AutoRoutesInlineSnapshot } from './autoRoutes'
import { createHash } from 'node:crypto'
import process from 'node:process'
import { fs } from '@weapp-core/shared/fs'
import { recursive as mergeRecursive } from 'merge'
import path from 'pathe'
import { parse } from 'vue/compiler-sfc'
import { hasAutoRoutesMacroImport, inlineAutoRoutesImports, resolveAutoRoutesInlineSnapshot } from './autoRoutes'

const vueConfigCache = new Map<string, {
  sourceHash: string
  config?: Record<string, any>
  autoRoutesSignature?: string
  fileMtimeMs?: number
  dependencies: string[]
  dependencyMtimeMs: Map<string, number>
}>()
const contextConfigCaches = new WeakMap<MutableCompilerContext, typeof vueConfigCache>()
const configMtimeInFlight = new Map<string, Promise<number | undefined>>()
const NODE_MODULES_RE = /[\\/]node_modules[\\/]/
const JSON_MACRO_HINT_RE = /\bdefine(?:App|Page|Component|Sitemap|Theme)Json\s*\(/

interface ExtractConfigFromVueOptions {
  compilerContext?: MutableCompilerContext
  readSource?: () => Promise<string | undefined>
  source?: string
  force?: boolean
}

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
  // 源码相同也必须保留 touch 的失效信号，宏可能读取未登记的外部值。
  const nextMtime = await getMtimeCached(vueFilePath)
  if (nextMtime === undefined || cache.fileMtimeMs === undefined || nextMtime !== cache.fileMtimeMs) {
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
export async function extractConfigFromVue(
  vueFilePath: string,
  options?: ExtractConfigFromVueOptions,
): Promise<Record<string, any> | undefined> {
  try {
    const context = options?.compilerContext
    const cache = context ? contextConfigCaches.get(context) ?? new Map() : vueConfigCache
    if (context) {
      contextConfigCaches.set(context, cache)
    }
    // 编译快照可能与磁盘具有相同 mtime；缓存身份必须来自本次实际消费的源码。
    const content = options?.source ?? (
      options?.readSource
        ? await options.readSource()
        : await fs.readFile(vueFilePath, 'utf-8')
    )
    if (content === undefined) {
      return undefined
    }
    const sourceHash = createHash('sha256').update(content, 'utf16le').digest('hex')
    const cached = options?.force ? undefined : cache.get(vueFilePath)
    let autoRoutesInline: AutoRoutesInlineSnapshot | undefined
    if (cached?.sourceHash === sourceHash && cached.autoRoutesSignature !== undefined) {
      autoRoutesInline = await resolveAutoRoutesInlineSnapshot(context)
    }
    if (cached?.sourceHash === sourceHash && (cached.autoRoutesSignature === undefined || cached.autoRoutesSignature === JSON.stringify(autoRoutesInline))
      && await isVueConfigCacheValid(vueFilePath, cached)) {
      return structuredClone(cached.config)
    }
    const { descriptor, errors } = parse(content, { filename: vueFilePath })

    if (errors.length > 0) {
      return undefined
    }

    const mergedConfig: Record<string, any> = {}
    const macroDependencies: string[] = []
    let cacheable = true
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
        const preambleContent = descriptor.script?.content
        // 普通 JSON 宏不依赖路由扫描，也不应触及其他编译上下文的支持文件。
        autoRoutesInline = hasAutoRoutesMacroImport(setupContent)
          || (preambleContent !== undefined && hasAutoRoutesMacroImport(preambleContent))
          ? autoRoutesInline ?? await resolveAutoRoutesInlineSnapshot(options?.compilerContext)
          : undefined
        const macroEvalPreamble = preambleContent && autoRoutesInline
          ? inlineAutoRoutesImports(preambleContent, autoRoutesInline)
          : preambleContent
        const macroEvalContent = autoRoutesInline
          ? inlineAutoRoutesImports(setupContent, autoRoutesInline)
          : setupContent
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
        // JSON 回退仍可使用，但宏依赖尚未完整发现，下一次必须允许重新求值。
        cacheable = false
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
    if (cacheable) {
      try {
        // 路由合并、buildScope 与入口派生字段只能修改调用方的配置副本。
        cache.set(vueFilePath, {
          sourceHash,
          config: hasConfig ? structuredClone(mergedConfig) : undefined,
          autoRoutesSignature: autoRoutesInline && JSON.stringify(autoRoutesInline),
          fileMtimeMs,
          dependencies: normalizedDependencies,
          dependencyMtimeMs,
        })
      }
      catch {
        // 非可克隆配置保留原返回行为，但不能把可变对象共享到后续构建。
        cache.delete(vueFilePath)
      }
    }
    else {
      cache.delete(vueFilePath)
    }

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
