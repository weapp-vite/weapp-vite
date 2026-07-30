import type { HeadlessProjectDescriptor } from '../project/createProjectDescriptor'
import type { BrowserVirtualFiles } from './virtualFiles'
import {
  createProjectDescriptor,

} from '../project/createProjectDescriptor'
import {

  hasBrowserVirtualFile,
  readBrowserVirtualFile,
} from './virtualFiles'

function readJsonObject(files: BrowserVirtualFiles, filePath: string) {
  const content = readBrowserVirtualFile(files, filePath)
  if (!content) {
    return undefined
  }

  try {
    const value = JSON.parse(content)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, any>
      : undefined
  }
  catch {
    return undefined
  }
}

export interface CreateBrowserProjectOptions {
  appConfigPath?: string
  miniprogramRoot?: string
  miniprogramRootPath?: string
  projectPath?: string
}

export function createBrowserProject(
  files: BrowserVirtualFiles,
  options: CreateBrowserProjectOptions = {},
): HeadlessProjectDescriptor {
  const appConfigPath = options.appConfigPath ?? 'app.json'
  if (!hasBrowserVirtualFile(files, appConfigPath)) {
    throw new Error(`Missing built app.json for browser simulator project: ${appConfigPath}`)
  }

  const appConfig = readJsonObject(files, appConfigPath)
  if (!appConfig) {
    throw new Error(`Failed to read built app.json for browser simulator project: ${appConfigPath}`)
  }

  return createProjectDescriptor({
    appConfig,
    appConfigPath,
    artifactSource: {
      has: filePath => hasBrowserVirtualFile(files, filePath),
      readText: filePath => readBrowserVirtualFile(files, filePath),
    },
    miniprogramRoot: options.miniprogramRoot ?? '.',
    miniprogramRootPath: options.miniprogramRootPath ?? '/',
    projectPath: options.projectPath ?? 'browser://simulator',
    projectConfigFiles: [],
  })
}
