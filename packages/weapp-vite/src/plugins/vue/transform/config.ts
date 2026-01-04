import type { SFCBlock } from 'vue/compiler-sfc'
import { parse as parseJson } from 'comment-json'
import fs from 'fs-extra'
import { recursive as mergeRecursive } from 'merge'
import path from 'pathe'
import { bundleRequire } from 'rolldown-require'
import { withTempDirLock } from './tempDirLock'

export type JsLikeLang = 'js' | 'ts'

export function normalizeConfigLang(lang?: string) {
  if (!lang) {
    return 'json'
  }
  const lower = lang.toLowerCase()
  if (lower === 'txt') {
    return 'json'
  }
  return lower
}

export function isJsonLikeLang(lang: string) {
  return lang === 'json' || lang === 'jsonc' || lang === 'json5'
}

export function resolveJsLikeLang(lang: string): JsLikeLang {
  if (lang === 'ts' || lang === 'tsx' || lang === 'cts' || lang === 'mts') {
    return 'ts'
  }
  return 'js'
}

export async function evaluateJsLikeConfig(source: string, filename: string, lang: string) {
  const dir = path.dirname(filename)
  const extension = resolveJsLikeLang(lang) === 'ts' ? 'ts' : 'js'
  const tempDir = path.join(dir, '.wevu-config')

  return await withTempDirLock(tempDir, async () => {
    await fs.ensureDir(tempDir)
    const basename = path.basename(filename, path.extname(filename))
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const tempFile = path.join(tempDir, `${basename}.${unique}.${extension}`)
    await fs.writeFile(tempFile, source, 'utf8')

    try {
      const { mod } = await bundleRequire<{ default?: any }>({
        filepath: tempFile,
        cwd: dir,
      })

      let resolved: any = mod?.default ?? mod
      if (typeof resolved === 'function') {
        resolved = resolved()
      }
      if (resolved && typeof resolved.then === 'function') {
        resolved = await resolved
      }
      if (resolved && typeof resolved === 'object') {
        return resolved
      }
      throw new Error('Config block must export an object or a function returning an object')
    }
    finally {
      try {
        await fs.remove(tempFile)
      }
      catch {
        // 忽略清理失败
      }
      try {
        const remains = await fs.readdir(tempDir)
        if (remains.length === 0) {
          await fs.remove(tempDir)
        }
      }
      catch {
        // 忽略清理失败
      }
    }
  })
}

export async function compileConfigBlocks(blocks: SFCBlock[], filename: string): Promise<string | undefined> {
  const jsonBlocks = blocks.filter(block => block.type === 'json')
  if (!jsonBlocks.length) {
    return undefined
  }

  const accumulator: Record<string, any> = {}
  for (const block of jsonBlocks) {
    const lang = normalizeConfigLang(block.lang)
    try {
      // json/jsonc/json5 默认都支持注释（comment-json）
      if (isJsonLikeLang(lang)) {
        const parsed = parseJson(block.content, undefined, true)
        mergeRecursive(accumulator, parsed)
        continue
      }

      const evaluated = await evaluateJsLikeConfig(block.content, filename, lang)
      if (!evaluated || typeof evaluated !== 'object') {
        continue
      }
      mergeRecursive(accumulator, evaluated)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to parse <json> block (${lang}) in ${filename}: ${message}`)
    }
  }

  // 去除提示用的 $schema
  if (Reflect.has(accumulator, '$schema')) {
    delete (accumulator as any).$schema
  }
  return JSON.stringify(accumulator, null, 2)
}
