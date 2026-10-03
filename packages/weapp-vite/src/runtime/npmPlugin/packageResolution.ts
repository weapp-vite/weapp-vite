import path from 'pathe'

/** 使用明确的导入文件作为查找基准，避免 resolver 将无尾斜线的目录先按文件解析而命中上级同名包。 */
export function packageSearchOptions(resolveFrom?: string) {
  return resolveFrom ? { paths: [path.resolve(resolveFrom, 'package.json')] } : undefined
}
