import type { ArtifactSource } from '../kernel'
import type { HeadlessProjectDescriptor } from './createProjectDescriptor'
import path from 'node:path'
import { createFileSystemArtifactSource } from '../kernel'
import { createProjectDescriptor } from './createProjectDescriptor'

export interface CreateArtifactProjectOptions {
  appConfigPath?: string
  artifactSource?: ArtifactSource
  miniprogramRootPath: string
  projectPath?: string
}

export function createArtifactProject(options: CreateArtifactProjectOptions): HeadlessProjectDescriptor {
  const artifactSource = options.artifactSource ?? createFileSystemArtifactSource()
  const miniprogramRootPath = path.resolve(options.miniprogramRootPath)
  const appConfigPath = path.resolve(miniprogramRootPath, options.appConfigPath ?? 'app.json')
  const appConfigSource = artifactSource.readText(appConfigPath)
  if (appConfigSource == null) {
    throw new Error(`Missing built app.json for headless runtime artifact: ${appConfigPath}`)
  }

  let appConfig: Record<string, any>
  try {
    const parsed = JSON.parse(appConfigSource)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new TypeError('app.json must contain an object.')
    }
    appConfig = parsed
  }
  catch (error) {
    throw new Error(`Failed to read built app.json for headless runtime artifact: ${appConfigPath}`, {
      cause: error,
    })
  }

  return createProjectDescriptor({
    appConfig,
    appConfigPath,
    artifactSource,
    miniprogramRoot: '.',
    miniprogramRootPath,
    projectConfigFiles: [],
    projectPath: path.resolve(options.projectPath ?? miniprogramRootPath),
  })
}
