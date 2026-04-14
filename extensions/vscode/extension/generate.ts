import { Buffer } from 'node:buffer'
import path from 'node:path'
import vscode from 'vscode'

import {
  getComponentVueTemplate,
  getPageVueTemplate,
} from './content'
import {
  getRouteFromPageFilePath,
} from './navigation'
import {
  findNearestWeappViteProjectWorkspaceFolder,
  getPrimaryWorkspaceFolder,
  getProjectAppJsonPath,
  getProjectContext,
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

export function resolveGenerateTargetPath(
  projectPath: string,
  appJsonPath: string | null,
  type: BuiltInGenerateType,
  inputPath: string,
  targetDirectory?: string | null,
) {
  const normalizedInput = normalizeGenerateInput(inputPath)

  if (!normalizedInput) {
    return null
  }

  const baseDir = targetDirectory && targetDirectory.trim()
    ? targetDirectory
    : getDefaultGenerateBaseDir(projectPath, appJsonPath, type)

  return path.join(baseDir, normalizedInput, `${DEFAULT_GENERATE_FILENAMES[type]}.vue`)
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
  const targetDirectory = await resolveResourceDirectory(resourceUri)
  const baseDir = targetDirectory ?? getDefaultGenerateBaseDir(context.workspaceFolder.uri.fsPath, appJsonPath, type)
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
  )

  if (!targetPath) {
    void vscode.window.showWarningMessage('weapp-vite: 生成路径无效。')
    return
  }

  await writeGeneratedVueFile(state, type, targetPath, context.workspaceFolder.uri.fsPath, appJsonPath, inputPath)
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
