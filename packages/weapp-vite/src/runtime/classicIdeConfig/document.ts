import { fs } from '@weapp-core/shared/fs'

export interface PrivateIdeConfig {
  setting?: { compileHotReLoad?: boolean, [key: string]: unknown }
  [key: string]: unknown
}

export async function readIdeConfig(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export function parseIdeConfig(source: string | null): PrivateIdeConfig {
  return source === null ? {} : JSON.parse(source.replace(/^\uFEFF/u, '')) as PrivateIdeConfig
}

export function formatIdeConfig(config: PrivateIdeConfig, reference: string | null): string {
  const newline = reference?.includes('\r\n') ? '\r\n' : '\n'
  const indent = reference?.match(/\n([\t ]+)"/)?.[1] ?? 2
  const suffix = reference === null || reference.endsWith('\n') ? newline : ''
  const bom = reference?.startsWith('\uFEFF') ? '\uFEFF' : ''
  return bom + JSON.stringify(config, null, indent).replaceAll('\n', newline) + suffix
}

/** 只撤销本 owner 写入的 false，用户改动过的值和其他字段由用户继续持有。 */
export function restoreRequestedHotReload(current: PrivateIdeConfig, requested: PrivateIdeConfig): PrivateIdeConfig {
  if (current.setting?.compileHotReLoad !== false) {
    return current
  }
  const setting = { ...current.setting }
  const restored: PrivateIdeConfig = { ...current, setting }
  if (Object.hasOwn(requested.setting ?? {}, 'compileHotReLoad')) {
    setting.compileHotReLoad = requested.setting!.compileHotReLoad
  }
  else {
    delete setting.compileHotReLoad
    if (!Object.keys(setting).length && !requested.setting) {
      delete restored.setting
    }
  }
  return restored
}
