const assert = require('node:assert/strict')
const path = require('node:path')

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

function getLocationUri(location) {
  return location?.targetUri ?? location?.uri
}

async function assertClassDefinition(vscode, document, className, expectedFileName) {
  const sourceText = document.getText()
  const classOffset = sourceText.indexOf(className)

  assert.notEqual(classOffset, -1, `missing class in fixture: ${className}`)

  const definitions = await vscode.commands.executeCommand(
    'vscode.executeDefinitionProvider',
    document.uri,
    document.positionAt(classOffset + 2),
  )

  assert.ok(Array.isArray(definitions), `definition result must be an array for ${className}`)
  assert.equal(definitions.length > 0, true, `missing definition for ${className}`)
  assert.equal(
    definitions.some((definition) => {
      const uri = getLocationUri(definition)

      return uri?.fsPath?.endsWith(expectedFileName)
    }),
    true,
    `definition for ${className} should target ${expectedFileName}`,
  )
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
  assert.equal(commands.includes('weapp-vite.filterCurrentPageInTree'), true)

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]

  assert.ok(workspaceFolder, 'missing VS Code smoke workspace folder')

  const rawBannerWxmlPath = path.join(
    workspaceFolder.uri.fsPath,
    'src',
    'components',
    'raw-banner',
    'index.wxml',
  )
  const rawBannerDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(rawBannerWxmlPath))

  await assertClassDefinition(vscode, rawBannerDocument, 'feature-card', path.join('raw-banner', 'index.wxss'))
  await assertClassDefinition(vscode, rawBannerDocument, 'feature-card__main', path.join('raw-banner', 'index.scss'))
}
