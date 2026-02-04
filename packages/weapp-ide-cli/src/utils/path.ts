import process from 'node:process'
import path from 'pathe'

/**
 * @description 解析为绝对路径（基于当前工作目录）
 */
export function resolvePath(filePath: string) {
  if (path.isAbsolute(filePath)) {
    return filePath
  }

  return path.resolve(process.cwd(), filePath)
}
