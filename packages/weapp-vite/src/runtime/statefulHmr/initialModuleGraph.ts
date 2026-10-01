import path from 'pathe'

/** 显式约束引擎与首包依赖图的模块 ID 根目录，避免编程调用退回进程 cwd。 */
export function resolveStatefulHmrModuleRoot(root: string, cwd?: string): string {
  return cwd === undefined ? root : path.resolve(cwd)
}

export function toStableModuleId(id: string, root: string): string {
  const normalizedId = id.replaceAll('\\', '/')
  const absolute = path.posix.isAbsolute(normalizedId) || /^[A-Z]:\//i.test(normalizedId)
  if (normalizedId.startsWith('\0') || !absolute) {
    return normalizedId
  }
  return path.posix.relative(root.replaceAll('\\', '/'), normalizedId)
}
