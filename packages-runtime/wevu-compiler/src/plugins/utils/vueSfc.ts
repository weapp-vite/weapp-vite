import type { SFCDescriptor, SFCParseResult } from 'vue/compiler-sfc'
import type { ResolveSfcBlockSrcOptions } from './vueSfcBlockSrc'
import { LRUCache } from 'lru-cache'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { getReadFileCheckMtime } from '../../utils/cachePolicy'
import { normalizeLineEndings } from '../../utils/text'
import { mtimeCache, readFile as readFileCached } from './cache'
import { resolveSfcBlockSrc } from './vueSfcBlockSrc'

/**
 * 读取并解析 SFC 的配置。
 */
export interface ReadAndParseSfcOptions {
  /**
   * 直接传入源码以跳过文件读取。
   */
  source?: string
  /**
   * 是否按 mtime+size 检查文件变更（dev 推荐开启）。
   */
  checkMtime?: boolean
  /**
   * 解析 <template>/<script>/<style> 的 src 引用。
   */
  resolveSrc?: ResolveSfcBlockSrcOptions
}

const sfcParseCache = new LRUCache<
  string,
  {
    signature?: string
    source: string
    descriptor: SFCDescriptor
    errors: SFCParseResult['errors']
  }
>({
  max: 512,
})

const SCRIPT_SETUP_SRC_ATTR = 'data-weapp-vite-src'
const SCRIPT_SRC_ATTR = 'data-weapp-vite-script-src'
const SCRIPT_SETUP_TAG_RE = /<script\b([^>]*)>/gi
const SETUP_WORD_RE = /\bsetup\b/i
const SRC_WORD_RE = /\bsrc\b/i
const SRC_ATTR_RE = /\bsrc(\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))/i

/**
 * 预处理 `<script setup src>`，避免编译器丢失 src。
 */
export function preprocessScriptSetupSrc(source: string) {
  if (!source.includes('<script') || !source.includes('setup') || !source.includes('src')) {
    return source
  }
  return source.replace(SCRIPT_SETUP_TAG_RE, (full, attrs) => {
    if (!SETUP_WORD_RE.test(attrs) || !SRC_WORD_RE.test(attrs)) {
      return full
    }
    const nextAttrs = attrs.replace(
      SRC_ATTR_RE,
      `${SCRIPT_SETUP_SRC_ATTR}$1`,
    )
    return `<script${nextAttrs}>`
  })
}

/**
 * 预处理普通 `<script src>`，避免编译器丢失 src。
 */
export function preprocessScriptSrc(source: string) {
  if (!source.includes('<script') || !source.includes('src')) {
    return source
  }
  return source.replace(SCRIPT_SETUP_TAG_RE, (full, attrs) => {
    if (SETUP_WORD_RE.test(attrs) || !SRC_WORD_RE.test(attrs)) {
      return full
    }
    const nextAttrs = attrs.replace(
      SRC_ATTR_RE,
      `${SCRIPT_SRC_ATTR}$1`,
    )
    return `<script${nextAttrs}>`
  })
}

/**
 * 将预处理的 `<script setup src>` 恢复为真实 src。
 */
export function restoreScriptSetupSrc(descriptor: SFCDescriptor) {
  const scriptSetup = descriptor.scriptSetup
  if (!scriptSetup?.attrs || !(SCRIPT_SETUP_SRC_ATTR in scriptSetup.attrs)) {
    return
  }
  const raw = scriptSetup.attrs[SCRIPT_SETUP_SRC_ATTR]
  if (typeof raw === 'string') {
    scriptSetup.src = raw
  }
  delete scriptSetup.attrs[SCRIPT_SETUP_SRC_ATTR]
}

/**
 * 将预处理的 `<script src>` 恢复为真实 src。
 */
export function restoreScriptSrc(descriptor: SFCDescriptor) {
  const script = descriptor.script
  if (!script?.attrs || !(SCRIPT_SRC_ATTR in script.attrs)) {
    return
  }
  const raw = script.attrs[SCRIPT_SRC_ATTR]
  if (typeof raw === 'string') {
    script.src = raw
  }
  delete script.attrs[SCRIPT_SRC_ATTR]
}

export { resolveSfcBlockSrc }
export type { ResolveSfcBlockSrcOptions }

/**
 * 读取并解析 SFC，支持缓存与 src 解析。
 */
export async function readAndParseSfc(
  filename: string,
  options?: ReadAndParseSfcOptions,
): Promise<{ source: string, descriptor: SFCDescriptor, errors: SFCParseResult['errors'] }> {
  const checkMtime = options?.checkMtime ?? true
  const source = normalizeLineEndings(options?.source ?? await readFileCached(filename, { checkMtime }))
  const normalizedSource = preprocessScriptSrc(preprocessScriptSetupSrc(source))

  const signature = checkMtime
    ? (() => {
        const cached = mtimeCache.get(filename)
        if (!cached) {
          return undefined
        }
        return `${cached.mtimeMs}:${cached.size}`
      })()
    : undefined

  const cached = sfcParseCache.get(filename)
  if (cached) {
    const hit = signature ? cached.signature === signature : cached.source === source
    if (hit) {
      if (options?.resolveSrc) {
        const resolved = await resolveSfcBlockSrc(cached.descriptor, filename, options.resolveSrc)
        return {
          source,
          descriptor: resolved.descriptor,
          errors: cached.errors,
        }
      }
      return {
        source,
        descriptor: cached.descriptor,
        errors: cached.errors,
      }
    }
  }

  const parsed = parseSfc(normalizedSource, {
    filename,
    ignoreEmpty: normalizedSource === source,
  })
  restoreScriptSetupSrc(parsed.descriptor)
  restoreScriptSrc(parsed.descriptor)
  sfcParseCache.set(filename, {
    signature,
    source,
    descriptor: parsed.descriptor,
    errors: parsed.errors,
  })

  if (options?.resolveSrc) {
    const resolved = await resolveSfcBlockSrc(parsed.descriptor, filename, options.resolveSrc)
    return { source, descriptor: resolved.descriptor, errors: parsed.errors }
  }

  return { source, descriptor: parsed.descriptor, errors: parsed.errors }
}

/**
 * 获取 SFC 读取时是否检查 mtime 的策略。
 */
export function getSfcCheckMtime(config?: { isDev?: boolean }) {
  return getReadFileCheckMtime(config)
}
