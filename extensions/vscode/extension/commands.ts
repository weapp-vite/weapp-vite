import { Buffer } from 'node:buffer'
import vscode from 'vscode'

import {
  useWvAlias,
} from './config'
import {
  COMMAND_DEFINITIONS,
  OUTPUT_CHANNEL_NAME,
  TERMINAL_NAME,
} from './constants'
import {
  getDefineConfigTemplate,
  getDefinePageJsonTemplate,
  getDocItems,
  getJsonBlockSnippet,
  getPageVueTemplate,
} from './content'
import {
  applySuggestedScripts,
  getCurrentPageRunActionItems,
  getVuePageConfigState,
} from './logic'
import {
  getAppJsonRouteFileTarget,
  getAppJsonTextWithAddedRoute,
  getCurrentPageRouteCandidate,
  getCurrentPageRouteLocation,
  getEditor,
  getPrimaryWorkspaceFolder,
  getProjectContext,
  getProjectNavigationItems,
  isPackageJsonDocument,
  isViteConfigDocument,
  isVueDocument,
  resolveCommand,
  resolveCurrentPageRoute,
} from './workspace'

const TRAILING_FILE_SEGMENT_PATTERN = /\/[^/]+$/u

async function insertSnippetToActiveEditor(snippetText: string) {
  const editor = vscode.window.activeTextEditor

  if (!editor) {
    void vscode.window.showWarningMessage('weapp-vite: 当前没有可编辑的活动编辑器。')
    return
  }

  await editor.insertSnippet(new vscode.SnippetString(snippetText), editor.selection.active)
}

export async function insertJsonBlockTemplate() {
  const editor = vscode.window.activeTextEditor

  if (!editor || !isVueDocument(editor.document)) {
    void vscode.window.showWarningMessage('weapp-vite: 请先打开一个 .vue 文件后再插入 <json> 模板。')
    return
  }

  await insertSnippetToActiveEditor(getJsonBlockSnippet())
}

export async function insertDefineConfigTemplate() {
  const editor = vscode.window.activeTextEditor

  if (!editor || !isViteConfigDocument(editor.document)) {
    void vscode.window.showWarningMessage('weapp-vite: 请先打开一个 vite.config.* 文件后再插入模板。')
    return
  }

  const fullRange = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(editor.document.getText().length),
  )

  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, getDefineConfigTemplate())
  })
}

export async function insertDefinePageJsonTemplate() {
  const editor = vscode.window.activeTextEditor

  if (!editor || !isVueDocument(editor.document)) {
    void vscode.window.showWarningMessage('weapp-vite: 请先打开一个 .vue 文件后再插入 definePageJson 模板。')
    return
  }

  await insertSnippetToActiveEditor(getDefinePageJsonTemplate())
}

export async function insertCommonScripts(editorOrDocument: any, refreshPackageJsonDiagnostics: (document: any) => void) {
  const editor = getEditor(editorOrDocument ?? vscode.window.activeTextEditor)
  const document = editor?.document ?? editorOrDocument?.document ?? editorOrDocument

  if (!document || !isPackageJsonDocument(document)) {
    void vscode.window.showWarningMessage('weapp-vite: 请先打开 package.json 后再插入脚本。')
    return
  }

  let packageJson

  try {
    packageJson = JSON.parse(document.getText())
  }
  catch {
    void vscode.window.showWarningMessage('weapp-vite: 当前 package.json 无法解析，不能自动插入脚本。')
    return
  }

  const result = applySuggestedScripts(packageJson, useWvAlias())

  if (!result.changed) {
    void vscode.window.showInformationMessage('weapp-vite: package.json 已包含常用脚本。')
    return
  }

  const nextText = `${JSON.stringify(result.packageJson, null, 2)}\n`
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length),
  )

  if (editor && editor.document === document) {
    await editor.edit((editBuilder) => {
      editBuilder.replace(fullRange, nextText)
    })
  }
  else {
    const edit = new vscode.WorkspaceEdit()
    edit.replace(document.uri, fullRange, nextText)
    await vscode.workspace.applyEdit(edit)
  }

  refreshPackageJsonDiagnostics(document)
}

