import type { BuildOptions } from 'vite'

const placeholder = '[subpackage]'

export function hasSubpackagePlaceholder(value: unknown): value is string {
  return typeof value === 'string' && value.includes(placeholder)
}

/** 小程序显式配置了资源目录时，默认资源命名可按包输出。 */
export function plainSubpackageAssetsDir(build: BuildOptions | undefined) {
  if (!build || build.lib || build.ssr || !build.assetsDir || build.assetsDir.includes(placeholder)) {
    return
  }
  const directory = build.assetsDir.replaceAll('\\', '/').replace(/^(?:\.\/)+|\/+$/g, '')
  return directory && directory !== '.' ? directory : undefined
}

/** 命名函数可能按单个资源返回占位符，也需要完整消费者图。 */
export function mayUseSubpackageAssetNames(build: BuildOptions | undefined) {
  if (!build || build.lib || build.ssr) {
    return false
  }
  const output = build.rolldownOptions?.output ?? build.rollupOptions?.output
  const outputs = Array.isArray(output) ? output : [output]
  return hasSubpackagePlaceholder(build.assetsDir)
    || (Boolean(plainSubpackageAssetsDir(build)) && outputs.some(item => item?.assetFileNames === undefined))
    || outputs.some(item => hasSubpackagePlaceholder(item?.assetFileNames) || typeof item?.assetFileNames === 'function')
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
