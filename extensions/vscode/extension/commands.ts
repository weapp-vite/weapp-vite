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
  getDocItems,
  getJsonBlockSnippet,
} from './content'
import {
  applySuggestedScripts,
} from './logic'
import {
  getEditor,
  getPrimaryWorkspaceFolder,
  getProjectContext,
  isPackageJsonDocument,
  isViteConfigDocument,
  isVueDocument,
  resolveCommand,
} from './workspace'

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

  items.push(
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
  )

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '选择要执行的 weapp-vite 操作',
  })

  if (!selected) {
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