function getTerminal(context: any, state: any, terminalName = TERMINAL_NAME) {
  const cachedTerminal = state.terminalCache?.terminal

  if (cachedTerminal && state.terminalCache.workspacePath === context.workspaceFolder.uri.fsPath && cachedTerminal.exitStatus == null) {
    return cachedTerminal
  }

  const terminal = vscode.window.createTerminal({
    name: terminalName,
    cwd: context.workspaceFolder.uri.fsPath,
  })

  state.terminalCache = {
    terminal,
    workspacePath: context.workspaceFolder.uri.fsPath,
  }

  return terminal
}

async function ensureProjectContext(operationLabel: string) {
  const workspaceFolder = getPrimaryWorkspaceFolder()

  if (!workspaceFolder) {
    void vscode.window.showWarningMessage(`weapp-vite: 请先打开一个工作区后再${operationLabel}。`)
    return null
  }

  const context = await getProjectContext(workspaceFolder)

  if (context) {
    return context
  }

  void vscode.window.showWarningMessage('weapp-vite: 当前工作区未识别为 weapp-vite 项目。')
  return null
}

export async function runWorkspaceCommand(commandId: string, state: any) {
  const commandDefinition = COMMAND_DEFINITIONS[commandId]

  if (!commandDefinition) {
    return
  }

  const context = await ensureProjectContext(commandDefinition.label)

  if (!context) {
    return
  }

  const resolved = resolveCommand(context, commandDefinition, useWvAlias())
  const terminal = getTerminal(context, state, commandDefinition.terminalName ?? TERMINAL_NAME)
  const channel = state.getOutputChannel()

  channel.appendLine(`[run] ${commandDefinition.label}`)
  channel.appendLine(`[workspace] ${context.workspaceFolder.uri.fsPath}`)
  channel.appendLine(`[command] ${resolved.command}`)
  channel.appendLine(`[source] ${resolved.source}`)
  channel.appendLine('')

  terminal.show(true)
  terminal.sendText(resolved.command, true)
  void vscode.window.setStatusBarMessage(`weapp-vite: 已执行 ${commandDefinition.label}`, 3000)
}

export async function showProjectOverview(state: any) {
  const context = await ensureProjectContext('查看项目概览')

  if (!context) {
    return
  }

  const channel = state.getOutputChannel()
  const lines = [
    'weapp-vite 项目概览',
    `工作区: ${context.workspaceFolder.uri.fsPath}`,
    `包管理器: ${context.packageManager}`,
    `package.json: ${context.packageJsonPath ?? '未找到'}`,
    `识别信号: ${[...context.packageSignals, ...context.fileSignals].join(' / ') || '无'}`,
    `可用脚本: ${Object.keys(context.scripts).length > 0 ? Object.keys(context.scripts).sort().join(', ') : '无'}`,
  ]

  channel.clear()
  channel.appendLine(lines.join('\n'))
  channel.show(true)
}

export async function openDocumentation() {
  const selected = await vscode.window.showQuickPick(getDocItems(), {
    placeHolder: '选择要打开的 weapp-vite 文档',
  })

  if (!selected) {
    return
  }

  await vscode.env.openExternal(vscode.Uri.parse(selected.url))
}

export async function openProjectFile(state: any) {
  const context = await ensureProjectContext('打开项目文件')

  if (!context) {
    return
  }

  const items = await getProjectNavigationItems(context.workspaceFolder)

  if (items.length === 0) {
    void vscode.window.showWarningMessage('weapp-vite: 当前工作区还没有可导航的关键文件。')
    return
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '选择要打开的 weapp-vite 关键文件或页面',
    matchOnDescription: true,
    matchOnDetail: true,
  })

  if (!selected) {
    return
  }

  state.getOutputChannel().appendLine(`[open] ${selected.detail}`)

  const document = await vscode.workspace.openTextDocument(selected.uri)
  await vscode.window.showTextDocument(document, { preview: false })
}

