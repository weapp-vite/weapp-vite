const vscode = require('vscode')

function getWorkspaceFolder() {
  const [workspaceFolder] = vscode.workspace.workspaceFolders ?? []
  return workspaceFolder
}

function runGenerateCommand() {
  const workspaceFolder = getWorkspaceFolder()

  if (!workspaceFolder) {
    void vscode.window.showWarningMessage('weapp-vite: 请先打开一个工作区后再运行 generate。')
    return
  }

  const terminal = vscode.window.createTerminal({
    name: 'weapp-vite generate',
    cwd: workspaceFolder.uri.fsPath,
  })

  terminal.show(true)
  terminal.sendText('weapp-vite generate', true)
}

function activate(context) {
  const disposable = vscode.commands.registerCommand('weapp-vite.generate', () => {
    runGenerateCommand()
  })

  context.subscriptions.push(disposable)
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
}
