import { stat } from 'node:fs/promises'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import { normalizePath } from '../../utils/path'

export interface PublicAssetOptions {
  publicDir: string | false
  copyPublicDir: boolean
}

/** public 保留 Vite 的任意扩展名与点文件语义，不套用源码 copy 的过滤规则。 */
export function createPublicAssetSourcePlan(options: PublicAssetOptions | undefined, outDir: string) {
  const publicRoot = options?.copyPublicDir && options.publicDir ? normalizePath(options.publicDir) : undefined
  const outputRoot = normalizePath(outDir)
  const contains = (root: string, file: string) => {
    const relative = path.relative(root, normalizePath(file))
    return relative === '' || (relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative))
  }
  const isIgnored = (file: string) => contains(outputRoot, file)
  const matchesPath = (file: string) => Boolean(publicRoot && contains(publicRoot, file) && !isIgnored(file))
  return {
    roots: publicRoot ? [publicRoot] : [],
    matchesPath,
    ignoresDirectory: isIgnored,
    outputName: (file: string) => path.relative(publicRoot!, normalizePath(file)),
    async scan(): Promise<string[]> {
      if (!publicRoot) {
        return []
      }
      try {
        await stat(publicRoot)
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return []
        }
        throw error
      }
      return new Fdir({ includeDirs: false, pathSeparator: '/' })
        .withFullPaths()
        .withErrors()
        .withSymlinks({ resolvePaths: false })
        .exclude((_name, directory) => isIgnored(directory))
        .filter(file => matchesPath(file))
        .crawl(publicRoot)
        .withPromise()
    },
  }
}
