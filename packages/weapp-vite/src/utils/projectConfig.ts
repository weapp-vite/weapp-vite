import type { MpPlatform, ProjectConfig } from '@/types'
/* eslint-disable e18e/ban-dependencies -- fs-extra is the existing project utility for JSON/copy helpers here. */
import fs from 'fs-extra'
import path from 'pathe'
import { getMiniProgramPlatformAdapter } from '../platform'

interface ProjectConfigOptions {
  ignorePrivate?: boolean
  basePath?: string
  privatePath?: string
}

const DEFAULT_PROJECT_PRIVATE_CONFIG_FILE_NAME = 'project.private.config.json'

export function getProjectConfigFileName(platform: MpPlatform): string {
  return getMiniProgramPlatformAdapter(platform).projectConfigFileName
}

export function getProjectPrivateConfigFileName(_: MpPlatform): string {
  return DEFAULT_PROJECT_PRIVATE_CONFIG_FILE_NAME
}

export function getProjectConfigRootKeys(platform: MpPlatform): readonly string[] {
  return getMiniProgramPlatformAdapter(platform).projectConfigRootKeys
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
