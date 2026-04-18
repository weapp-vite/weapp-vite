const assert = require('node:assert/strict')
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
  const extension = vscode.extensions.getExtension(extensionId)

  assert.ok(extension, `未找到已安装扩展: ${extensionId}`)

  await extension.activate()
  await waitForCommand('weapp-vite.showOutput')

  await vscode.commands.executeCommand('weapp-vite.showOutput')
  await vscode.commands.executeCommand('weapp-vite.refreshPagesTree')
  await vscode.commands.executeCommand('weapp-vite.filterProblemPagesInTree')
  await vscode.commands.executeCommand('weapp-vite.clearPagesTreeFilter')

  const commands = await vscode.commands.getCommands(true)

  assert.equal(extension.isActive, true)
  assert.equal(commands.includes('weapp-vite.revealCurrentPageInPagesTree'), true)
  assert.equal(commands.includes('weapp-vite.filterCurrentPageInTree'), true)
}
