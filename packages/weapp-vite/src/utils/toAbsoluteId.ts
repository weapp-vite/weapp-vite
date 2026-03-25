import type { ConfigService } from '../runtime/config/types'
import path from 'pathe'
import { isSkippableResolvedId, normalizeFsResolvedId } from './resolvedId'

export interface ToAbsoluteIdOptions {
  /**
   * 未提供 importer 或 importer 不是绝对路径时的基准目录。
   * - `srcRoot`：使用 `configService.absoluteSrcRoot`
   * - `cwd`：使用 `configService.cwd`
   * @default 'srcRoot'
   */
  base?: 'srcRoot' | 'cwd'
}

/**
 * 将可能为相对路径的 id 解析为绝对路径。
 *
 * - 会先对 id/importer 做 `normalizeFsResolvedId`（去 query、处理 file://、/@fs/、\0vue: 等）
 * - 若 id 已是绝对路径则直接返回
 * - 若 importer 是绝对路径，则以 importer 所在目录为基准解析
 * - 否则使用 `configService.absoluteSrcRoot`（默认）或 `configService.cwd`（可选）作为基准解析
 *
 * 注意：对于 `\0xxx` / `node:` 这类虚拟 id，会原样返回（不做路径解析）。
 */
export function toAbsoluteId(
  id: string,
  configService: Pick<ConfigService, 'cwd' | 'absoluteSrcRoot'>,
  importer?: string,
  options?: ToAbsoluteIdOptions,
) {
  const cleanId = normalizeFsResolvedId(id)
  if (!cleanId || isSkippableResolvedId(cleanId)) {
    return cleanId
  }
  if (path.isAbsolute(cleanId)) {
    return cleanId
  }

  const cleanImporter = importer ? normalizeFsResolvedId(importer) : undefined
  if (cleanImporter && !isSkippableResolvedId(cleanImporter) && path.isAbsolute(cleanImporter)) {
    return path.resolve(path.dirname(cleanImporter), cleanId)
  }

  const baseDir = options?.base === 'cwd'
    ? configService.cwd
    : configService.absoluteSrcRoot
  return path.resolve(baseDir, cleanId)
}
