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
}): Promise<() => Promise<void>> {
  const { configPath, outDir } = options
  await restoreIdeAssetWatch(configPath)
  const relative = path.relative(path.dirname(configPath), outDir)
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('Stateful HMR output must be inside the IDE project to manage asset watching')
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
  const pattern = path.posix.join(relative, `**/*.{${defaultAssetExtensions.join(',')}}`)
  const added = [...new Set([...inherited, pattern])].filter(rule => !previous.includes(rule))
  config.watchOptions = {
    ...(config.watchOptions ?? options.inheritedWatchOptions),
    ignore: [...previous, ...added],
  }
  await fs.outputJSON(leasePath(configPath), { original, installed: config, added } satisfies WatchLease)
  await fs.writeJSON(configPath, config, { spaces: 2 })
  return () => restoreIdeAssetWatch(configPath)
}
