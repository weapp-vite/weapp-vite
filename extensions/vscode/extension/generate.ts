import { Buffer } from 'node:buffer'
import path from 'node:path'
import * as vscode from 'vscode'

import {
  getComponentVueTemplate,
  getPageVueTemplate,
} from './content'
import {
  getRouteFromPageFilePath,
} from './navigation'
import {
  readWeappGenerateConfigSnapshot,
} from './projectConfig'
import {
  findNearestWeappViteProjectWorkspaceFolder,
  getAppJsonDocumentUri,
  getAppJsonTextWithAddedSpecificRoute,
  getPrimaryWorkspaceFolder,
  getProjectAppJsonPath,
  getProjectContext,
  getProjectViteConfigPath,
} from './workspace'

export type BuiltInGenerateType = 'component' | 'page'

const DEFAULT_GENERATE_DIRS: Record<BuiltInGenerateType, string> = {
  page: 'pages',
  component: 'components',
}

const DEFAULT_GENERATE_FILENAMES: Record<BuiltInGenerateType, string> = {
  page: 'index',
  component: 'index',
}

interface ResolvedGenerateDefaults {
  filenames: Partial<Record<BuiltInGenerateType, string>>
  dirs: Partial<Record<BuiltInGenerateType, string>>
  srcRoot?: string
}

function normalizeGenerateInput(input: string) {
  const normalized = input.trim().replace(/\\/gu, '/').replace(/^\/+|\/+$/gu, '')

  if (!normalized) {
    return null
  }

  const segments = normalized.split('/').filter(Boolean)

  if (segments.length === 0 || segments.some(segment => segment === '.' || segment === '..')) {
    return null
  }

  return segments.join('/')
}

function getDefaultGenerateBaseDir(projectPath: string, appJsonPath: string | null, type: BuiltInGenerateType) {
  const projectSourceRoot = appJsonPath ? path.dirname(appJsonPath) : projectPath
  return path.join(projectSourceRoot, DEFAULT_GENERATE_DIRS[type])
}

function getPreferredGenerateBaseDir(
  projectPath: string,
  appJsonPath: string | null,
  type: BuiltInGenerateType,
  defaults?: ResolvedGenerateDefaults,
) {
  if (defaults?.dirs[type]) {
    return path.join(projectPath, defaults.dirs[type]!)
  }

  if (!appJsonPath && defaults?.srcRoot) {
    return path.join(projectPath, defaults.srcRoot, DEFAULT_GENERATE_DIRS[type])
  }

  return getDefaultGenerateBaseDir(projectPath, appJsonPath, type)
}

export function resolveGenerateTargetPath(
  projectPath: string,
  appJsonPath: string | null,
  type: BuiltInGenerateType,
  inputPath: string,
  targetDirectory?: string | null,
  defaults?: ResolvedGenerateDefaults,
) {
  const normalizedInput = normalizeGenerateInput(inputPath)

  if (!normalizedInput) {
    return null
  }

  const baseDir = targetDirectory && targetDirectory.trim()
    ? targetDirectory
    : getPreferredGenerateBaseDir(projectPath, appJsonPath, type, defaults)
  const fileName = defaults?.filenames[type] ?? DEFAULT_GENERATE_FILENAMES[type]

  return path.join(baseDir, normalizedInput, `${fileName}.vue`)
}

async function getResolvedGenerateDefaults(context: { workspaceFolder: any }) {
  const viteConfigPath = await getProjectViteConfigPath(context.workspaceFolder)

  if (!viteConfigPath) {
    return {
      dirs: {},
      filenames: {},
    } satisfies ResolvedGenerateDefaults
  }

  try {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(viteConfigPath))
    const snapshot = readWeappGenerateConfigSnapshot(document.getText())

    return snapshot ?? {
      dirs: {},
      filenames: {},
    }
  }
  catch {
    return {
      dirs: {},
      filenames: {},
    } satisfies ResolvedGenerateDefaults
  }
}

