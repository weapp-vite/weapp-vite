import type { SFCDescriptor, SFCParseResult } from 'vue/compiler-sfc'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { getReadFileCheckMtime } from '../../utils/cachePolicy'
import { readFile as readFileCached } from './cache'

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

export async function readAndParseSfc(
  filename: string,
  options?: ReadAndParseSfcOptions,
): Promise<{ source: string, descriptor: SFCDescriptor, errors: SFCParseResult['errors'] }> {
  const source = options?.source ?? await readFileCached(filename, { checkMtime: options?.checkMtime })
  const parsed = parseSfc(source, { filename })
  return {
    source,
    descriptor: parsed.descriptor,
    errors: parsed.errors,
  }
}

export function getSfcCheckMtime(config?: { isDev?: boolean }) {
  return getReadFileCheckMtime(config)
}
