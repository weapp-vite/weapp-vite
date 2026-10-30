import type { FormatConfig, OxfmtConfig } from 'vite-plus/fmt'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { recommended } from '../index'

export async function loadFormatterConfig(cwd: string, configFile?: string, workspaceFirst = false): Promise<{ config: OxfmtConfig, root: string }> {
  if (configFile?.endsWith('.json')) {
    const value: unknown = JSON.parse(await readFile(path.resolve(cwd, configFile), 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Oxfmt 配置必须是对象')
    }
    return { config: value as OxfmtConfig, root: path.dirname(path.resolve(cwd, configFile)) }
  }
  const vite = await import('vite-plus').catch((cause: unknown) => {
    throw new Error('weapp-vite-format 需要项目安装 Vite+ >=1.2.0。', { cause })
  })
  const workspace = vite.searchForWorkspaceRoot(cwd)
  const directories: string[] = []
  if (workspaceFirst) {
    directories.push(workspace)
  }
  for (let current = cwd; !directories.includes(current); current = path.dirname(current)) {
    directories.push(current)
    if (current === workspace || current === path.dirname(current)) {
      break
    }
  }
  for (const directory of directories) {
    const loaded = await vite.loadConfigFromFile({ command: 'build', mode: 'production' }, configFile ? path.resolve(cwd, configFile) : undefined, directory, 'silent')
    if (loaded?.config.fmt) {
      return { config: loaded.config.fmt, root: path.dirname(loaded.path) }
    }
    if (configFile) {
      throw new Error(`${configFile} 没有导出 fmt 配置`)
    }
    try {
      return await loadFormatterConfig(directory, '.oxfmtrc.json')
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }
  return { config: recommended, root: cwd }
}

export function toFormatOptions(config: OxfmtConfig): FormatConfig {
  const { associations: _associations, ignorePatterns: _ignorePatterns, overrides: _overrides, ...options } = config
  return options
}
