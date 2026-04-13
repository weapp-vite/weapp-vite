const assert = require('node:assert/strict')

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

  await waitForCommand('weapp-vite.showOutput')

  await vscode.commands.executeCommand('weapp-vite.showOutput')
  await vscode.commands.executeCommand('weapp-vite.refreshPagesTree')
  await vscode.commands.executeCommand('weapp-vite.filterProblemPagesInTree')
  await vscode.commands.executeCommand('weapp-vite.clearPagesTreeFilter')

  const commands = await vscode.commands.getCommands(true)

  assert.equal(commands.includes('weapp-vite.revealCurrentPageInPagesTree'), true)
  assert.equal(commands.includes('weapp-vite.filterDriftPagesInTree'), true)
}
