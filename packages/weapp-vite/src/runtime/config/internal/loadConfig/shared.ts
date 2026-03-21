import type { PackageJson } from 'pkg-types'
import type { RolldownPluginOption } from 'rolldown'
import type { MpPlatform } from '../../../../types'
import path from 'pathe'
import { getProjectConfigFileName, getProjectPrivateConfigFileName } from '../../../../utils'
import { toPosixPath } from '../../../../utils/path'

const TRAILING_SLASH_RE = /\/+$/

export function pluginMatchesName(plugin: RolldownPluginOption<any>, targetName: string): boolean {
  if (Array.isArray(plugin)) {
    return plugin.some(entry => pluginMatchesName(entry, targetName))
  }

  if (plugin && typeof plugin === 'object' && 'name' in plugin) {
    const pluginName = (plugin as { name?: unknown }).name
    return typeof pluginName === 'string' && pluginName === targetName
  }

  return false
}

export interface ResolvedMultiPlatformConfig {
  enabled: boolean
  projectConfigRoot: string
}

export function resolveMultiPlatformConfig(value: unknown): ResolvedMultiPlatformConfig {
  if (!value) {
    return {
      enabled: false,
      projectConfigRoot: 'config',
    }
  }
  if (value === true) {
    return {
      enabled: true,
      projectConfigRoot: 'config',
    }
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as { enabled?: boolean, projectConfigRoot?: string }
    const root = record.projectConfigRoot?.trim()
    return {
      enabled: record.enabled !== false,
      projectConfigRoot: root || 'config',
    }
  }
  return {
    enabled: false,
    projectConfigRoot: 'config',
  }
}

export function resolveProjectConfigPaths(options: {
  platform: MpPlatform
  multiPlatform: ResolvedMultiPlatformConfig
  projectConfigPath?: string
  isWebRuntime: boolean
}) {
  if (options.isWebRuntime) {
    return {}
  }
  const projectConfigFileName = getProjectConfigFileName(options.platform)
  const projectPrivateConfigFileName = getProjectPrivateConfigFileName(options.platform)
  if (options.projectConfigPath) {
    const basePath = options.projectConfigPath
    const privatePath = path.join(path.dirname(basePath), `project.private.config.${options.platform}.json`)
    return {
      basePath,
      privatePath,
    }
  }
  if (!options.multiPlatform.enabled) {
    return {
      basePath: projectConfigFileName,
      privatePath: projectPrivateConfigFileName,
    }
  }
  const rootDir = options.multiPlatform.projectConfigRoot || 'config'
  return {
    basePath: path.join(rootDir, options.platform, projectConfigFileName),
    privatePath: path.join(rootDir, options.platform, projectPrivateConfigFileName),
  }
}

export function formatProjectConfigPath(cwd: string, target?: string) {
  if (!target) {
    return 'project.config.json'
  }
  const resolved = path.resolve(cwd, target)
  const relative = path.relative(cwd, resolved)
  return relative && !relative.startsWith('..') ? relative : resolved
}

export function normalizeRelativeDistRoot(value: string) {
  const normalized = toPosixPath(value).replace(TRAILING_SLASH_RE, '')
  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

export async function loadPackageJson(fs: typeof import('fs-extra'), cwd: string) {
  const packageJsonPath = path.resolve(cwd, 'package.json')
  let packageJson: PackageJson = {}
  if (await fs.pathExists(packageJsonPath)) {
    const content: PackageJson = await fs.readJson(packageJsonPath, {
      throws: false,
    }) || {}
    packageJson = content
  }

  return {
    packageJson,
    packageJsonPath,
  }
}
