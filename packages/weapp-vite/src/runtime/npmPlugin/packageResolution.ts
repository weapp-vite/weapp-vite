import path from 'pathe'

/** 保留目录尾斜线，确保当前工程优先，并避免缺失包的目录回退把真实文件当作目录。 */
export function packageSearchOptions(resolveFrom?: string) {
  return resolveFrom ? { paths: [`${path.resolve(resolveFrom).replace(/\/$/, '')}/`] } : undefined
}
