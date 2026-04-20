const assert = require('node:assert/strict')
const path = require('node:path')
const process = require('node:process')

async function waitForCommand(commandId, timeoutMs = 15000) {
  const startTime = Date.now()
  const vscode = require('vscode')

  while (Date.now() - startTime < timeoutMs) {
    const commands = await vscode.commands.getCommands(true)

    if (commands.includes(commandId)) {
      return
    }

    await new Promise(resolve => setTimeout(resolve, 200))
  }

  throw new Error(`等待命令注册超时: ${commandId}`)
}

exports.run = async function run() {
  const vscode = require('vscode')
  const extensionId = process.env.WEAPP_VITE_VSIX_ID || 'weapp-vite.weapp-vite'
  const expectVueOfficial = process.env.WEAPP_VITE_EXPECT_VUE_OFFICIAL === '1'
  const vueOfficialExtensionId = process.env.WEAPP_VITE_VUE_OFFICIAL_EXTENSION_ID || 'Vue.volar'
  const extension = vscode.extensions.getExtension(extensionId)
  const vueOfficialExtension = vscode.extensions.getExtension(vueOfficialExtensionId)

  assert.ok(extension, `未找到已安装扩展: ${extensionId}`)

  await extension.activate()
  await waitForCommand('weapp-vite.showOutput')

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
  assert.ok(workspaceFolder, '未找到测试工作区')

  const fixturePagePath = path.join(workspaceFolder.uri.fsPath, 'src', 'pages', 'home', 'index.vue')
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fixturePagePath))
  const editor = await vscode.window.showTextDocument(document)

  await vscode.commands.executeCommand('weapp-vite.showOutput')
  await vscode.commands.executeCommand('weapp-vite.refreshPagesTree')
  await vscode.commands.executeCommand('weapp-vite.filterProblemPagesInTree')
  await vscode.commands.executeCommand('weapp-vite.clearPagesTreeFilter')
  await vscode.commands.executeCommand('weapp-vite.revealCurrentPageInPagesTree')

  const commands = await vscode.commands.getCommands(true)
  const expectedLanguageId = expectVueOfficial ? 'vue' : 'plaintext'

  assert.equal(extension.isActive, true)
  assert.equal(document.languageId, expectedLanguageId)
  assert.equal(editor.document.uri.fsPath, fixturePagePath)
  assert.equal(commands.includes('weapp-vite.revealCurrentPageInPagesTree'), true)
  assert.equal(commands.includes('weapp-vite.filterCurrentPageInTree'), true)
  assert.equal(Boolean(vueOfficialExtension), expectVueOfficial)
}
