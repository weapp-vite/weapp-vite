import { isDeepStrictEqual } from 'node:util'
import { fs } from '@weapp-core/shared/fs'
import { formatIdeConfig, parseIdeConfig, readIdeConfig } from './document'
import { ideAssetWatchLeasePath } from './leases'

export interface IdeAssetWatchConfig {
  ignore?: string[]
  [key: string]: unknown
}

interface AssetPrivateConfig {
  watchOptions?: IdeAssetWatchConfig
  [key: string]: unknown
}

export interface IdeAssetWatchLease {
  owner?: string
  original: string | null
  installed: AssetPrivateConfig
  added: string[]
}

/** 仅接受仍由调用者持有的资产租约，不恢复已被其他命令接管的配置。 */
export async function readIdeAssetWatchLease(configPath: string, owner?: string): Promise<IdeAssetWatchLease> {
  const saved = await fs.readJSON(ideAssetWatchLeasePath(configPath)) as IdeAssetWatchLease
  if (!owner || saved.owner !== owner) {
    throw new Error('[weapp-vite] IDE 资产配置租约身份不匹配，拒绝恢复未知 owner 的配置。')
  }
  return saved
}

/** 从最新请求文本中移除本租约临时增加的 ignore，保留用户新增字段及格式。 */
export function restoreRequestedAssetWatch(source: string | null, saved: IdeAssetWatchLease): string | null {
  if (source === null) {
    return null
  }
  const current = parseIdeConfig(source) as AssetPrivateConfig
  if (isDeepStrictEqual(current, saved.installed)) {
    return saved.original
  }
  if (!current.watchOptions) {
    return source
  }
  const original = parseIdeConfig(saved.original) as AssetPrivateConfig
  const remaining = (current.watchOptions.ignore ?? []).filter(rule => !saved.added.includes(rule))
  current.watchOptions.ignore = remaining
  if (!remaining.length && !original.watchOptions?.ignore) {
    delete current.watchOptions.ignore
  }
  if (!Object.keys(current.watchOptions).length && !original.watchOptions) {
    delete current.watchOptions
  }
  return formatIdeConfig(current, source)
}

/** classic 可以在同一 owner 内接管资产租约，其他命令不得绕过磁盘排他。 */
export async function assertIdeAssetHandoff(configPath: string, owner?: string): Promise<void> {
  if (owner) {
    await readIdeAssetWatchLease(configPath, owner)
    return
  }
  if (await fs.pathExists(ideAssetWatchLeasePath(configPath))) {
    throw new Error('[weapp-vite] IDE 资产配置已由其他 owner 持有，拒绝接管 classic 配置。')
  }
}

/** 删除前再次核验 token；失败保留租约以便准确报告恢复责任。 */
export async function releaseIdeAssetWatchLease(configPath: string, owner: string): Promise<void> {
  await readIdeAssetWatchLease(configPath, owner)
  await fs.remove(ideAssetWatchLeasePath(configPath))
}

/** 终止尚未发布的交接时只恢复本资产租约，不启用 classic 或重建产物。 */
export async function restoreOwnedIdeAssetWatch(configPath: string, owner: string): Promise<void> {
  const saved = await readIdeAssetWatchLease(configPath, owner)
  const current = await readIdeConfig(configPath)
  const restored = restoreRequestedAssetWatch(current, saved)
  await readIdeAssetWatchLease(configPath, owner)
  if (restored !== current) {
    if (restored === null) {
      await fs.remove(configPath)
    }
    else {
      await fs.writeFile(configPath, restored)
    }
  }
  await releaseIdeAssetWatchLease(configPath, owner)
}