async function ensureCurrentPageRoute(operationLabel: string) {
  const resolved = await resolveCurrentPageRoute()

  if (resolved) {
    return resolved
  }

  void vscode.window.showWarningMessage(`weapp-vite: 当前文件无法识别为已声明页面，不能${operationLabel}。`)
  return null
}

export async function copyCurrentPageRoute(state: any) {
  const resolved = await ensureCurrentPageRoute('复制页面路由')

  if (!resolved) {
    return
  }

  await vscode.env.clipboard.writeText(resolved.route)
  state.getOutputChannel().appendLine(`[route] copied ${resolved.route}`)
  void vscode.window.showInformationMessage(`weapp-vite: 已复制页面路由 ${resolved.route}`)
}

export async function revealCurrentPageInAppJson(state: any) {
  const location = await getCurrentPageRouteLocation()

  if (!location) {
    void vscode.window.showWarningMessage('weapp-vite: 当前文件无法定位到 app.json 中的页面声明。')
    return
  }

  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(location.appJsonPath))
  const selection = new vscode.Range(
    document.positionAt(location.range.start + 1),
    document.positionAt(location.range.end - 1),
  )

  state.getOutputChannel().appendLine(`[route] reveal ${location.route}`)
  await vscode.window.showTextDocument(document, {
    preview: false,
    selection,
  })
}

export async function createPageFromRoute(editorOrDocument: any, route?: string) {
  const editor = getEditor(editorOrDocument ?? vscode.window.activeTextEditor)
  const document = editor?.document ?? editorOrDocument?.document ?? editorOrDocument

  if (!document || !isAppJsonDocument(document) || typeof route !== 'string' || !route.trim()) {
    void vscode.window.showWarningMessage('weapp-vite: 请在 app.json 的页面路由上执行创建页面。')
    return
  }

  const targetPath = await getAppJsonRouteFileTarget(document, route)

  if (!targetPath) {
    void vscode.window.showWarningMessage('weapp-vite: 无法解析要创建的页面文件路径。')
    return
  }

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(targetPath))
    void vscode.window.showInformationMessage(`weapp-vite: 页面文件已存在 ${route}`)
    return
  }
  catch {
  }

  const targetUri = vscode.Uri.file(targetPath)
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetPath.replace(TRAILING_FILE_SEGMENT_PATTERN, '')))
  await vscode.workspace.fs.writeFile(targetUri, Buffer.from(getPageVueTemplate(route), 'utf8'))

  const createdDocument = await vscode.workspace.openTextDocument(targetUri)
  await vscode.window.showTextDocument(createdDocument, { preview: false })
  void vscode.window.showInformationMessage(`weapp-vite: 已创建页面 ${route}`)
}

export async function addCurrentPageToAppJson(state: any) {
  const result = await getAppJsonTextWithAddedRoute()

  if (!result) {
    const candidate = await getCurrentPageRouteCandidate()

    if (!candidate) {
      void vscode.window.showWarningMessage('weapp-vite: 当前文件无法识别为可加入 app.json 的页面。')
      return
    }

    if (candidate.declared) {
      void vscode.window.showInformationMessage(`weapp-vite: 页面已存在于 app.json 中 ${candidate.route}`)
      return
    }

    void vscode.window.showWarningMessage('weapp-vite: 当前页面无法写入 app.json。')
    return
  }

  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(result.appJsonPath))
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length),
  )
  const edit = new vscode.WorkspaceEdit()

  edit.replace(document.uri, fullRange, result.nextText)
  await vscode.workspace.applyEdit(edit)
  await document.save()
  state.getOutputChannel().appendLine(`[route] add ${result.route}`)
  void vscode.window.showInformationMessage(`weapp-vite: 已将页面加入 app.json ${result.route}`)
  await vscode.window.showTextDocument(document, { preview: false })
}

