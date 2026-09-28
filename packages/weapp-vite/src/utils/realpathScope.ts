import { realpathSync } from 'node:fs'

let activePaths: Map<string, string> | undefined

/** 仅在同步图遍历中复用成功的真实路径解析；不跨事件、构建或异步边界保留。 */
export function withRealpathScope<T>(read: () => T): T {
  const previous = activePaths
  activePaths ??= new Map()
  try {
    return read()
  }
  finally {
    activePaths = previous
  }
}

/** 失败保持原始异常语义，避免缺失文件在随后创建后仍命中失败缓存。 */
export function resolveRealpath(file: string): string {
  const cached = activePaths?.get(file)
  if (cached !== undefined) {
    return cached
  }
  const resolved = realpathSync.native(file)
  activePaths?.set(file, resolved)
  return resolved
}
