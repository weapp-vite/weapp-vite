import type { Plugin } from 'vite'
import type { PlannedPackage } from './packagePlan'
import { fs } from '@weapp-core/shared/fs'
import { resolveModule } from 'local-pkg'
import path from 'pathe'
import { parseNpmPackageSpecifier } from '../../../utils/npmImport'
import { packageSearchOptions } from '../packageResolution'
import { resolvePreferredPackageEntry } from './shared'

export interface PackageEntryAsset {
  fileName: string
  input: string
  source: Uint8Array
}

export const PACKAGE_ASSET_ENTRY = '\0weapp-vite:npm-asset-entry'

/** 逻辑入口保留请求子路径，物理入口经包解析器处理 exports 和原始目录布局。 */
export async function resolvePlannedPackageEntries(node: PlannedPackage) {
  const { packageInfo: { rootPath, packageJson }, args: { dep } } = node
  const entries: Record<string, string> = {}
  const assets: PackageEntryAsset[] = []
  const index = await resolvePreferredPackageEntry(rootPath, packageJson) ?? resolveModule(dep, packageSearchOptions(rootPath))
  if (index) {
    entries.index = index
  }
  for (const [specifier, resolveFrom] of [...node.requests].sort(([left], [right]) => left.localeCompare(right))) {
    const parsed = parseNpmPackageSpecifier(specifier)!
    if (!parsed.subPath) {
      continue
    }
    const logical = path.posix.normalize(parsed.subPath).replace(/\.js$/, '')
    if (logical === '..' || logical.startsWith('../') || path.isAbsolute(logical) || logical.includes('\\')) {
      throw new Error(`[npm] 依赖子入口越过发布目录：${specifier}`)
    }
    const physical = resolveModule(specifier, packageSearchOptions(resolveFrom))
    if (!physical) {
      throw new Error(`[npm] 无法解析依赖子入口：${specifier}`)
    }
    if (path.extname(physical) === '.json' && !/\.[cm]?js$/.test(parsed.subPath)) {
      const fileName = logical.endsWith('.json') ? logical : `${logical}.json`
      const source = await fs.readFile(physical)
      const previous = assets.find(asset => asset.fileName === fileName)
      if (previous && (previous.input !== physical || !source.equals(previous.source))) {
        throw new Error(`[npm] 依赖资源映射冲突：${specifier}`)
      }
      if (!previous) {
        assets.push({ fileName, input: physical, source })
      }
      continue
    }
    if (entries[logical] && path.resolve(entries[logical]) !== path.resolve(physical)) {
      throw new Error(`[npm] 依赖入口映射冲突：${specifier}`)
    }
    entries[logical] = physical
  }
  return { entries, assets }
}

/** JSON 子入口保持原路径和字节，最终持久化仍由 Vite/Rolldown 原生写出负责。 */
export function createPackageEntryAssetPlugin(assets: PackageEntryAsset[], anchor: boolean): Plugin {
  return {
    name: 'weapp-vite:npm-entry-assets',
    resolveId: id => anchor && id.endsWith(PACKAGE_ASSET_ENTRY) ? PACKAGE_ASSET_ENTRY : undefined,
    load: id => anchor && id === PACKAGE_ASSET_ENTRY ? 'export {}' : undefined,
    buildStart() {
      for (const asset of assets) {
        this.addWatchFile(asset.input)
        this.emitFile({ type: 'asset', fileName: asset.fileName, source: asset.source })
      }
    },
    generateBundle(_options, bundle) {
      if (anchor) {
        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type === 'chunk' && output.facadeModuleId === PACKAGE_ASSET_ENTRY) {
            delete bundle[fileName]
          }
        }
      }
    },
  }
}

export function packageEntryFileName(entryName: string) {
  return /\.[cm]?js$/.test(entryName) ? entryName : `${entryName}.js`
}

/** 所有入口均需存在且不早于输入；旧的 index-only 缓存不能跳过新增子入口。 */
export async function arePackageEntriesCurrent(outDir: string, entries: Record<string, string>, assets: PackageEntryAsset[]) {
  for (const [entry, source] of Object.entries(entries)) {
    const destination = path.join(outDir, packageEntryFileName(entry))
    if (!(await fs.pathExists(destination))) {
      return false
    }
    const [input, output] = await Promise.all([fs.stat(source), fs.stat(destination)])
    if (input.mtimeMs > output.mtimeMs) {
      return false
    }
  }
  for (const asset of assets) {
    const destination = path.join(outDir, asset.fileName)
    if (!(await fs.pathExists(destination))) {
      return false
    }
    const [input, output, bytes] = await Promise.all([fs.stat(asset.input), fs.stat(destination), fs.readFile(destination)])
    if (input.mtimeMs > output.mtimeMs || !bytes.equals(asset.source)) {
      return false
    }
  }
  return true
}
