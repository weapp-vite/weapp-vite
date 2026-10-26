import type { File } from '@weapp-vite/ast/babelTypes'
import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { ResolveSfcBlockSrcOptions } from '../../../utils/vueSfc'
import path from 'pathe'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { readFile } from '../../../utils/cache'

export interface SourceFacts {
  source: string
  descriptor?: SFCDescriptor
  invalid?: boolean
  ast?: File
}

/** 只缓存单文件输入与解析事实，不保存传递闭包或递归任务。 */
export type SourceAnalysisCache = Map<string, Promise<SourceFacts | undefined>>

export function normalizeSourceId(id: string) {
  return path.normalize(normalizeFsResolvedId(id))
}

function isMissingSource(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error
    && ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(String(error.code)))
}

function sourceCandidates(id: string) {
  return path.extname(id)
    ? [id]
    : [id, `${id}.ts`, `${id}.js`, `${id}.mts`, `${id}.mjs`, `${id}.tsx`, `${id}.jsx`, `${id}/index.ts`, `${id}/index.js`]
}

/** 分析器共用宿主解析和冻结读取入口，依赖集合与缓存仍归调用方所有。 */
export function createAnalysisSourceReader(options: {
  source?: ResolveSfcBlockSrcOptions
  cache?: SourceAnalysisCache
  tolerateErrors?: boolean
  trackLogicalPaths?: boolean
}, dependencies: Set<string>) {
  const cache = options.cache ?? new Map<string, Promise<SourceFacts | undefined>>()
  const reader = options.source?.readFile ?? readFile
  const load = (input: string) => {
    const id = normalizeSourceId(input)
    dependencies.add(id)
    const cached = cache.get(id)
    if (cached) {
      return cached
    }
    const task = (async (): Promise<SourceFacts | undefined> => {
      if (isSkippableResolvedId(id)) {
        return undefined
      }
      try {
        const source = await reader(id, { checkMtime: options.source?.checkMtime })
        if (typeof source !== 'string') {
          return undefined
        }
        if (id.endsWith('.vue')) {
          const parsed = parseSfc(source, { filename: id, sourceMap: false, ignoreEmpty: true })
          return { source, descriptor: parsed.descriptor, invalid: parsed.errors.length > 0 }
        }
        return { source }
      }
      catch (error) {
        if (options.tolerateErrors || (!options.source?.readFile && isMissingSource(error))) {
          return undefined
        }
        throw error
      }
    })()
    // 在 await 前发布任务；调用方撤销旧缓存后，旧任务不会重新写回。
    cache.set(id, task)
    return task
  }
  const resolve = async (source: string, importer: string): Promise<string | undefined> => {
    try {
      const normalized = normalizeSourceId(source)
      const logicalId = source.startsWith('.') || path.isAbsolute(normalized)
        ? path.isAbsolute(normalized) ? normalized : path.resolve(path.dirname(importer), normalized)
        : undefined
      if (logicalId && options.trackLogicalPaths) {
        sourceCandidates(logicalId).forEach(id => dependencies.add(id))
      }
      const resolved = await options.source?.resolveId?.(source, importer)
      if (resolved) {
        const id = normalizeSourceId(resolved)
        dependencies.add(id)
        return id
      }
      if (!logicalId) {
        return undefined
      }
      const id = logicalId
      dependencies.add(id)
      if (path.extname(id)) {
        return id
      }
      for (const candidate of sourceCandidates(id)) {
        if (await load(candidate)) {
          return candidate
        }
      }
      return id
    }
    catch (error) {
      if (options.tolerateErrors) {
        return undefined
      }
      throw error
    }
  }
  return { load, resolve }
}
