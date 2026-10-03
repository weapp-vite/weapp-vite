import type { HmrCompilerRequest } from '@weapp-vite/hmr'
import type { Compiler, CompilerGenerateRequest, CompilerGenerateResult } from 'weapp-tailwindcss/core'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { CompilerHmrResyncError } from '@weapp-vite/hmr'
import path from 'pathe'

export interface TailwindRootState {
  request: CompilerGenerateRequest
  result: CompilerGenerateResult
  rawSources: ReadonlyMap<string, string | null | undefined>
}

export interface TailwindRootHost {
  cwd: string
  sourceId: (file: string) => string
  isOutput?: (file: string) => boolean
  reusePreprocessedCss?: (file: string, previous: string | null | undefined, current: string | null | undefined) => boolean
}

const caches = new WeakMap<Compiler, WeakMap<TailwindRootState, { signature: string, result: CompilerGenerateResult }>>()

/** 使用封存源码驱动上游完整候选生成；框架预处理与输出排除由宿主提供。 */
export async function prepareTailwindRoots<K>(
  compiler: Compiler,
  request: HmrCompilerRequest,
  roots: ReadonlyMap<K, TailwindRootState>,
  options: TailwindRootHost,
): Promise<Map<K, CompilerGenerateResult>> {
  const cache = caches.get(compiler) ?? new WeakMap<TailwindRootState, { signature: string, result: CompilerGenerateResult }>()
  caches.set(compiler, cache)
  const capturedRoots = new Map(roots)
  request = { ...request, changedFiles: [...request.changedFiles], sources: new Map(request.sources) }
  const entries = new Map<K, CompilerGenerateResult>()
  if (!capturedRoots.size) {
    return entries
  }
  const { createTailwindV4CompiledSourceEntries, createTailwindV4SourceEntryMatcher } = await import('@weapp-tailwindcss/engine')
  for (const [index, root] of capturedRoots) {
    const base = root.request.sourceOptions?.projectRoot ?? root.request.source?.base ?? options.cwd
    const matches = createTailwindV4SourceEntryMatcher(createTailwindV4CompiledSourceEntries(
      root.result.root,
      [...root.result.sources],
      base,
    ))
    const sources = [...request.sources].flatMap(([file, content]) => content !== null && matches?.(file)
      && !(options.isOutput?.(file))
      ? [{ content, extension: path.extname(file).slice(1) }]
      : [])
    const sourceOptions = root.request.sourceOptions
    if (!sourceOptions) {
      throw new Error('Tailwind HMR requires a captured source entry')
    }
    const cssSources = sourceOptions.cssSources?.map((source) => {
      if (!source.file) {
        return source
      }
      const id = options.sourceId(source.file ?? '')
      const raw = request.sources.get(id)
      const previous = root.rawSources.get(id)
      if (raw === previous || raw === undefined) {
        return source
      }
      if (options.reusePreprocessedCss?.(id, previous, raw)) {
        return source
      }
      if (typeof raw !== 'string' || source.css !== previous) {
        throw new CompilerHmrResyncError(request.changedFiles, 'Compiler root requires a new preprocessed input')
      }
      return { ...source, css: raw }
    })
    const entrySources = (sourceOptions.cssEntries ?? []).map((file) => {
      const css = request.sources.get(options.sourceId(file))
      if (typeof css !== 'string') {
        throw new TypeError(`Missing captured Tailwind CSS input: ${file}`)
      }
      return { file, css, base: path.dirname(file), dependencies: [file] }
    })
    const memoryRoots = new Set([...cssSources ?? [], ...entrySources].flatMap(source => source.file ? [options.sourceId(source.file)] : []))
    const dependencyVersions = new Map<string, string>()
    const checkDependency = (file: string) => {
      const id = options.sourceId(file)
      if (memoryRoots.has(id)) {
        return
      }
      const expected = request.sources.get(id)
      const source = readFileSync(file, 'utf8')
      const stat = statSync(file, { bigint: true })
      const version = `${stat.mtimeNs}:${stat.ctimeNs}:${stat.ino}:${stat.size}`
      if (expected !== source || (dependencyVersions.has(id) && dependencyVersions.get(id) !== version)) {
        throw new CompilerHmrResyncError(request.changedFiles, 'Compiler dependency changed outside the captured input view')
      }
      dependencyVersions.set(id, version)
    }
    for (const file of root.result.dependencies) {
      checkDependency(file)
    }
    const signature = createHash('sha256').update(JSON.stringify([cssSources, entrySources, sources, [...dependencyVersions]])).digest('hex')
    const cached = cache.get(root)
    // 候选由 core 从完整内存来源提取；后续磁盘保存不能参与本次扫描。
    const generated = cached?.signature === signature
      ? cached.result
      : await compiler.generate({
          ...root.request,
          sourceOptions: { ...sourceOptions, cssEntries: [], cssSources: [...cssSources ?? [], ...entrySources] },
          sources,
          scanSources: false,
        })
    entries.set(index, generated)
    for (const file of generated.dependencies) {
      checkDependency(file)
    }
    cache.set(root, { signature, result: generated })
  }
  return entries
}
