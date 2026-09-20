/** 原生脚本场景必须对应独立模板入口，类型与工具模块不会生成同名页面产物。 */
export function isNativeBenchmarkScriptEntry(filename: string, sourceFiles: ReadonlySet<string>) {
  const normalized = filename.replaceAll('\\', '/')
  if (normalized.endsWith('.d.ts') || !/\.(?:ts|js)$/.test(normalized)) {
    return false
  }
  const stem = normalized.replace(/\.(?:ts|js)$/, '')
  return sourceFiles.has(`${stem}.wxml`) || sourceFiles.has(`${stem}.html`)
}
