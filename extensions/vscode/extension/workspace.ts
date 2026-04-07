import { Buffer } from 'node:buffer'
import path from 'node:path'
import vscode from 'vscode'

import {
  PACKAGE_JSON_FILE_PATTERN,
  VITE_CONFIG_FILE_PATTERN,
  WEAPP_VITE_CONFIG_PATTERN,
  WEAPP_VITE_SCRIPT_PATTERN,
} from './constants'
import {
  resolveCommandFromScripts,
} from './logic'

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

      if (dependencies['create-weapp-vite']) {
        packageSignals.push('依赖包含 create-weapp-vite')
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
