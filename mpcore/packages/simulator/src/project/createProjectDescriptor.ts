import type { HeadlessRouteRecord } from './resolveRoutes'
import { resolveRoutesFromAppConfig } from './resolveRoutes'

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

export interface CreateProjectDescriptorOptions {
  appConfig: Record<string, any>
  appConfigPath: string
  miniprogramRoot: string
  miniprogramRootPath: string
  projectPath: string
  projectConfigFiles?: HeadlessProjectConfigFile[]
}

export function createProjectDescriptor(options: CreateProjectDescriptorOptions): HeadlessProjectDescriptor {
  return {
    appConfig: options.appConfig,
    appConfigPath: options.appConfigPath,
    miniprogramRoot: options.miniprogramRoot,
    miniprogramRootPath: options.miniprogramRootPath,
    projectPath: options.projectPath,
    projectConfigFiles: options.projectConfigFiles ?? [],
    routes: resolveRoutesFromAppConfig(options.appConfig),
  }
}
