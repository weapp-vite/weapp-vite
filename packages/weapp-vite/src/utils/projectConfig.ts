import type { MpPlatform, ProjectConfig } from '@/types'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { getProjectPlatformOptions } from '../platform'

interface ProjectConfigOptions {
  ignorePrivate?: boolean
  basePath?: string
  privatePath?: string
}

async function readProjectConfigFile(filePath: string, required: boolean) {
  if (!(await fs.pathExists(filePath))) {
    if (required) {
      throw new Error(`找不到项目配置文件：${filePath}`)
    }
    return {}
  }
  try {
    return await fs.readJson(filePath) || {}
  }
  catch {
    throw new Error(`解析 json 格式失败, ${filePath} 为非法的 json 格式`)
  }
}

const DEFAULT_PROJECT_PRIVATE_CONFIG_FILE_NAME = 'project.private.config.json'

export function getProjectConfigFileName(platform: MpPlatform): string {
  return getProjectPlatformOptions(platform).projectConfigFileName
}

export function getProjectPrivateConfigFileName(_: MpPlatform): string {
  return DEFAULT_PROJECT_PRIVATE_CONFIG_FILE_NAME
}

export function getProjectConfigRootKeys(platform: MpPlatform): readonly string[] {
  return getProjectPlatformOptions(platform).projectConfigRootKeys
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
  const baseJson = await readProjectConfigFile(baseJsonPath, true)
  const privateJson = options?.ignorePrivate ? {} : await readProjectConfigFile(privateJsonPath, false)

  return Object.assign({}, privateJson, baseJson) as ProjectConfig
}

export async function getProjectPrivateConfig(root: string, options?: Pick<ProjectConfigOptions, 'privatePath'>) {
  const privateJsonPath = path.resolve(root, options?.privatePath ?? 'project.private.config.json')
  return await readProjectConfigFile(privateJsonPath, false) as Record<string, any>
}

export async function disableProjectPrivateConfigHotReload(filePath: string): Promise<boolean> {
  const config = await readProjectConfigFile(filePath, true) as Record<string, any>
  const setting = config.setting && typeof config.setting === 'object' && !Array.isArray(config.setting)
    ? config.setting as Record<string, unknown>
    : {}
  if (setting.compileHotReLoad === false) {
    return false
  }
  config.setting = {
    ...setting,
    compileHotReLoad: false,
  }
  await fs.writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return true
}

export function resolveProjectConfigSyncDirs(options: {
  outDir: string
  projectConfigPath: string
}) {
  const outputRoot = path.dirname(options.outDir)
  const sourceBasePath = path.resolve(options.projectConfigPath)
  const sourceDir = path.dirname(sourceBasePath)
  const resolvedOutputRoot = path.resolve(outputRoot)
  const resolvedSourceDir = path.resolve(sourceDir)

  return {
    outputRoot,
    sourceBasePath,
    sourceDir,
    resolvedOutputRoot,
    resolvedSourceDir,
    shouldSync: resolvedSourceDir !== resolvedOutputRoot,
  }
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
  const syncDirs = resolveProjectConfigSyncDirs({
    outDir: options.outDir,
    projectConfigPath: options.projectConfigPath,
  })

  if (!syncDirs.shouldSync) {
    return
  }

  await fs.ensureDir(syncDirs.outputRoot)
  await fs.copy(syncDirs.sourceDir, syncDirs.outputRoot)
}
