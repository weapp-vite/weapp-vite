import type { ResolvedConfig } from 'vite'
import type { CompilerContext } from '../../../context'
import type { SubPackageStyleEntry } from '../../../types'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'
import path from 'pathe'
import { preprocessCSS } from 'vite'
import { cssPostProcess } from '../../../postcss'

export const cssCodeCache = new LRUCache<string, string>({
  max: 512,
})

const sharedStyleCache = new Map<string, {
  mtimeMs: number
  size: number
  result: PreprocessedStyleResult
}>()

const nodeRequire = (() => {
  try {
    return createRequire(import.meta.url)
  }
  catch {
    return null
  }
})()

export async function processCssWithCache(
  code: string,
  configService: CompilerContext['configService'],
): Promise<string> {
  const cacheKey = createHash('sha1')
    .update(configService.platform)
    .update('\0')
    .update(code)
    .digest('base64url')
  let processed = cssCodeCache.get(cacheKey)
  if (!processed) {
    processed = await cssPostProcess(code, { platform: configService.platform })
    cssCodeCache.set(cacheKey, processed)
  }
  return processed
}

function dedupeAndNormalizeDependencies(base: string, dependencies: Iterable<string | undefined>): string[] {
  const seen = new Set<string>()
  const baseDir = path.dirname(base)
  for (const dep of dependencies) {
    if (!dep) {
      continue
    }
    const normalized = path.isAbsolute(dep) ? dep : path.resolve(baseDir, dep)
    seen.add(normalized)
  }
  return Array.from(seen)
}

export interface PreprocessedStyleResult {
  css: string
  dependencies: string[]
}

export async function renderSharedStyleEntry(
  entry: SubPackageStyleEntry,
  _configService: CompilerContext['configService'],
  resolvedConfig?: ResolvedConfig,
): Promise<PreprocessedStyleResult> {
  const absolutePath = entry.absolutePath
  const cacheKey = `${absolutePath}:${resolvedConfig ? 'resolved' : 'raw'}`

  let stats: fs.Stats
  try {
    stats = await fs.stat(absolutePath)
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`[subpackages] 编译共享样式 \`${entry.source}\` 失败：${reason}`)
  }

  const cached = sharedStyleCache.get(cacheKey)
  if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    return {
      css: cached.result.css,
      dependencies: [...cached.result.dependencies],
    }
  }

  try {
    const css = await fs.readFile(absolutePath, 'utf8')
    if (!resolvedConfig) {
      const result = {
        css,
        dependencies: [],
      }
      sharedStyleCache.set(cacheKey, {
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        result,
      })
      return {
        css: result.css,
        dependencies: [...result.dependencies],
      }
    }

    const processed = await preprocessCSS(css, absolutePath, resolvedConfig)
    const dependencies = processed?.deps
      ? dedupeAndNormalizeDependencies(absolutePath, processed.deps)
      : []

    const result = {
      css: processed.code,
      dependencies,
    }

    sharedStyleCache.set(cacheKey, {
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      result,
    })

    return {
      css: result.css,
      dependencies: [...result.dependencies],
    }
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`[subpackages] 编译共享样式 \`${entry.source}\` 失败：${reason}`)
  }
}

export function invalidateSharedStyleCache() {
  sharedStyleCache.clear()
  cssCodeCache.clear()
  try {
    // 说明：Tailwind 会在模块级别缓存编译上下文。
    // 这里清空缓存，确保模板文件变更时能得到最新的 JIT 输出。
    const candidates = [
      // 说明：Tailwind v3 路径
      'tailwindcss/lib/lib/sharedState.js',
      // 说明：Tailwind v4 将文件移到了顶层 dist
      'tailwindcss/dist/sharedState.js',
      // 说明：源码路径回退（直接在仓库中运行时）
      'tailwindcss/src/lib/sharedState.js',
      'tailwindcss/sharedState.js',
    ]
    if (!nodeRequire) {
      return
    }
    for (const request of candidates) {
      try {
        const sharedState = nodeRequire(request)
        if (sharedState) {
          sharedState.contextMap?.clear?.()
          sharedState.configContextMap?.clear?.()
          sharedState.contextSourcesMap?.clear?.()
          sharedState.sourceHashMap?.clear?.()
          break
        }
      }
      catch {
        // 尝试下一个候选路径
      }
    }
  }
  catch {
    // 忽略可选依赖解析过程中的错误
  }
}
