import type { ProjectConfig } from '@/types'
import fs from 'fs-extra'
import path from 'pathe'

interface ProjectConfigOptions {
  ignorePrivate?: boolean
  basePath?: string
  privatePath?: string
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
    throw new Error(`找不到 project.config 配置文件：${baseJsonPath}`)
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
  const baseDestPath = path.join(outputRoot, 'project.config.json')
  const sourceBasePath = path.resolve(options.projectConfigPath)
  const destBasePath = path.resolve(baseDestPath)
  const shouldCopyBase = sourceBasePath !== destBasePath
  const privatePath = options.projectPrivateConfigPath
  const privateDestPath = path.join(outputRoot, 'project.private.config.json')
  const shouldCopyPrivate = privatePath
    ? await fs.pathExists(privatePath) && path.resolve(privatePath) !== path.resolve(privateDestPath)
    : false

  if (!shouldCopyBase && !shouldCopyPrivate) {
    return
  }

  await fs.ensureDir(outputRoot)
  if (shouldCopyBase) {
    await fs.copy(sourceBasePath, destBasePath)
  }
  if (shouldCopyPrivate && privatePath) {
    await fs.copy(privatePath, privateDestPath)
  }
}