export async function showCommandPalette(state: any) {
  const context = await ensureProjectContext('打开命令面板')

  if (!context) {
    return
  }

  const items = Object.values(COMMAND_DEFINITIONS).map((commandDefinition) => {
    const resolved = resolveCommand(context, commandDefinition)

    return {
      label: `$(terminal) ${commandDefinition.label}`,
      description: resolved.command,
      detail: `${commandDefinition.detail} 当前来源：${resolved.source}`,
      commandId: commandDefinition.id,
    }
  })

  const activeDocument = vscode.window.activeTextEditor?.document
  const currentPageCandidate = activeDocument ? await getCurrentPageRouteCandidate(activeDocument) : null
  const isVuePageDocument = Boolean(activeDocument && isVueDocument(activeDocument))
  const currentPage = currentPageCandidate
    ? {
        route: currentPageCandidate.route,
        declared: currentPageCandidate.declared,
        ...(
          isVuePageDocument
            ? getVuePageConfigState(activeDocument.getText())
            : {
                hasDefinePageJson: true,
                hasJsonBlock: true,
              }
        ),
      }
    : null

  items.unshift(...getCurrentPageRunActionItems(currentPage))

  const commonItems = [
    {
      label: '$(go-to-file) 打开关键文件 / 页面',
      description: '快速打开 vite.config、app.json、package.json 和页面文件',
      detail: currentPage
        ? `当前页面 ${currentPage.route}。从 weapp-vite 项目关键入口中直接跳转。`
        : '从 weapp-vite 项目关键入口中直接跳转。',
      commandId: 'openProjectFile',
    },
    {
      label: '$(info) 查看项目概览',
      description: '输出当前工作区识别信息',
      detail: '显示项目识别信号、包管理器与可用脚本。',
      commandId: 'projectInfo',
    },
    {
      label: '$(output) 打开输出面板',
      description: OUTPUT_CHANNEL_NAME,
      detail: '查看插件最近一次执行记录。',
      commandId: 'openOutput',
    },
    {
      label: '$(book) 打开文档',
      description: 'https://vite.icebreaker.top/guide/',
      detail: '查看 weapp-vite 指南、generate 文档与扩展目录。',
      commandId: 'openDocs',
    },
  ]

  if (currentPage) {
    items.push(commonItems[0])
    items.push(...commonItems.slice(1))
  }
  else {
    items.push(...commonItems)
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: currentPage
      ? `选择当前页面 ${currentPage.route} 的 weapp-vite 操作`
      : '选择要执行的 weapp-vite 操作',
  })

  if (!selected) {
    return
  }

  if (selected.commandId === 'openProjectFile') {
    await openProjectFile(state)
    return
  }

  if (selected.commandId === 'copyCurrentPageRoute') {
    await copyCurrentPageRoute(state)
    return
  }

  if (selected.commandId === 'addCurrentPageToAppJson') {
    await addCurrentPageToAppJson(state)
    return
  }

  if (selected.commandId === 'revealCurrentPageInAppJson') {
    await revealCurrentPageInAppJson(state)
    return
  }

  if (selected.commandId === 'insertDefinePageJsonTemplate') {
    await insertDefinePageJsonTemplate()
    return
  }

  if (selected.commandId === 'insertJsonBlockTemplate') {
    await insertJsonBlockTemplate()
    return
  }

  if (selected.commandId === 'projectInfo') {
    await showProjectOverview(state)
    return
  }

  if (selected.commandId === 'openOutput') {
    state.getOutputChannel().show(true)
    return
  }

  if (selected.commandId === 'openDocs') {
    await openDocumentation()
    return
  }

  await runWorkspaceCommand(selected.commandId, state)
}
