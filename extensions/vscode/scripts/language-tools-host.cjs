const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

function applyEdits(document, edits) {
  let source = document.getText()
  for (const edit of [...edits].sort((left, right) => document.offsetAt(right.range.start) - document.offsetAt(left.range.start))) {
    source = source.slice(0, document.offsetAt(edit.range.start)) + edit.newText + source.slice(document.offsetAt(edit.range.end))
  }
  return source
}

async function waitFor(check, message) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    if (await check()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(message)
}

exports.assertLanguageTools = async function assertLanguageTools(vscode, workspaceFolder) {
  const root = workspaceFolder.uri.fsPath
  // 缺少项目格式器必须让宿主门禁失败，不能把内置模板 fallback 误记成 CLI 一致性。
  const bridgeRoot = await fs.mkdtemp(path.join(root, '.language-tools-host-'))
  let projectTools
  let formatter
  try {
    const bridge = path.join(bridgeRoot, 'index.mjs')
    await fs.writeFile(bridge, 'export * as projectTools from "@weapp-vite/oxfmt/project"; export * as formatter from "@weapp-vite/oxfmt/languages";\n')
    ;({ projectTools, formatter } = await import(pathToFileURL(bridge).href))
  }
  finally {
    await fs.rm(bridgeRoot, { recursive: true, force: true })
  }
  const project = await projectTools.loadProjectConfig(root)
  const fixtureRoot = path.join(root, 'src', 'language-tools')
  const open = fileName => vscode.workspace.openTextDocument(vscode.Uri.file(path.join(fixtureRoot, fileName)))
  const format = document => vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', document.uri, { tabSize: 2, insertSpaces: true })
  const cliFormat = async (document) => {
    const input = await projectTools.resolveProjectDocumentInput(project, document.uri.fsPath, document.getText())
    const relative = path.relative(project.root, document.uri.fsPath).replaceAll('\\', '/')
    const resolved = projectTools.resolveDocumentFormatOptions(relative, project.fmt)
    return formatter.formatDocument(input.source, resolved.fileName, {
      ...resolved.options,
      ...input.options,
      platform: input.platform,
      sourceKind: input.sourceKind,
      dialect: input.dialect,
      language: input.language,
    })
  }

  for (const fileName of ['mixed.sjs.ts', 'mixedConsumer.sjs.ts']) {
    const document = await open(fileName)
    const input = await projectTools.resolveProjectDocumentInput(project, document.uri.fsPath, document.getText())
    assert.equal(input.platform, 'tt', `mixed SJS fixture requires an explicit platform: ${fileName}`)
    assert.equal(input.sourceKind, 'compiled', `mixed SJS fixture must use compiled source: ${fileName}`)
  }
  assert.equal(await projectTools.resolveProjectReference(project, path.join(fixtureRoot, 'mixedConsumer.sjs.ts'), './mixed.sjs.js'), path.join(fixtureRoot, 'mixed.sjs.ts'), 'mixed SJS fixture must resolve its compiled source dependency')

  for (const extension of ['wxml', 'axml', 'ttml', 'swan', 'jxml', 'qml', 'ksml', 'xhsml', 'tyml']) {
    const document = await open(`markup.${extension}`)
    assert.equal(document.languageId, extension === 'wxml' ? 'wxml' : 'miniprogram-template')
    const edits = await format(document)
    assert.ok(Array.isArray(edits), `missing formatter for ${extension}`)
    const formatted = applyEdits(document, edits)
    assert.equal(formatted, await cliFormat(document), `CLI/editor mismatch for ${extension}`)
    assert.ok(formatted.includes('<text>  A  B &amp; 中文😀  </text>'), `text changed for ${extension}`)
    assert.ok(formatted.includes('data-note="{{ \'}}\' }}"'), `attribute changed for ${extension}`)
  }

  for (const fileName of ['tools.wxs', 'typed.wxs.ts', 'tools.filter.js', 'style.wxss', 'style.acss', 'style.ttss', 'style.qss', 'style.jxss', 'style.tyss']) {
    const document = await open(fileName)
    const script = /\.(?:wxs|ts|js)$/u.test(fileName)
    assert.equal(document.languageId, script ? 'miniprogram-script' : 'css')
    assert.equal(vscode.workspace.getConfiguration('editor', { uri: document.uri, languageId: document.languageId }).get('defaultFormatter'), 'weapp-vite.weapp-vite')
    const edits = await format(document)
    const formatted = applyEdits(document, edits ?? [])
    assert.equal(formatted, await cliFormat(document), `native formatter mismatch: ${fileName}`)
    if (fileName === 'style.wxss') {
      assert.ok(formatted.includes('\n    width:'), 'native formatter did not apply the project fmt override')
    }
  }

  const filterTemplate = await open('filter.swan')
  const filter = await open('filter.js')
  await vscode.window.showTextDocument(filterTemplate)
  await waitFor(() => filter.languageId === 'miniprogram-script', 'referenced filter.js was not assigned its module formatter')

  const moduleTemplate = await open('module.wxml')
  const member = moduleTemplate.getText().indexOf('tools.value') + 'tools.'.length + 1
  const definitions = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', moduleTemplate.uri, moduleTemplate.positionAt(member))
  assert.ok(definitions.some(location => (location.uri ?? location.targetUri).fsPath.endsWith('tools.wxs')), `module definition missing; received ${JSON.stringify(definitions)}`)
  const rename = await vscode.commands.executeCommand('vscode.executeDocumentRenameProvider', moduleTemplate.uri, moduleTemplate.positionAt(member), 'amount')
  const renamed = new Map(rename.entries().map(([uri, edits]) => [uri.fsPath, edits]))
  const script = await open('tools.wxs')
  assert.match(applyEdits(script, renamed.get(script.uri.fsPath) ?? []), /amount:\s*value/u, 'public rename changed local binding')
  assert.ok(applyEdits(moduleTemplate, renamed.get(moduleTemplate.uri.fsPath) ?? []).includes('"tools.value"'), 'rename changed a string')

  const dependency = await open('dependency.wxs.ts')
  const dependencyMember = dependency.getText().indexOf('tools[\'value\']') + 'tools[\''.length + 1
  const dependencyDefinitions = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', dependency.uri, dependency.positionAt(dependencyMember))
  assert.ok(dependencyDefinitions.some(location => (location.uri ?? location.targetUri).fsPath === script.uri.fsPath), 'static script dependency definition missing')
  const dependencyRename = await vscode.commands.executeCommand('vscode.executeDocumentRenameProvider', dependency.uri, dependency.positionAt(dependencyMember), 'amount')
  const dependencyChanges = new Map(dependencyRename.entries().map(([uri, edits]) => [uri.fsPath, edits]))
  const dependencyResult = applyEdits(dependency, dependencyChanges.get(dependency.uri.fsPath) ?? [])
  assert.ok(dependencyResult.includes('tools[\'amount\']'), 'computed dependency member rename missing')
  assert.match(dependencyResult, /\{\s*amount:\s*local\s*\}/u, 'require alias was not preserved')
  assert.ok(dependencyResult.includes('return tools.value'), 'rename crossed a shadowed binding')

  const mixed = await open('mixed.sjs.ts')
  const mixedConsumer = await open('mixedConsumer.sjs.ts')
  const mixedMember = mixedConsumer.getText().indexOf('defaults.value') + 'defaults.'.length + 1
  const mixedRename = await vscode.commands.executeCommand('vscode.executeDocumentRenameProvider', mixedConsumer.uri, mixedConsumer.positionAt(mixedMember), 'amount')
  const mixedChanges = new Map(mixedRename.entries().map(([uri, edits]) => [uri.fsPath, edits]))
  assert.ok(applyEdits(mixed, mixedChanges.get(mixed.uri.fsPath) ?? []).includes('export default { amount: value }'), 'default member rename lost its export scope')
  const mixedResult = applyEdits(mixedConsumer, mixedChanges.get(mixedConsumer.uri.fsPath) ?? [])
  assert.ok(mixedResult.includes('defaults.amount'), 'default member rename missing')
  assert.ok(mixedResult.includes('namespace.value'), 'default member rename changed named export use')

  const invalid = await open('invalid.wxml')
  const invalidSource = invalid.getText()
  // VSCode 的命令只返回非空编辑；provider 的 [] 会规范化为 undefined。
  assert.deepEqual(await format(invalid) ?? [], [], 'invalid template must refuse all edits')
  assert.equal(invalid.getText(), invalidSource, 'invalid template was changed')
  await waitFor(() => vscode.languages.getDiagnostics(invalid.uri).some(diagnostic => diagnostic.source === 'weapp-vite' && diagnostic.severity === vscode.DiagnosticSeverity.Error), 'shared template diagnostic missing')

  const saved = await open('save.wxml')
  const original = await fs.readFile(saved.uri.fsPath)
  const expected = await cliFormat(saved)
  try {
    await vscode.window.showTextDocument(saved)
    const edit = new vscode.WorkspaceEdit()
    edit.insert(saved.uri, saved.positionAt(saved.getText().length), ' ')
    await vscode.workspace.applyEdit(edit)
    const expectedSaved = await cliFormat(saved)
    await saved.save()
    assert.equal(await fs.readFile(saved.uri.fsPath, 'utf8'), expectedSaved, 'formatOnSave did not use the shared formatter')
    assert.ok(expected.includes('<text>  A  B  </text>'))
  }
  finally {
    await fs.writeFile(saved.uri.fsPath, original)
  }
  console.log('language tools host: nine templates, native modules/styles, static script dependencies, shared diagnostics, scoped rename and formatOnSave passed')
}
