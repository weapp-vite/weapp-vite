import path from 'node:path'
import process from 'node:process'

export const E2E_TARGET_FILE_ENV = 'WEAPP_VITE_E2E_TARGET_FILE'

function normalizeGlobPath(filePath: string) {
  return filePath.replaceAll('\\', '/')
}

/**
 * @description 解析 e2e 单文件执行时的 include 列表，优先使用环境变量指定的目标文件。
 */
export function resolveVitestIncludePatterns(baseDir: string, defaultPatterns: string[]) {
  const targetFile = process.env[E2E_TARGET_FILE_ENV]?.trim()
  if (!targetFile) {
    return defaultPatterns.map(normalizeGlobPath)
  }

  const resolvedTargetFile = path.isAbsolute(targetFile)
    ? targetFile
    : path.resolve(baseDir, targetFile)

  return [normalizeGlobPath(resolvedTargetFile)]
}
