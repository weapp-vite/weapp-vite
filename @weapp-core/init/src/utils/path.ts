import path from 'pathe'

/**
 * @description 根据输出目录配置解析最终输出路径
 */
export function resolveOutputPath(root: string, dest: string | undefined, fallback: string) {
  if (!dest) {
    return fallback
  }

  return path.isAbsolute(dest) ? dest : path.resolve(root, dest)
}
