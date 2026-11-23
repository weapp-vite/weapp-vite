const placeholder = '[subpackage]'

export function hasSubpackagePlaceholder(value: unknown): value is string {
  return typeof value === 'string' && value.includes(placeholder)
}

export function expandSubpackageTemplate(template: string, resolveRoot: () => string) {
  if (!hasSubpackagePlaceholder(template)) {
    return template
  }
  const normalized = template.replaceAll('\\', '/')
  const segments = normalized.split('/')
  if (segments.filter(segment => segment === placeholder).length !== 1
    || normalized.split(placeholder).length !== 2) {
    throw new Error('[weapp-vite] [subpackage] 必须作为一个完整目录段且只能出现一次。')
  }
  const root = resolveRoot()
  const expanded = segments.flatMap(segment => segment === placeholder ? root ? [root] : [] : [segment]).join('/')
  if (!expanded || expanded.startsWith('/') || /^[a-z]:/i.test(expanded)
    || expanded.split('/').some(segment => !segment || segment === '..' || segment === '.')) {
    throw new Error('[weapp-vite] [subpackage] 展开结果必须为 outDir 内的合法相对路径。')
  }
  return expanded
}

/** 独立分包内的命名模板仍由 bundler 展开，显式包含分包根目录时不重复拼接。 */
export function constrainIndependentAssetTemplate(template: string, packageRoot: string) {
  const normalized = template.replaceAll('\\', '/').replace(/^(?:\.\/)+/, '')
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)
    || normalized.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error(`[weapp-vite] 独立分包的 assetFileNames 必须为分包内的合法相对路径：${template}`)
  }
  return normalized.startsWith(`${packageRoot}/`) ? normalized : `${packageRoot}/${normalized}`
}
