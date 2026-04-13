import { Buffer } from 'node:buffer'
import path from 'node:path'
import vscode from 'vscode'

import {
  APP_JSON_FILE_PATTERN,
  PACKAGE_JSON_FILE_PATTERN,
  VITE_CONFIG_FILE_PATTERN,
  WEAPP_VITE_CONFIG_PATTERN,
  WEAPP_VITE_SCRIPT_PATTERN,
} from './constants'
import {
  resolveCommandFromScripts,
} from './logic'
import {
  collectAppJsonPageRoutes,
  collectMissingPageRoutes,
  findRouteTextRange,
  getPageFileCandidatePaths,
  getPreferredPageFilePath,
  getRouteFromPageFilePath,
} from './navigation'

export function getPrimaryWorkspaceFolder() {
  const activeUri = vscode.window.activeTextEditor?.document.uri

  if (activeUri) {
    const matched = vscode.workspace.getWorkspaceFolder(activeUri)
    if (matched) {
      return matched
    }
  }

  const [workspaceFolder] = vscode.workspace.workspaceFolders ?? []
  return workspaceFolder
}

export function isPackageJsonDocument(document: any) {
  return PACKAGE_JSON_FILE_PATTERN.test(document.uri.path)
}

export function isAppJsonDocument(document: any) {
  return APP_JSON_FILE_PATTERN.test(document.uri.path)
}

export function isViteConfigDocument(document: any) {
  return VITE_CONFIG_FILE_PATTERN.test(document.fileName)
}

export function isVueDocument(document: any) {
  return document.languageId === 'vue'
}

async function pathExists(filePath: string) {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
    return true
  }
  catch {
    return false
  }
}

async function readJsonFile(filePath: string) {
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
    return JSON.parse(Buffer.from(bytes).toString('utf8'))
  }
  catch {
    return null
  }
}

async function readTextFile(filePath: string) {
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
    return Buffer.from(bytes).toString('utf8')
  }
  catch {
    return null
  }
}

async function getExistingProjectFile(filePaths: string[]) {
  for (const filePath of filePaths) {
    if (await pathExists(filePath)) {
      return filePath
    }
  }

  return null
}

async function getProjectAppJsonPath(workspaceFolder = getPrimaryWorkspaceFolder()) {
  if (!workspaceFolder) {
    return null
  }

  return getExistingProjectFile([
    path.join(workspaceFolder.uri.fsPath, 'src', 'app.json'),
    path.join(workspaceFolder.uri.fsPath, 'app.json'),
  ])
}

export async function getAppJsonPageRouteSuggestions(document: any) {
  if (!isAppJsonDocument(document)) {
    return []
  }

  const appJsonDir = path.dirname(document.uri.fsPath)
  const patterns = [
    '**/*.vue',
    '**/*.ts',
    '**/*.js',
    '**/*.wxml',
  ]
  const files = await Promise.all(patterns.map(async (pattern) => {
    return vscode.workspace.findFiles(new vscode.RelativePattern(appJsonDir, pattern))
  }))
  const routes = new Set<string>()

  for (const group of files) {
    for (const file of group) {
      const relativePath = path.relative(appJsonDir, file.fsPath)
      const route = getRouteFromPageFilePath(relativePath)

      if (!route) {
        continue
      }

      if (route === 'app' || route.endsWith('/app')) {
        continue
      }

      routes.add(route)
    }
  }

  return [...routes].sort()
}

export function getEditor(documentOrEditor: any) {
  if (!documentOrEditor) {
    return null
  }

  if ('document' in documentOrEditor) {
    return documentOrEditor
  }

  const activeEditor = vscode.window.activeTextEditor

  if (activeEditor?.document === documentOrEditor) {
    return activeEditor
  }

  return null
}

function getPackageManager(packageJson: Record<string, any>) {
  const packageManager = packageJson?.packageManager

  if (typeof packageManager === 'string') {
    if (packageManager.startsWith('yarn@')) {
      return 'yarn'
    }

    if (packageManager.startsWith('npm@')) {
      return 'npm'
    }
  }

  return 'pnpm'
}

export async function getProjectContext(workspaceFolder = getPrimaryWorkspaceFolder()) {
  if (!workspaceFolder) {
    return null
  }

  const folderPath = workspaceFolder.uri.fsPath
  const packageJsonPath = path.join(folderPath, 'package.json')
  const viteConfigCandidates = [
    'vite.config.ts',
    'vite.config.mts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
  ].map(fileName => path.join(folderPath, fileName))
  const appJsonCandidates = [
    path.join(folderPath, 'src', 'app.json'),
    path.join(folderPath, 'app.json'),
  ]
  const packageJson = await readJsonFile(packageJsonPath)
  const packageSignals = []
  const fileSignals = []
  let hasWeappViteConfigSignal = false
  const dependencyBuckets = [
    packageJson?.dependencies,
    packageJson?.devDependencies,
    packageJson?.peerDependencies,
  ]
  const scripts = typeof packageJson?.scripts === 'object' && packageJson.scripts
    ? packageJson.scripts
    : {}

  for (const dependencies of dependencyBuckets) {
    if (dependencies && typeof dependencies === 'object') {
      if (dependencies['weapp-vite']) {
        packageSignals.push('依赖包含 weapp-vite')
      }
    }
  }

  for (const [scriptName, scriptValue] of Object.entries(scripts)) {
    if (typeof scriptValue === 'string' && WEAPP_VITE_SCRIPT_PATTERN.test(scriptValue)) {
      packageSignals.push(`脚本 ${scriptName} 调用了 weapp-vite CLI`)
    }
  }

  for (const viteConfigPath of viteConfigCandidates) {
    if (await pathExists(viteConfigPath)) {
      const viteConfigContent = await readTextFile(viteConfigPath)

      if (typeof viteConfigContent === 'string' && WEAPP_VITE_CONFIG_PATTERN.test(viteConfigContent)) {
        fileSignals.push(`${path.basename(viteConfigPath)} 引用了 weapp-vite`)
        hasWeappViteConfigSignal = true
      }

      break
    }
  }

  for (const appJsonPath of appJsonCandidates) {
    if (await pathExists(appJsonPath)) {
      fileSignals.push(`存在 ${path.relative(folderPath, appJsonPath)}`)
      break
    }
  }

  if (packageSignals.length === 0 && !hasWeappViteConfigSignal) {
    return null
  }

  return {
    workspaceFolder,
    packageJsonPath: await pathExists(packageJsonPath) ? packageJsonPath : null,
    packageJson,
    packageManager: getPackageManager(packageJson),
    scripts,
    packageSignals: [...new Set(packageSignals)],
    fileSignals: [...new Set(fileSignals)],
  }
}

