import type { StatefulHmrOutputFile } from './outputWriter'
import { Buffer } from 'node:buffer'
import { isDeepStrictEqual } from 'node:util'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { defaultAssetExtensions } from '../../defaults'

interface WatchConfig {
  ignore?: string[]
  [key: string]: unknown
}

interface PrivateConfig {
  watchOptions?: WatchConfig
  [key: string]: unknown
}

interface WatchLease {
  original: string | null
  installed: PrivateConfig
  added: string[]
}

function leasePath(configPath: string) {
  return path.join(path.dirname(configPath), '.weapp-vite', 'ide-asset-watch.json')
}

/** IDE 会用监听索引校验 JSON 声明的资源，保守保留这些文件名及主题配置中的资源。 */
function assetPattern(output: StatefulHmrOutputFile[]) {
  const names = new Set<string>()
  const collect = (value: unknown): void => {
    if (typeof value === 'string' && !value.includes(':')) {
      const extension = path.extname(value)
      if (defaultAssetExtensions.includes(extension.slice(1))) {
        names.add(path.basename(value, extension).replace(/[\\*?[\]{}()!+@|.]/g, '\\$&'))
      }
    }
    else if (value && typeof value === 'object') {
      for (const child of Object.values(value)) {
        collect(child)
      }
    }
  }
  for (const file of output) {
    if (file.type === 'asset' && file.fileName.endsWith('.json')) {
      collect(JSON.parse(typeof file.source === 'string' ? file.source : Buffer.from(file.source).toString('utf8')))
    }
  }
  const basename = names.size ? `!(${[...names].sort().join('|')})` : '*'
  return `**/${basename}.{${defaultAssetExtensions.join(',')}}`
}

/** 恢复开发期间临时接管的资产监听；保留用户在会话内修改的其他配置。 */
export async function restoreIdeAssetWatch(configPath: string): Promise<void> {
  const savedPath = leasePath(configPath)
  if (!await fs.pathExists(savedPath)) {
    return
  }
  const saved = await fs.readJSON(savedPath) as WatchLease
  if (await fs.pathExists(configPath)) {
    const current = await fs.readJSON(configPath) as PrivateConfig
    if (isDeepStrictEqual(current, saved.installed)) {
      if (saved.original === null) {
        await fs.remove(configPath)
      }
      else {
        await fs.writeFile(configPath, saved.original)
      }
    }
    else if (current.watchOptions) {
      const original = saved.original === null ? {} : JSON.parse(saved.original) as PrivateConfig
      const remaining = (current.watchOptions.ignore ?? []).filter(rule => !saved.added.includes(rule))
      current.watchOptions.ignore = remaining
      if (!remaining.length && !original.watchOptions?.ignore) {
        delete current.watchOptions.ignore
      }
      if (!Object.keys(current.watchOptions).length && !original.watchOptions) {
        delete current.watchOptions
      }
      await fs.writeJSON(configPath, current, { spaces: 2 })
    }
  }
  await fs.remove(savedPath)
}

/**
 * 状态保持开发由 Vite 发布资产，IDE 仍按路径读取最新内容，但不因资产事件重建页面。
 * 规则仅作用于输出内的静态资产，关闭会话或下一次构建前恢复，代码和配置仍由 IDE 热加载。
 */
export async function installIdeAssetWatch(options: {
  configPath: string
  outDir: string
  inheritedWatchOptions?: WatchConfig
  output?: StatefulHmrOutputFile[]
}): Promise<() => Promise<void>> {
  const { configPath, outDir } = options
  await restoreIdeAssetWatch(configPath)
  const relative = path.relative(path.dirname(configPath), outDir)
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    // 自定义配置可仅作为编译输入，输出位于其目录之外；该 IDE 根本身不监听这些产物。
    // 不能写入越界 glob，也不能因此拒绝合法的独立构建。
    return async () => {}
  }
  const original = await fs.readFile(configPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  })
  const config: PrivateConfig = original === null ? {} : JSON.parse(original)
  const previous = config.watchOptions?.ignore ?? []
  const inherited = config.watchOptions ? [] : options.inheritedWatchOptions?.ignore ?? []
  const pattern = `${relative ? `${relative}/` : ''}${assetPattern(options.output ?? [])}`
  const added = [...new Set([...inherited, pattern])].filter(rule => !previous.includes(rule))
  config.watchOptions = {
    ...(config.watchOptions ?? options.inheritedWatchOptions),
    ignore: [...previous, ...added],
  }
  await fs.outputJSON(leasePath(configPath), { original, installed: config, added } satisfies WatchLease)
  await fs.writeJSON(configPath, config, { spaces: 2 })
  return () => restoreIdeAssetWatch(configPath)
}
