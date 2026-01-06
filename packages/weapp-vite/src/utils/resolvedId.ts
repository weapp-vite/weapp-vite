import type { NormalizeViteIdOptions } from './viteId'
import { normalizeViteId } from './viteId'

export interface NormalizeFsResolvedIdOptions {
  /**
   * 是否剥离最前面的 `\0`。
   * @default false
   */
  stripLeadingNullByte?: boolean
}

export function isSkippableResolvedId(id: string | undefined | null) {
  if (!id) {
    return true
  }
  return id.startsWith('\0') || id.startsWith('node:')
}

/**
 * 将 Vite/Rolldown resolve 出来的 id 归一化为可用于 fs 读取/判断的路径形式。
 *
 * 默认会：
 * - 去掉 query（?xxx）
 * - 处理 `file://` URL
 * - 处理 `/@fs/` 前缀
 * - 可选剥离 `\0vue:` 前缀（默认开启）
 *
 * 注意：默认不剥离 `\0`，因为 `\0` 常用作虚拟模块标记，通常应当直接跳过。
 */
export function normalizeFsResolvedId(
  id: string,
  options?: NormalizeFsResolvedIdOptions & { normalize?: NormalizeViteIdOptions },
) {
  const normalized = normalizeViteId(id, {
    stripVueVirtualPrefix: true,
    ...(options?.normalize ?? {}),
  })
  if (options?.stripLeadingNullByte) {
    return normalizeViteId(normalized, { stripQuery: false, fileProtocolToPath: false, stripAtFsPrefix: false, stripLeadingNullByte: true })
  }
  return normalized
}
