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

function getLocationStart(location) {
  return location?.targetSelectionRange?.start ?? location?.range?.start ?? location?.range
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

async function assertTextDefinition(vscode, document, text, offsetInText, expected) {
  const sourceText = document.getText()
  const textOffset = sourceText.indexOf(text)

  assert.notEqual(textOffset, -1, `missing text in fixture: ${text}`)

  const definitions = await vscode.commands.executeCommand(
    'vscode.executeDefinitionProvider',
    document.uri,
    document.positionAt(textOffset + offsetInText),
  )

  assert.ok(Array.isArray(definitions), `definition result must be an array for ${text}`)
  assert.equal(definitions.length > 0, true, `missing definition for ${text}`)
  assert.equal(
    definitions.some((definition) => {
      const uri = getLocationUri(definition)
      const start = getLocationStart(definition)

      return uri?.fsPath?.endsWith(expected.fileName)
        && (expected.line == null || start?.line === expected.line)
        && (expected.character == null || start?.character === expected.character)
    }),
    true,
    `definition for ${text} should target ${expected.fileName}`,
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
  await assertClassDefinition(vscode, rawBannerDocument, 'base-css-card', path.join('raw-banner', 'index.css'))
  await assertClassDefinition(vscode, rawBannerDocument, 'less-card__title', path.join('raw-banner', 'index.less'))
  await assertTextDefinition(vscode, rawBannerDocument, 'item.tone', 2, {
    fileName: path.join('raw-banner', 'index.wxml'),
    line: 2,
  })
  await assertTextDefinition(vscode, rawBannerDocument, 'item.label', 'item.'.length + 1, {
    fileName: path.join('raw-banner', 'index.js'),
    line: 3,
    character: 15,
  })
  await assertTextDefinition(vscode, rawBannerDocument, 'item.tone', 'item.'.length + 1, {
    fileName: path.join('raw-banner', 'index.js'),
    line: 3,
    character: 36,
  })

  const alipayTemplatePath = path.join(
    workspaceFolder.uri.fsPath,
    'src',
    'components',
    'raw-banner',
    'platform.axml',
  )
  const alipayTemplateDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(alipayTemplatePath))

  assert.equal(alipayTemplateDocument.languageId, 'miniprogram-template')
  await assertClassDefinition(vscode, alipayTemplateDocument, 'platform-card__title', path.join('raw-banner', 'platform.less'))
}
