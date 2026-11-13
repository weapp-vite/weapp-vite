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
