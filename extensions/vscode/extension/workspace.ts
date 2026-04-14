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
  applyPageRouteToAppJson,
  movePageRouteInAppJson,
  removePageRouteFromAppJson,
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

function normalizeRoute(route: string) {
  return route.trim().replace(/^\/+|\/+$/g, '')
}

function getSubpackageEntries(appJson: Record<string, any>) {
  return [
    ...(Array.isArray(appJson?.subPackages) ? appJson.subPackages : []),
    ...(Array.isArray(appJson?.subpackages) ? appJson.subpackages : []),
  ].filter(item => item && typeof item === 'object')
}

export interface WeappPageTreeEntry {
  pageFilePath: string | null
  route: string
}

export interface WeappPagesTreeSnapshot {
  appJsonPath: string
  subpackages: Array<{
    pages: WeappPageTreeEntry[]
    root: string
  }>
  topLevelPages: WeappPageTreeEntry[]
  unregisteredPages: WeappPageTreeEntry[]
  workspaceFolder: any
}

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

export async function getProjectViteConfigPath(workspaceFolder = getPrimaryWorkspaceFolder()) {
  if (!workspaceFolder) {
    return null
  }

  return getExistingProjectFile([
    'vite.config.ts',
    'vite.config.mts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
  ].map(fileName => path.join(workspaceFolder.uri.fsPath, fileName)))
}

export async function getWeappViteProjectSignals(folderPath: string, packageJson?: Record<string, any> | null) {
  const resolvedPackageJson = packageJson ?? await readJsonFile(path.join(folderPath, 'package.json'))
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
  const packageSignals = []
  const fileSignals = []
  let hasWeappViteConfigSignal = false
  let hasAppJsonSignal = false
  const dependencyBuckets = [
    resolvedPackageJson?.dependencies,
    resolvedPackageJson?.devDependencies,
    resolvedPackageJson?.peerDependencies,
  ]
  const scripts = typeof resolvedPackageJson?.scripts === 'object' && resolvedPackageJson.scripts
    ? resolvedPackageJson.scripts
    : {}

  for (const dependencies of dependencyBuckets) {
    if (dependencies && typeof dependencies === 'object' && dependencies['weapp-vite']) {
      packageSignals.push('依赖包含 weapp-vite')
    }
  }

  for (const [scriptName, scriptValue] of Object.entries(scripts)) {
    if (typeof scriptValue === 'string' && WEAPP_VITE_SCRIPT_PATTERN.test(scriptValue)) {
      packageSignals.push(`脚本 ${scriptName} 调用了 weapp-vite CLI`)
    }
  }

  for (const viteConfigPath of viteConfigCandidates) {
    if (!(await pathExists(viteConfigPath))) {
      continue
    }

    const viteConfigContent = await readTextFile(viteConfigPath)

    if (typeof viteConfigContent === 'string' && WEAPP_VITE_CONFIG_PATTERN.test(viteConfigContent)) {
      fileSignals.push(`${path.basename(viteConfigPath)} 引用了 weapp-vite`)
      hasWeappViteConfigSignal = true
    }

    break
  }

  for (const appJsonPath of appJsonCandidates) {
    if (await pathExists(appJsonPath)) {
      fileSignals.push(`存在 ${path.relative(folderPath, appJsonPath)}`)
      hasAppJsonSignal = true
      break
    }
  }

  return {
    packageSignals: [...new Set(packageSignals)],
    fileSignals: [...new Set(fileSignals)],
    hasAppJsonSignal,
    hasPackageSignal: packageSignals.length > 0,
    hasWeappViteConfigSignal,
    isConfirmedWeappViteProject: packageSignals.length > 0 && (hasWeappViteConfigSignal || hasAppJsonSignal),
    packageJson: resolvedPackageJson,
    scripts,
  }
}

export async function getProjectAppJsonPath(workspaceFolder = getPrimaryWorkspaceFolder()) {
  if (!workspaceFolder) {
    return null
  }

  return getExistingProjectFile([
    path.join(workspaceFolder.uri.fsPath, 'src', 'app.json'),
    path.join(workspaceFolder.uri.fsPath, 'app.json'),
  ])
}

export function getAppJsonDocumentUri(appJsonPath: string) {
  return vscode.Uri.file(appJsonPath)
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
  const packageJson = await readJsonFile(packageJsonPath)
  const projectSignals = await getWeappViteProjectSignals(folderPath, packageJson)

  if (!projectSignals.hasPackageSignal && !projectSignals.hasWeappViteConfigSignal) {
    return null
  }

  return {
    workspaceFolder,
    packageJsonPath: await pathExists(packageJsonPath) ? packageJsonPath : null,
    packageJson: projectSignals.packageJson,
    packageManager: getPackageManager(packageJson),
    scripts: projectSignals.scripts,
    packageSignals: projectSignals.packageSignals,
    fileSignals: projectSignals.fileSignals,
  }
}