async function resolveResourceDirectory(resourceUri?: any) {
  const resourcePath = typeof resourceUri?.fsPath === 'string' ? resourceUri.fsPath : null

  if (!resourcePath) {
    return null
  }

  try {
    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(resourcePath))

    if (typeof vscode.FileType?.Directory === 'number' && (stat.type & vscode.FileType.Directory) === vscode.FileType.Directory) {
      return resourcePath
    }
  }
  catch {
  }

  return path.dirname(resourcePath)
}

async function ensureGenerateProjectContext(resourceUri?: any) {
  const resourcePath = typeof resourceUri?.fsPath === 'string' ? resourceUri.fsPath : null
  const lookupPath = resourcePath
    ? await resolveResourceDirectory(resourceUri) ?? path.dirname(resourcePath)
    : null
  const workspaceFolder = lookupPath
    ? await findNearestWeappViteProjectWorkspaceFolder(lookupPath)
    : getPrimaryWorkspaceFolder()

  if (!workspaceFolder) {
    void vscode.window.showWarningMessage('weapp-vite: 当前目录未识别为 weapp-vite 项目。')
    return null
  }

  const context = await getProjectContext(workspaceFolder)

  if (!context) {
    void vscode.window.showWarningMessage('weapp-vite: 当前目录未识别为 weapp-vite 项目。')
    return null
  }

  return {
    appJsonPath: await getProjectAppJsonPath(workspaceFolder),
    context,
  }
}

function getGenerateTemplate(type: BuiltInGenerateType, targetPath: string, appJsonPath: string | null, inputPath: string) {
  if (type === 'component') {
    return getComponentVueTemplate(inputPath)
  }

  if (appJsonPath) {
    const relativePath = path.relative(path.dirname(appJsonPath), targetPath)

    if (!relativePath.startsWith('..')) {
      const route = getRouteFromPageFilePath(relativePath)

      if (route) {
        return getPageVueTemplate(route)
      }
    }
  }

  return getPageVueTemplate(inputPath)
}

async function writeGeneratedVueFile(
  state: any,
  type: BuiltInGenerateType,
  targetPath: string,
  workspacePath: string,
  appJsonPath: string | null,
  inputPath: string,
) {
  const relativeTargetPath = path.relative(workspacePath, targetPath)

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(targetPath))
    const existedDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath))
    await vscode.window.showTextDocument(existedDocument, { preview: false })
    void vscode.window.showInformationMessage(`weapp-vite: ${type === 'page' ? '页面' : '组件'}文件已存在 ${relativeTargetPath}`)
    return
  }
  catch {
  }

  await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(targetPath)))
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(targetPath),
    Buffer.from(getGenerateTemplate(type, targetPath, appJsonPath, inputPath), 'utf8'),
  )

  const createdDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath))
  await vscode.window.showTextDocument(createdDocument, { preview: false })

  const label = type === 'page' ? '页面' : '组件'
  state.getOutputChannel().appendLine(`[generate] ${label} ${targetPath}`)
  void vscode.window.showInformationMessage(`weapp-vite: 已创建${label} ${relativeTargetPath}`)
}

export async function createMissingPageFile(
  state: any,
  route: string,
  targetPath: string,
  workspacePath: string,
) {
  const relativeTargetPath = path.relative(workspacePath, targetPath)

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(targetPath))
    return false
  }
  catch {
  }

  await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(targetPath)))
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(targetPath),
    Buffer.from(getPageVueTemplate(route), 'utf8'),
  )
  state.getOutputChannel().appendLine(`[generate] 页面 ${targetPath}`)
  return relativeTargetPath
}

