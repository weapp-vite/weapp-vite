import type { BuildTarget, CompilerContext } from '../../context'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import picomatch from 'picomatch'
import { defaultAssetExtensions, defaultExcluded } from '../../defaults'
import { normalizePath } from '../../utils/path'

/** 构建收集和开发监听使用同一份复制资源规则，避免隐式依赖其他插件的目录监听。 */
export function createAssetSourcePlan(
  config: CompilerContext['configService'],
  outDir: string,
  target: BuildTarget,
) {
  const copy = config.weappViteConfig?.copy
  const include = Array.isArray(copy?.include) ? copy.include : []
  const exclude = Array.isArray(copy?.exclude) ? copy.exclude : []
  const filter = copy?.filter ?? (() => true)
  const roots = target === 'plugin'
    ? config.absolutePluginRoot ? [config.absolutePluginRoot] : []
    : [config.absoluteSrcRoot]
  const patterns = [`**/*.{${defaultAssetExtensions.join(',')}}`, ...include]
  const ignored = [...defaultExcluded, path.resolve(config.cwd, `${outDir}/**/*`), ...exclude]
  const includeMatcher = picomatch(patterns.map(normalizePath), { dot: false })
  const ignoreMatcher = picomatch(ignored.map(normalizePath), { dot: true })
  const ignoredDirectories = picomatch(defaultExcluded.filter(pattern => pattern.endsWith('/**')), { dot: true })
  const outputRoot = normalizePath(path.resolve(config.cwd, outDir))
  const contains = (root: string, file: string) => {
    const relative = path.relative(root, file)
    return relative === '' || (relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative))
  }
  const variants = (file: string) => {
    const result = new Set([normalizePath(file)])
    for (const root of [...roots, config.absoluteSrcRoot, config.cwd]) {
      const relative = path.relative(root, file)
      if (relative && contains(root, file)) {
        result.add(normalizePath(relative))
      }
    }
    return [...result]
  }
  const isIgnored = (file: string) => contains(outputRoot, normalizePath(file))
    || variants(file).some(value => ignoreMatcher(value))
  const matchesPath = (file: string) => roots.some(root => contains(root, file))
    && !isIgnored(file)
    && variants(file).some(value => includeMatcher(value))
  return {
    roots,
    isIgnored,
    matchesPath,
    // copy.exclude 按文件匹配；仅目录名命中不能证明其所有后代都被排除。
    ignoresDirectory: (file: string) => contains(outputRoot, normalizePath(file))
      || variants(file).some(value => ignoredDirectories(value)),
    async scan() {
      const files = new Set<string>()
      for (const root of roots) {
        const entries = await new Fdir({ includeDirs: false, pathSeparator: '/' }).withFullPaths().crawl(root).withPromise()
        for (const file of entries) {
          if (matchesPath(file)) {
            files.add(file)
          }
        }
      }
      return [...files].filter(filter)
    },
  }
}
