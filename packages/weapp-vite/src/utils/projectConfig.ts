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