async function maybeRegisterGeneratedPage(state: any, appJsonPath: string | null, targetPath: string) {
  if (!appJsonPath) {
    return
  }

  const relativePath = path.relative(path.dirname(appJsonPath), targetPath)
  const route = getRouteFromPageFilePath(relativePath)

  if (!route) {
    return
  }

  const action = await vscode.window.showInformationMessage(
    `weapp-vite: 已创建页面 ${route}，是否同时加入 app.json？`,
    '加入 app.json',
    '稍后',
  )

  if (action !== '加入 app.json') {
    return
  }

  const result = await getAppJsonTextWithAddedSpecificRoute(appJsonPath, route)

  if (!result) {
    void vscode.window.showInformationMessage(`weapp-vite: 页面已存在于 app.json ${route}`)
    return
  }

  const document = await vscode.workspace.openTextDocument(getAppJsonDocumentUri(result.appJsonPath))
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length),
  )
  const edit = new vscode.WorkspaceEdit()

  edit.replace(document.uri, fullRange, result.nextText)
  await vscode.workspace.applyEdit(edit)
  await document.save()
  state.getOutputChannel().appendLine(`[route] add ${route}`)
  void vscode.window.showInformationMessage(`weapp-vite: 已将页面加入 app.json ${route}`)
}

async function promptGenerateInput(type: BuiltInGenerateType, baseDir: string, workspacePath: string) {
  const typeLabel = type === 'page' ? '页面' : '组件'

  return vscode.window.showInputBox({
    prompt: `输入要创建的${typeLabel}目录名`,
    placeHolder: type === 'page' ? '例如 home 或 user/profile' : '例如 card 或 user/avatar',
    value: '',
    valueSelection: [0, 0],
    validateInput(value) {
      return normalizeGenerateInput(value) ? null : `请输入有效的${typeLabel}相对路径`
    },
    title: `weapp-vite: 在 ${path.relative(workspacePath, baseDir) || '.'} 下创建${typeLabel}`,
  })
}

async function generateWithType(state: any, type: BuiltInGenerateType, resourceUri?: any) {
  const generateContext = await ensureGenerateProjectContext(resourceUri)

  if (!generateContext) {
    return
  }

  const {
    appJsonPath,
    context,
  } = generateContext
  const defaults = await getResolvedGenerateDefaults(context)
  const targetDirectory = await resolveResourceDirectory(resourceUri)
  const baseDir = targetDirectory ?? getPreferredGenerateBaseDir(context.workspaceFolder.uri.fsPath, appJsonPath, type, defaults)
  const inputPath = await promptGenerateInput(type, baseDir, context.workspaceFolder.uri.fsPath)

  if (!inputPath) {
    return
  }

  const targetPath = resolveGenerateTargetPath(
    context.workspaceFolder.uri.fsPath,
    appJsonPath,
    type,
    inputPath,
    baseDir,
    defaults,
  )

  if (!targetPath) {
    void vscode.window.showWarningMessage('weapp-vite: 生成路径无效。')
    return
  }

  await writeGeneratedVueFile(state, type, targetPath, context.workspaceFolder.uri.fsPath, appJsonPath, inputPath)

  if (type === 'page') {
    await maybeRegisterGeneratedPage(state, appJsonPath, targetPath)
  }
}

export async function showGeneratePicker(state: any, resourceUri?: any) {
  const items: Array<{
    description: string
    label: string
    type: BuiltInGenerateType
  }> = [
    {
      label: '$(file-submodule) 创建页面',
      description: '内置生成 .vue 页面骨架',
      type: 'page',
    },
    {
      label: '$(symbol-class) 创建组件',
      description: '内置生成 .vue 组件骨架',
      type: 'component',
    },
  ]
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '选择要生成的内置 weapp-vite 骨架',
  })

  if (!selected) {
    return
  }

  await generateWithType(state, selected.type, resourceUri)
}

export async function generatePageInExplorer(resourceUri: any, state: any) {
  await generateWithType(state, 'page', resourceUri)
}

export async function generateComponentInExplorer(resourceUri: any, state: any) {
  await generateWithType(state, 'component', resourceUri)
}
