import type { ConfigService } from '../config/types'
import path from 'pathe'

export function classicIdeConfigLeasePath(configPath: string) {
  return path.join(path.dirname(configPath), '.weapp-vite', `ide-classic-${path.basename(configPath)}`)
}

export function ideAssetWatchLeasePath(configPath: string) {
  return path.join(path.dirname(configPath), '.weapp-vite', 'ide-asset-watch.json')
}

/** 与 IDE 启动相同，分平台产物使用生成根，其余项目使用实际解析出的 private 配置。 */
export function resolveIdePrivateConfigPath(config: Pick<ConfigService, 'multiPlatform' | 'outDir' | 'projectPrivateConfigPath'>): string | undefined {
  return config.multiPlatform.enabled
    ? path.join(path.dirname(config.outDir), 'project.private.config.json')
    : config.projectPrivateConfigPath
}
