import type { ArtifactSource } from '../kernel'
import type { HeadlessPluginDescriptor } from './plugins'
import type { HeadlessRouteRecord } from './resolveRoutes'
import { createFileSystemArtifactSource } from '../kernel'
import { resolveRoutesFromAppConfig } from './resolveRoutes'

export interface HeadlessProjectConfigFile {
  filePath: string
  value: Record<string, any>
}

export interface HeadlessProjectDescriptor {
  artifactSource: ArtifactSource
  appConfig: Record<string, any>
  appConfigPath: string
  miniprogramRoot: string
  miniprogramRootPath: string
  plugins: HeadlessPluginDescriptor[]
  projectPath: string
  projectConfigFiles: HeadlessProjectConfigFile[]
  routes: HeadlessRouteRecord[]
}

export interface CreateProjectDescriptorOptions {
  artifactSource?: ArtifactSource
  appConfig: Record<string, any>
  appConfigPath: string
  miniprogramRoot: string
  miniprogramRootPath: string
  plugins?: HeadlessPluginDescriptor[]
  projectPath: string
  projectConfigFiles?: HeadlessProjectConfigFile[]
}

export function createProjectDescriptor(options: CreateProjectDescriptorOptions): HeadlessProjectDescriptor {
  return {
    artifactSource: options.artifactSource ?? createFileSystemArtifactSource(),
    appConfig: options.appConfig,
    appConfigPath: options.appConfigPath,
    miniprogramRoot: options.miniprogramRoot,
    miniprogramRootPath: options.miniprogramRootPath,
    plugins: options.plugins ?? [],
    projectPath: options.projectPath,
    projectConfigFiles: options.projectConfigFiles ?? [],
    routes: resolveRoutesFromAppConfig(options.appConfig, options.plugins ?? []),
  }
}
