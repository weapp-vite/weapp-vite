import fs from 'node:fs'
import path from 'node:path'
import { normalize } from 'pathe'
import {
  resolveRoutesFromAppConfig,
  type HeadlessRouteRecord,
} from './resolveRoutes'

export interface HeadlessProjectConfigFile {
  filePath: string
  value: Record<string, any>
}

export interface HeadlessProjectDescriptor {
  appConfig: Record<string, any>
  appConfigPath: string
  miniprogramRoot: string
  miniprogramRootPath: string
  projectPath: string
  projectConfigFiles: HeadlessProjectConfigFile[]
  routes: HeadlessRouteRecord[]
}

function readJsonObject(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const value = JSON.parse(content)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, any>
      : undefined
  }
  catch {
    return undefined
  }
}

function resolveProjectConfigFiles(projectPath: string) {
  const entries: HeadlessProjectConfigFile[] = []
  for (const fileName of ['project.config.json', 'project.private.config.json']) {
    const filePath = path.resolve(projectPath, fileName)
    const value = readJsonObject(filePath)
    if (!value) {
      continue
    }
    entries.push({
      filePath,
      value,
    })
  }
  return entries
}

function resolveMiniprogramRoot(projectPath: string, configFiles: HeadlessProjectConfigFile[]) {
  for (const configFile of [...configFiles].reverse()) {
    const rawRoot = configFile.value.miniprogramRoot
    if (typeof rawRoot !== 'string' || !rawRoot.trim()) {
      continue
    }
    return rawRoot.trim()
  }

  throw new Error(
    `Failed to resolve miniprogramRoot for headless runtime project: ${projectPath}. `
    + 'Expected project.config.json or project.private.config.json to define miniprogramRoot.',
  )
}

function ensureFileExists(filePath: string, label: string) {
  if (fs.existsSync(filePath)) {
    return
  }
  throw new Error(`Missing ${label} for headless runtime project: ${normalize(filePath)}`)
}

function loadAppConfig(appConfigPath: string) {
  const appConfig = readJsonObject(appConfigPath)
  if (!appConfig) {
    throw new Error(`Failed to read built app.json for headless runtime project: ${normalize(appConfigPath)}`)
  }
  return appConfig
}

export function loadProject(projectPath: string): HeadlessProjectDescriptor {
  const normalizedProjectPath = path.resolve(projectPath)
  const projectConfigFiles = resolveProjectConfigFiles(normalizedProjectPath)

  if (projectConfigFiles.length === 0) {
    throw new Error(
      `Missing project config for headless runtime project: ${normalizedProjectPath}. `
      + 'Expected project.config.json or project.private.config.json.',
    )
  }

  const miniprogramRoot = resolveMiniprogramRoot(normalizedProjectPath, projectConfigFiles)
  const miniprogramRootPath = path.resolve(normalizedProjectPath, miniprogramRoot)
  ensureFileExists(miniprogramRootPath, 'miniprogramRoot directory')

  const appConfigPath = path.resolve(miniprogramRootPath, 'app.json')
  ensureFileExists(appConfigPath, 'built app.json')

  const appConfig = loadAppConfig(appConfigPath)
  const routes = resolveRoutesFromAppConfig(appConfig)

  return {
    appConfig,
    appConfigPath,
    miniprogramRoot,
    miniprogramRootPath,
    projectPath: normalizedProjectPath,
    projectConfigFiles,
    routes,
  }
}