export async function getProjectNavigationItems(workspaceFolder = getPrimaryWorkspaceFolder()) {
  const context = await getProjectContext(workspaceFolder)

  if (!context) {
    return []
  }

  const workspacePath = context.workspaceFolder.uri.fsPath
  const items = []
  const viteConfigPath = await getExistingProjectFile([
    'vite.config.ts',
    'vite.config.mts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
  ].map(fileName => path.join(workspacePath, fileName)))
  const appJsonPath = await getProjectAppJsonPath(context.workspaceFolder)

  if (context.packageJsonPath) {
    items.push({
      label: '$(package) package.json',
      description: '项目脚本与依赖',
      detail: path.relative(workspacePath, context.packageJsonPath),
      uri: vscode.Uri.file(context.packageJsonPath),
    })
  }

  if (viteConfigPath) {
    items.push({
      label: '$(settings-gear) vite.config',
      description: 'weapp-vite 配置入口',
      detail: path.relative(workspacePath, viteConfigPath),
      uri: vscode.Uri.file(viteConfigPath),
    })
  }

  if (appJsonPath) {
    items.push({
      label: '$(json) app.json',
      description: '小程序全局配置',
      detail: path.relative(workspacePath, appJsonPath),
      uri: vscode.Uri.file(appJsonPath),
    })

    const appJson = await readJsonFile(appJsonPath)
    const appJsonDir = path.dirname(appJsonPath)

    for (const route of collectAppJsonPageRoutes(appJson ?? {})) {
      const pageFilePath = await getExistingProjectFile(
        getPageFileCandidatePaths(route).map(candidate => path.join(appJsonDir, candidate)),
      )

      if (!pageFilePath) {
        continue
      }

      items.push({
        label: `$(file-submodule) ${route}`,
        description: '页面文件',
        detail: path.relative(workspacePath, pageFilePath),
        uri: vscode.Uri.file(pageFilePath),
      })
    }
  }

  return items
}

export async function getMissingAppJsonPageRoutes(document: any) {
  if (!isAppJsonDocument(document)) {
    return []
  }

  let appJson

  try {
    appJson = JSON.parse(document.getText())
  }
  catch {
    return []
  }

  const appJsonDir = path.dirname(document.uri.fsPath)

  return collectMissingPageRoutes(appJson, async (route) => {
    const candidatePaths = getPageFileCandidatePaths(route).map(candidate => path.join(appJsonDir, candidate))

    return Boolean(await getExistingProjectFile(candidatePaths))
  })
}

export async function getAppJsonRouteFileTarget(document: any, route: string) {
  if (!isAppJsonDocument(document)) {
    return null
  }

  const relativePath = getPreferredPageFilePath(route)

  if (!relativePath) {
    return null
  }

  return path.join(path.dirname(document.uri.fsPath), relativePath)
}

export async function resolveCurrentPageRoute(document = vscode.window.activeTextEditor?.document) {
  if (!document?.uri?.fsPath) {
    return null
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri) ?? getPrimaryWorkspaceFolder()
  const appJsonPath = await getProjectAppJsonPath(workspaceFolder)

  if (!appJsonPath) {
    return null
  }

  const relativePath = path.relative(path.dirname(appJsonPath), document.uri.fsPath)
  const route = getRouteFromPageFilePath(relativePath)

  if (!route) {
    return null
  }

  const appJson = await readJsonFile(appJsonPath)
  const routes = collectAppJsonPageRoutes(appJson ?? {})

  if (!routes.includes(route)) {
    return null
  }

  return {
    appJsonPath,
    route,
    workspaceFolder,
  }
}

export async function getCurrentPageRouteLocation(document = vscode.window.activeTextEditor?.document) {
  const resolved = await resolveCurrentPageRoute(document)

  if (!resolved) {
    return null
  }

  const appJsonText = await readTextFile(resolved.appJsonPath)

  if (typeof appJsonText !== 'string') {
    return null
  }

  const range = findRouteTextRange(appJsonText, resolved.route)

  if (!range) {
    return null
  }

  return {
    ...resolved,
    range,
  }
}

export function resolveCommand(
  context: { scripts: Record<string, string>, packageManager: string },
  commandDefinition: { id: string, scriptCandidates: string[], fallbackCommand: string },
  preferWvAlias = true,
) {
  return resolveCommandFromScripts(
    context.scripts,
    context.packageManager,
    commandDefinition,
    preferWvAlias,
  )
}
