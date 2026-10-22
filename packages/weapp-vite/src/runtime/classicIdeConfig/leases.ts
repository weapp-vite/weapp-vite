import path from 'pathe'

export function classicIdeConfigLeasePath(configPath: string) {
  return path.join(path.dirname(configPath), '.weapp-vite', `ide-classic-${path.basename(configPath)}`)
}

export function ideAssetWatchLeasePath(configPath: string) {
  return path.join(path.dirname(configPath), '.weapp-vite', 'ide-asset-watch.json')
}