export async function findNearestWeappViteProjectWorkspaceFolder(startPath: string) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(startPath)) ?? getPrimaryWorkspaceFolder()

  if (!workspaceFolder) {
    return null
  }

  const workspaceRoot = workspaceFolder.uri.fsPath
  let currentPath = startPath

  while (currentPath.startsWith(workspaceRoot)) {
    const signals = await getWeappViteProjectSignals(currentPath)

    if (signals.isConfirmedWeappViteProject) {
      return {
        ...workspaceFolder,
        name: path.basename(currentPath),
        uri: vscode.Uri.file(currentPath),
      }
    }

    if (currentPath === workspaceRoot) {
      break
    }

    const parentPath = path.dirname(currentPath)

    if (parentPath === currentPath) {
      break
    }

    currentPath = parentPath
  }

  return null
}

export async function getProjectNavigationItems(workspaceFolder = getPrimaryWorkspaceFolder()) {
  const context = await getProjectContext(workspaceFolder)

  if (!context) {
    return []
  }

  const workspacePath = context.workspaceFolder.uri.fsPath
  const items = []
  const viteConfigPath = await getProjectViteConfigPath(context.workspaceFolder)
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

export async function getWeappPagesTreeSnapshot(workspaceFolder = getPrimaryWorkspaceFolder()): Promise<WeappPagesTreeSnapshot | null> {
  const context = await getProjectContext(workspaceFolder)

  if (!context) {
    return null
  }

  const appJsonPath = await getProjectAppJsonPath(context.workspaceFolder)

  if (!appJsonPath) {
    return null
  }

  const appJson = await readJsonFile(appJsonPath)

  if (!appJson || typeof appJson !== 'object') {
    return null
  }

  const appJsonDir = path.dirname(appJsonPath)
  const resolvePageEntry = async (route: string): Promise<WeappPageTreeEntry> => {
    const pageFilePath = await getExistingProjectFile(
      getPageFileCandidatePaths(route).map(candidate => path.join(appJsonDir, candidate)),
    )

    return {
      pageFilePath,
      route,
    }
  }

  const topLevelPages = await Promise.all(
    (Array.isArray(appJson.pages) ? appJson.pages : [])
      .filter((route): route is string => typeof route === 'string')
      .map(route => resolvePageEntry(normalizeRoute(route)))
      .filter(Boolean),
  )
  const subpackages = await Promise.all(getSubpackageEntries(appJson).map(async (subPackage) => {
    const root = normalizeRoute(typeof subPackage.root === 'string' ? subPackage.root : '')
    const pages = await Promise.all(
      (Array.isArray(subPackage.pages) ? subPackage.pages : [])
        .filter((page): page is string => typeof page === 'string')
        .map(page => resolvePageEntry([root, normalizeRoute(page)].filter(Boolean).join('/'))),
    )

    return {
      root,
      pages,
    }
  }))

  const patterns = [
    '**/*.vue',
    '**/*.ts',
    '**/*.js',
    '**/*.wxml',
  ]
  const pageFiles = await Promise.all(patterns.map(async (pattern) => {
    return vscode.workspace.findFiles(new vscode.RelativePattern(appJsonDir, pattern))
  }))
  const declaredRoutes = new Set(collectAppJsonPageRoutes(appJson))
  const unregisteredRoutes = new Set<string>()

  for (const files of pageFiles) {
    for (const file of files) {
      const relativePath = path.relative(appJsonDir, file.fsPath)
      const route = getRouteFromPageFilePath(relativePath)

      if (!route || route === 'app' || route.endsWith('/app') || declaredRoutes.has(route)) {
        continue
      }

      unregisteredRoutes.add(route)
    }
  }

  const unregisteredPages = await Promise.all(
    [...unregisteredRoutes].sort().map(route => resolvePageEntry(route)),
  )

  return {
    appJsonPath,
    subpackages: subpackages
      .filter(item => item.root || item.pages.length > 0)
      .sort((left, right) => left.root.localeCompare(right.root)),
    topLevelPages,
    unregisteredPages,
    workspaceFolder: context.workspaceFolder,
  }
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

export function getAppJsonRouteFileTargetFromPath(appJsonPath: string, route: string) {
  const relativePath = getPreferredPageFilePath(route)

  if (!relativePath) {
    return null
  }

  return path.join(path.dirname(appJsonPath), relativePath)
}

export async function getAppJsonRouteFileStatus(document: any, route: string) {
  if (!isAppJsonDocument(document) || typeof route !== 'string' || !route.trim()) {
    return null
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri) ?? getPrimaryWorkspaceFolder()
  const appJsonDir = path.dirname(document.uri.fsPath)
  const candidatePaths = getPageFileCandidatePaths(route).map(candidate => path.join(appJsonDir, candidate))
  const pageFilePath = await getExistingProjectFile(candidatePaths)
  const workspacePath = workspaceFolder?.uri.fsPath ?? appJsonDir

  return {
    route,
    pageFilePath,
    candidatePaths,
    workspacePath,
  }
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

export async function getAppJsonRouteLocation(appJsonPath: string, route: string) {
  const appJsonText = await readTextFile(appJsonPath)

  if (typeof appJsonText !== 'string') {
    return null
  }

  const range = findRouteTextRange(appJsonText, route)

  if (!range) {
    return null
  }

  return {
    appJsonPath,
    range,
    route,
  }
}

export async function getCurrentPageRouteCandidate(document = vscode.window.activeTextEditor?.document) {
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
  const existingRoutes = collectAppJsonPageRoutes(appJson ?? {})

  return {
    appJson,
    appJsonPath,
    declared: existingRoutes.includes(route),
    route,
    workspaceFolder,
  }
}

export async function getAppJsonTextWithAddedRoute(document = vscode.window.activeTextEditor?.document) {
  const candidate = await getCurrentPageRouteCandidate(document)

  if (!candidate || !candidate.appJson || candidate.declared) {
    return null
  }

  const result = applyPageRouteToAppJson(candidate.appJson, candidate.route)

  if (!result.changed) {
    return null
  }

  return {
    ...candidate,
    nextText: `${JSON.stringify(result.appJson, null, 2)}\n`,
    packageLocation: result.packageLocation,
    packageRoot: result.packageRoot,
  }
}

export async function getAppJsonTextWithAddedSpecificRoute(appJsonPath: string, route: string) {
  const appJson = await readJsonFile(appJsonPath)

  if (!appJson || typeof route !== 'string' || !route.trim()) {
    return null
  }

  const normalizedRoute = normalizeRoute(route)
  const result = applyPageRouteToAppJson(appJson, normalizedRoute)

  if (!result.changed) {
    return null
  }

  return {
    appJsonPath,
    nextText: `${JSON.stringify(result.appJson, null, 2)}\n`,
    packageLocation: result.packageLocation,
    packageRoot: result.packageRoot,
    route: normalizedRoute,
  }
}

export async function getAppJsonTextWithAddedRoutes(appJsonPath: string, routes: string[]) {
  const appJson = await readJsonFile(appJsonPath)

  if (!appJson || !Array.isArray(routes) || routes.length === 0) {
    return null
  }

  let nextAppJson = appJson
  const addedRoutes: string[] = []

  for (const route of routes) {
    if (typeof route !== 'string' || !route.trim()) {
      continue
    }

    const normalizedRoute = normalizeRoute(route)
    const result = applyPageRouteToAppJson(nextAppJson, normalizedRoute)

    if (!result.changed) {
      continue
    }

    nextAppJson = result.appJson
    addedRoutes.push(normalizedRoute)
  }

  if (addedRoutes.length === 0) {
    return null
  }

  return {
    addedRoutes,
    appJsonPath,
    nextText: `${JSON.stringify(nextAppJson, null, 2)}\n`,
  }
}

export async function getAppJsonTextWithMovedRoute(appJsonPath: string, fromRoute: string, toRoute: string) {
  const appJson = await readJsonFile(appJsonPath)

  if (!appJson || typeof fromRoute !== 'string' || typeof toRoute !== 'string') {
    return null
  }

  const normalizedFromRoute = normalizeRoute(fromRoute)
  const normalizedToRoute = normalizeRoute(toRoute)

  if (!normalizedFromRoute || !normalizedToRoute || normalizedFromRoute === normalizedToRoute) {
    return null
  }

  const result = movePageRouteInAppJson(appJson, normalizedFromRoute, normalizedToRoute)

  if (!result.changed) {
    return null
  }

  return {
    appJsonPath,
    fromRoute: normalizedFromRoute,
    nextText: `${JSON.stringify(result.appJson, null, 2)}\n`,
    toRoute: normalizedToRoute,
  }
}

export async function getAppJsonTextWithRemovedRoute(appJsonPath: string, route: string) {
  const appJson = await readJsonFile(appJsonPath)

  if (!appJson || typeof route !== 'string' || !route.trim()) {
    return null
  }

  const normalizedRoute = normalizeRoute(route)
  const result = removePageRouteFromAppJson(appJson, normalizedRoute)

  if (!result.changed) {
    return null
  }

  return {
    appJsonPath,
    nextText: `${JSON.stringify(result.appJson, null, 2)}\n`,
    route: normalizedRoute,
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
