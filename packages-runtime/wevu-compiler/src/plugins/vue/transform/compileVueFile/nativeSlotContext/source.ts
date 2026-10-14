import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { CompileVueFileOptions } from '../types'
import type { ScriptFacts } from './script'
import path from 'pathe'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../../../utils/resolvedId'
import { readFile } from '../../../../utils/cache'

interface SourceFacts {
  source: string
  descriptor?: SFCDescriptor
  invalid?: boolean
  script?: ScriptFacts
}

/** 缓存单个源文件的原始输入与解析事实，不保存递归分类或递归任务。 */
export type NativeSlotContextAnalysisCache = Map<string, Promise<SourceFacts | undefined>>

export function normalizeSourceId(id: string) {
  return path.normalize(normalizeFsResolvedId(id))
}

export function createSourceReader(options: CompileVueFileOptions | undefined, dependencies: Set<string>) {
  const cache = options?.nativeSlotContextCache ?? new Map<string, Promise<SourceFacts | undefined>>()
  const reader = options?.sfcSrc?.readFile ?? readFile
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
        const source = await reader(id, { checkMtime: options?.sfcSrc?.checkMtime })
        if (typeof source !== 'string') {
          return undefined
        }
        if (id.endsWith('.vue')) {
          const parsed = parseSfc(source, { filename: id, sourceMap: false, ignoreEmpty: true })
          return { source, descriptor: parsed.descriptor, invalid: parsed.errors.length > 0 }
        }
        return { source }
      }
      catch {
        return undefined
      }
    })()
    // 在 await 前发布单文件任务；删除缓存可撤销旧任务，旧任务不会重新写回。
    cache.set(id, task)
    return task
  }
  const resolve = async (source: string, importer: string): Promise<string | undefined> => {
    try {
      const resolved = await options?.sfcSrc?.resolveId?.(source, importer)
      if (resolved) {
        const id = normalizeSourceId(resolved)
        dependencies.add(id)
        return id
      }
      const normalized = normalizeSourceId(source)
      if (!source.startsWith('.') && !path.isAbsolute(normalized)) {
        return undefined
      }
      const id = path.isAbsolute(normalized) ? normalized : path.resolve(path.dirname(importer), normalized)
      dependencies.add(id)
      if (path.extname(id)) {
        return id
      }
      // 独立编译器沿用相对路径；宿主存在时优先使用其快照 resolver/reader。
      for (const candidate of [id, `${id}.ts`, `${id}.js`, `${id}.mts`, `${id}.mjs`, `${id}.tsx`, `${id}.jsx`, `${id}/index.ts`, `${id}/index.js`]) {
        if (await load(candidate)) {
          return candidate
        }
      }
      return id
    }
    catch {
      return undefined
    }
  }
  return { load, resolve }
}
