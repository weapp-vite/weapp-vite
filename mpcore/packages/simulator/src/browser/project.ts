import type { HeadlessProjectDescriptor } from '../project/createProjectDescriptor'
import type { HeadlessPluginDescriptor } from '../project/plugins'
import type { BrowserVirtualFiles } from './virtualFiles'
import {
  createProjectDescriptor,

} from '../project/createProjectDescriptor'
import { createPluginVirtualRoot } from '../project/plugins'
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
  plugins?: HeadlessPluginDescriptor[]
  projectPath?: string
}

function resolveBrowserPlugins(files: BrowserVirtualFiles, appConfig: Record<string, any>) {
  const configuredPlugins = appConfig.plugins
  if (!configuredPlugins || typeof configuredPlugins !== 'object' || Array.isArray(configuredPlugins)) {
    return []
  }
  const plugins: HeadlessPluginDescriptor[] = []
  for (const [alias, definition] of Object.entries(configuredPlugins)) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      continue
    }
    const provider = (definition as Record<string, any>).provider
    const version = (definition as Record<string, any>).version
    const virtualRoot = createPluginVirtualRoot(alias)
    const config = readJsonObject(files, `${virtualRoot}/plugin.json`)
    if (typeof provider !== 'string' || !provider || version !== 'dev' || !config) {
      continue
    }
    plugins.push({
      alias,
      config,
      provider,
      rootPath: virtualRoot,
      virtualRoot,
    })
  }
  return plugins
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

  const plugins = options.plugins ?? resolveBrowserPlugins(files, appConfig)
  return createProjectDescriptor({
    appConfig,
    appConfigPath,
    artifactSource: {
      has: filePath => hasBrowserVirtualFile(files, filePath),
      readText: filePath => readBrowserVirtualFile(files, filePath),
    },
    miniprogramRoot: options.miniprogramRoot ?? '.',
    miniprogramRootPath: options.miniprogramRootPath ?? '/',
    plugins,
    projectPath: options.projectPath ?? 'browser://simulator',
    projectConfigFiles: [],
  })
}
