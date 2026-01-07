import type { SFCDescriptor, SFCParseResult } from 'vue/compiler-sfc'
import { LRUCache } from 'lru-cache'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { getReadFileCheckMtime } from '../../utils/cachePolicy'
import { mtimeCache, readFile as readFileCached } from './cache'

export interface ReadAndParseSfcOptions {
  /**
   * 直接传入源码以跳过文件读取。
   */
  source?: string
  /**
   * 是否按 mtime+size 检查文件变更（dev 推荐开启）。
   */
  checkMtime?: boolean
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

export async function readAndParseSfc(
  filename: string,
  options?: ReadAndParseSfcOptions,
): Promise<{ source: string, descriptor: SFCDescriptor, errors: SFCParseResult['errors'] }> {
  const checkMtime = options?.checkMtime ?? true
  const source = options?.source ?? await readFileCached(filename, { checkMtime })

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
      return {
        source,
        descriptor: cached.descriptor,
        errors: cached.errors,
      }
    }
  }

  const parsed = parseSfc(source, { filename })
  sfcParseCache.set(filename, {
    signature,
    source,
    descriptor: parsed.descriptor,
    errors: parsed.errors,
  })

  return { source, descriptor: parsed.descriptor, errors: parsed.errors }
}

export function getSfcCheckMtime(config?: { isDev?: boolean }) {
  return getReadFileCheckMtime(config)
}
