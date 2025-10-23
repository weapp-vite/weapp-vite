import type { ResolvedConfig } from 'vite'
import type { CompilerContext } from '../../../context'
import type { SubPackageStyleEntry } from '../../../types'
import { objectHash } from '@weapp-core/shared'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'
import path from 'pathe'
import { preprocessCSS } from 'vite'
import { cssPostProcess } from '../../../postcss'

export const cssCodeCache = new LRUCache<string, string>({
  max: 512,
})

export async function processCssWithCache(
  code: string,
  configService: CompilerContext['configService'],
): Promise<string> {
  const cacheKey = objectHash({
    code,
    options: { platform: configService.platform },
  })
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

  try {
    const css = await fs.readFile(absolutePath, 'utf8')
    if (!resolvedConfig) {
      return {
        css,
        dependencies: [],
      }
    }

    const processed = await preprocessCSS(css, absolutePath, resolvedConfig)
    const dependencies = processed?.deps
      ? dedupeAndNormalizeDependencies(absolutePath, processed.deps)
      : []

    return {
      css: processed.code,
      dependencies,
    }
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`[subpackages] 编译共享样式 \`${entry.source}\` 失败：${reason}`)
  }
}
