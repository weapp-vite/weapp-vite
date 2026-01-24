import type { MpPlatform, ProjectConfig } from '@/types'
import fs from 'fs-extra'
import path from 'pathe'

interface ProjectConfigOptions {
  ignorePrivate?: boolean
  basePath?: string
  privatePath?: string
}

const DEFAULT_PROJECT_CONFIG_ROOT_KEYS = ['miniprogramRoot', 'srcMiniprogramRoot'] as const

const PROJECT_CONFIG_FILE_BY_PLATFORM: Record<MpPlatform, string> = {
  weapp: 'project.config.json',
  alipay: 'mini.project.json',
  tt: 'project.config.json',
  swan: 'project.swan.json',
  jd: 'project.config.json',
  xhs: 'project.config.json',
}

const PROJECT_CONFIG_ROOT_KEYS_BY_PLATFORM: Record<MpPlatform, readonly string[]> = {
  weapp: DEFAULT_PROJECT_CONFIG_ROOT_KEYS,
  alipay: DEFAULT_PROJECT_CONFIG_ROOT_KEYS,
  tt: DEFAULT_PROJECT_CONFIG_ROOT_KEYS,
  swan: ['smartProgramRoot', ...DEFAULT_PROJECT_CONFIG_ROOT_KEYS],
  jd: DEFAULT_PROJECT_CONFIG_ROOT_KEYS,
  xhs: DEFAULT_PROJECT_CONFIG_ROOT_KEYS,
}

export function getProjectConfigFileName(platform: MpPlatform): string {
  return PROJECT_CONFIG_FILE_BY_PLATFORM[platform] ?? 'project.config.json'
}

export function getProjectPrivateConfigFileName(_: MpPlatform): string {
  return 'project.private.config.json'
}

export function getProjectConfigRootKeys(platform: MpPlatform): readonly string[] {
  return PROJECT_CONFIG_ROOT_KEYS_BY_PLATFORM[platform] ?? DEFAULT_PROJECT_CONFIG_ROOT_KEYS
}

export function resolveProjectConfigRoot(projectConfig: ProjectConfig, platform: MpPlatform): string | undefined {
  const keys = getProjectConfigRootKeys(platform)
  for (const key of keys) {
    const value = (projectConfig as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}

export async function getProjectConfig(root: string, options?: ProjectConfigOptions) {
  const baseJsonPath = path.resolve(root, options?.basePath ?? 'project.config.json')
  const privateJsonPath = path.resolve(root, options?.privatePath ?? 'project.private.config.json')
  let baseJson = {}
  let privateJson = {}
  if (await fs.pathExists(baseJsonPath)) {
    try {
      baseJson = await fs.readJson(baseJsonPath) || {}
    }
    catch {
      throw new Error(`解析 json 格式失败, ${baseJsonPath} 为非法的 json 格式`)
    }
  }
  else {
    throw new Error(`找不到项目配置文件：${baseJsonPath}`)
  }
  if (!options?.ignorePrivate) {
    if (await fs.pathExists(privateJsonPath)) {
      try {
        privateJson = await fs.readJson(privateJsonPath) || {}
      }
      catch {
        throw new Error(`解析 json 格式失败, ${privateJsonPath} 为非法的 json 格式`)
      }
    }
  }

  return Object.assign({}, privateJson, baseJson) as ProjectConfig
}

export async function syncProjectConfigToOutput(options: {
  outDir: string
  projectConfigPath?: string
  projectPrivateConfigPath?: string
  enabled: boolean
}) {
  if (!options.enabled || !options.projectConfigPath) {
    return
  }
  const outputRoot = path.dirname(options.outDir)
  const sourceBasePath = path.resolve(options.projectConfigPath)
  const sourceDir = path.dirname(sourceBasePath)
  const resolvedOutputRoot = path.resolve(outputRoot)
  const resolvedSourceDir = path.resolve(sourceDir)

  if (resolvedSourceDir === resolvedOutputRoot) {
    return
  }

  await fs.ensureDir(outputRoot)
  await fs.copy(sourceDir, outputRoot)
}
