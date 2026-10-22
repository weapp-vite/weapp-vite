import type { ClassicIdeConfigOwner } from '../classicIdeConfig'
import type { StatefulHmrOutputFile } from './outputWriter'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { defaultAssetExtensions } from '../../defaults'
import { formatIdeConfig, parseIdeConfig, readIdeConfig } from '../classicIdeConfig/document'
import { classicIdeConfigLeasePath, ideAssetWatchLeasePath } from '../classicIdeConfig/leases'

interface WatchConfig {
  ignore?: string[]
  [key: string]: unknown
}

interface PrivateConfig {
  watchOptions?: WatchConfig
  [key: string]: unknown
}

interface WatchLease {
  owner?: string
  original: string | null
  installed: PrivateConfig
  added: string[]
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
export async function restoreIdeAssetWatch(configPath: string, owner?: string, classic?: ClassicIdeConfigOwner): Promise<void> {
  const savedPath = ideAssetWatchLeasePath(configPath)
  if (!await fs.pathExists(savedPath)) {
    return
  }
  const saved = await fs.readJSON(savedPath) as WatchLease
  if (!owner || saved.owner !== owner) {
    throw new Error('[weapp-vite] IDE 资产配置租约身份不匹配，拒绝恢复未知 owner 的配置。')
  }
  const source = await readIdeConfig(configPath)
  let restored = source
  if (source !== null) {
    const current = parseIdeConfig(source) as PrivateConfig
    if (isDeepStrictEqual(current, saved.installed)) {
      restored = saved.original
    }
    else if (current.watchOptions) {
      const original = parseIdeConfig(saved.original) as PrivateConfig
      const remaining = (current.watchOptions.ignore ?? []).filter(rule => !saved.added.includes(rule))
      current.watchOptions.ignore = remaining
      if (!remaining.length && !original.watchOptions?.ignore) {
        delete current.watchOptions.ignore
      }
      if (!Object.keys(current.watchOptions).length && !original.watchOptions) {
        delete current.watchOptions
      }
      restored = formatIdeConfig(current, source)
    }
  }
  if (classic) {
    await classic.activate(configPath, { source: restored, assetOwner: owner })
  }
  else if (restored !== source) {
    if (restored === null) {
      await fs.remove(configPath)
    }
    else {
      await fs.writeFile(configPath, restored)
    }
  }
  await fs.remove(savedPath)
}

/**
 * 状态保持开发由 Vite 发布资产，IDE 仍按路径读取最新内容，但不因资产事件重建页面。
 * 规则仅作用于输出内的静态资产，关闭会话时按 owner 身份恢复，代码和配置仍由 IDE 热加载。
 */
export async function installIdeAssetWatch(options: {
  configPath: string
  outDir: string
  inheritedWatchOptions?: WatchConfig
  output?: StatefulHmrOutputFile[]
}): Promise<(classic?: ClassicIdeConfigOwner) => Promise<void>> {
  const { configPath, outDir } = options
  const classicJournal = classicIdeConfigLeasePath(configPath)
  if (await fs.pathExists(classicJournal)) {
    throw new Error('[weapp-vite] IDE classic 配置已由其他 owner 持有，拒绝安装 stateful 资产监听。')
  }
  const relative = path.relative(path.dirname(configPath), outDir)
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    // 自定义配置可仅作为编译输入，输出位于其目录之外；该 IDE 根本身不监听这些产物。
    // 不能写入越界 glob，也不能因此拒绝合法的独立构建。
    return async () => {}
  }
  const original = await readIdeConfig(configPath)
  const config = parseIdeConfig(original) as PrivateConfig
  const previous = config.watchOptions?.ignore ?? []
  const inherited = config.watchOptions ? [] : options.inheritedWatchOptions?.ignore ?? []
  const pattern = `${relative ? `${relative}/` : ''}${assetPattern(options.output ?? [])}`
  const added = [...new Set([...inherited, pattern])].filter(rule => !previous.includes(rule))
  config.watchOptions = {
    ...(config.watchOptions ?? options.inheritedWatchOptions),
    ignore: [...previous, ...added],
  }
  const owner = randomUUID()
  const journal = ideAssetWatchLeasePath(configPath)
  await fs.ensureDir(path.dirname(journal))
  await fs.writeFile(journal, JSON.stringify({ owner, original, installed: config, added } satisfies WatchLease), { flag: 'wx' })
  let writeStarted = false
  try {
    if (await fs.pathExists(classicJournal)) {
      throw new Error('[weapp-vite] IDE classic 配置已由其他 owner 持有，拒绝安装 stateful 资产监听。')
    }
    writeStarted = true
    await fs.writeFile(configPath, formatIdeConfig(config, original))
  }
  catch (error) {
    try {
      if (writeStarted) {
        await restoreIdeAssetWatch(configPath, owner)
      }
      else {
        const saved = await fs.readJSON(journal) as WatchLease
        if (saved.owner !== owner) {
          throw new Error('[weapp-vite] IDE 资产配置租约身份已改变，拒绝释放其他 owner。')
        }
        await fs.remove(journal)
      }
    }
    catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'IDE asset config installation and cleanup failed', { cause: error })
    }
    throw error
  }
  let closing: Promise<void> | undefined
  return classic => closing ??= restoreIdeAssetWatch(configPath, owner, classic)
}
