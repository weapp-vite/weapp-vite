import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

function createMockVscode() {
  const registeredCommands: Array<{ command: string, handler: unknown }> = []
  const registeredProviders: Array<{ type: string, selector: unknown }> = []
  const createdTreeViews: Array<{ viewId: string, options: unknown }> = []
  const diagnosticCollections: Array<{ name: string }> = []
  const outputChannels: Array<{ name: string }> = []
  const statusBarItems: Array<{ command?: string }> = []

  const mockVscode = {
    StatusBarAlignment: {
      Left: 1,
    },
    ThemeColor: class {
      id: string

      constructor(id: string) {
        this.id = id
      }
    },
    window: {
      activeTextEditor: undefined,
      visibleTextEditors: [],
      createOutputChannel(name: string) {
        const channel = {
          name,
          appendLine() {},
          clear() {},
          show() {},
          dispose() {},
        }
        outputChannels.push(channel)
        return channel
      },
      createStatusBarItem() {
        const item = {
          command: undefined,
          text: '',
          tooltip: '',
          show() {},
          hide() {},
          dispose() {},
        }
        statusBarItems.push(item)
        return item
      },
      showWarningMessage() {},
      showInformationMessage() {},
      showQuickPick: async () => undefined,
      showTextDocument: async () => undefined,
      setStatusBarMessage() {},
      createTextEditorDecorationType() {
        return {
          dispose() {},
        }
      },
      createTreeView(viewId: string, options: unknown) {
        const treeView = {
          options,
          reveal: async () => true,
          viewId,
          dispose() {},
        }
        createdTreeViews.push(treeView)
        return treeView
      },
      onDidChangeActiveTextEditor() {
        return { dispose() {} }
      },
      onDidChangeVisibleTextEditors() {
        return { dispose() {} }
      },
    },
    workspace: {
      workspaceFolders: [],
      textDocuments: [],
      fs: {
        stat: async () => {
          throw new Error('not found')
        },
        createDirectory: async () => true,
        readFile: async () => Buffer.from(''),
        writeFile: async () => true,
      },
      getWorkspaceFolder: () => undefined,
      getConfiguration: () => ({
        get(_key: string, defaultValue: unknown) {
          return defaultValue
        },
      }),
      findFiles: async () => [],
      onDidChangeWorkspaceFolders() {
        return { dispose() {} }
      },
      onDidChangeConfiguration() {
        return { dispose() {} }
      },
      onDidSaveTextDocument() {
        return { dispose() {} }
      },
      onDidOpenTextDocument() {
        return { dispose() {} }
      },
      onDidChangeTextDocument() {
        return { dispose() {} }
      },
      onDidCloseTextDocument() {
        return { dispose() {} }
      },
      onDidRenameFiles() {
        return { dispose() {} }
      },
      onDidDeleteFiles() {
        return { dispose() {} }
      },
      applyEdit: async () => true,
      openTextDocument: async () => ({
        uri: { path: '/tmp/demo.ts' },
      }),
    },
    commands: {
      registerCommand(command: string, handler: unknown) {
        registeredCommands.push({ command, handler })
        return { dispose() {} }
      },
    },
    languages: {
      createDiagnosticCollection(name: string) {
        const collection = {
          name,
          set() {},
          delete() {},
          dispose() {},
        }
        diagnosticCollections.push(collection)
        return collection
      },
      registerCodeActionsProvider(selector: unknown) {
        registeredProviders.push({ type: 'codeActions', selector })
        return { dispose() {} }
      },
      registerCompletionItemProvider(selector: unknown) {
        registeredProviders.push({ type: 'completion', selector })
        return { dispose() {} }
      },
      registerDocumentLinkProvider(selector: unknown) {
        registeredProviders.push({ type: 'documentLink', selector })
        return { dispose() {} }
      },
      registerHoverProvider(selector: unknown) {
        registeredProviders.push({ type: 'hover', selector })
        return { dispose() {} }
      },
      registerDocumentHighlightProvider(selector: unknown) {
        registeredProviders.push({ type: 'documentHighlight', selector })
        return { dispose() {} }
      },
      registerDefinitionProvider(selector: unknown) {
        registeredProviders.push({ type: 'definition', selector })
        return { dispose() {} }
      },
      registerReferenceProvider(selector: unknown) {
        registeredProviders.push({ type: 'reference', selector })
        return { dispose() {} }
      },
      registerRenameProvider(selector: unknown) {
        registeredProviders.push({ type: 'rename', selector })
        return { dispose() {} }
      },
    },
    env: {
      openExternal: async () => true,
      clipboard: {
        writeText: async () => true,
      },
    },
    Uri: {
      file(fsPath: string) {
        return { fsPath, path: fsPath }
      },
      parse(value: string) {
        return { value }
      },
    },
    Range: class {
      start: { line: number, character: number }
      end: { line: number, character: number }

      constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
        this.start = { line: startLine, character: startCharacter }
        this.end = { line: endLine, character: endCharacter }
      }
    },
    Diagnostic: class {
      range: unknown
      message: string
      severity: number

      constructor(range: unknown, message: string, severity: number) {
        this.range = range
        this.message = message
        this.severity = severity
      }
    },
    DiagnosticSeverity: {
      Information: 1,
    },
    CodeAction: class {
      title: string
      kind: string

      constructor(title: string, kind: string) {
        this.title = title
        this.kind = kind
      }
    },
    CodeActionKind: {
      QuickFix: 'QuickFix',
      RefactorRewrite: 'RefactorRewrite',
    },
    CompletionItem: class {
      label: string
      kind: number

      constructor(label: string, kind: number) {
        this.label = label
        this.kind = kind
      }
    },
    CompletionItemKind: {
      Snippet: 1,
      Property: 2,
      Function: 3,
      Value: 4,
    },
    SnippetString: class {
      value: string

      constructor(value: string) {
        this.value = value
      }
    },
    MarkdownString: class {
      value: string

      constructor(value: string) {
        this.value = value
      }
    },
    Hover: class {
      contents: unknown

      constructor(contents: unknown) {
        this.contents = contents
      }
    },
    WorkspaceEdit: class {
      replace() {}
    },
    EventEmitter: class {
      event = () => ({ dispose() {} })
      fire() {}
      dispose() {}
    },
    TreeItem: class {
      label: string
      collapsibleState: number

      constructor(label: string, collapsibleState: number) {
        this.label = label
        this.collapsibleState = collapsibleState
      }
    },
    ThemeIcon: class {
      id: string

      constructor(id: string) {
        this.id = id
      }
    },
    TreeItemCollapsibleState: {
      None: 0,
      Collapsed: 1,
      Expanded: 2,
    },
  }

  return {
    createdTreeViews,
    diagnosticCollections,
    mockVscode,
    outputChannels,
    registeredCommands,
    registeredProviders,
    statusBarItems,
  }
}

async function main() {
  const extensionRoot = process.cwd()
  const distDirPath = path.join(extensionRoot, 'dist')
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-vscode-smoke-'))
  const tempDistDirPath = path.join(tempDir, 'dist')
  const tempEntryPath = path.join(tempDistDirPath, 'extension.js')
  const tempVscodePath = path.join(tempDir, 'mock-vscode.js')
  const state = createMockVscode()

  try {
    await fs.access(path.join(distDirPath, 'extension.js'))
    const distFiles = await fs.readdir(distDirPath)
    const vscodeModuleText = [
      'const mock = globalThis.__WEAPP_VITE_VSCODE_MOCK__;',
      'export default mock;',
      ...Object.keys(state.mockVscode).map(key => `export const ${key} = mock.${key};`),
      '',
    ].join('\n')

    await fs.mkdir(tempDistDirPath, { recursive: true })

    await fs.writeFile(tempVscodePath, vscodeModuleText)

    for (const fileName of distFiles) {
      const sourcePath = path.join(distDirPath, fileName)
      const targetPath = path.join(tempDistDirPath, fileName)
      const stat = await fs.stat(sourcePath)

      if (!stat.isFile()) {
        continue
      }

      if (!fileName.endsWith('.js')) {
        await fs.copyFile(sourcePath, targetPath)
        continue
      }

      const sourceText = await fs.readFile(sourcePath, 'utf8')
      const targetText = sourceText.replaceAll(
        'from "vscode"',
        `from ${JSON.stringify(pathToFileURL(tempVscodePath).href)}`,
      )

      await fs.writeFile(targetPath, targetText)
    }

    ;(globalThis as typeof globalThis & { __WEAPP_VITE_VSCODE_MOCK__?: unknown }).__WEAPP_VITE_VSCODE_MOCK__ = state.mockVscode

    const extension = await import(pathToFileURL(tempEntryPath).href)
    const subscriptions: Array<{ dispose: () => void }> = []

    assert.equal(typeof extension.activate, 'function')
    assert.equal(typeof extension.deactivate, 'function')

    extension.activate({ subscriptions })

    assert.deepEqual(
      state.registeredCommands.map(item => item.command),
      [
        'weapp-vite.generate',
        'weapp-vite.dev',
        'weapp-vite.build',
        'weapp-vite.open',
        'weapp-vite.useFileIcons',
        'weapp-vite.doctor',
        'weapp-vite.showProjectInfo',
        'weapp-vite.showOutput',
        'weapp-vite.runAction',
        'weapp-vite.insertDefineConfigTemplate',
        'weapp-vite.insertDefinePageJsonTemplate',
        'weapp-vite.insertCommonScripts',
        'weapp-vite.createPageFromRoute',
        'weapp-vite.createComponentFromUsingComponents',
        'weapp-vite.createPageFromTreeItem',
        'weapp-vite.generatePageInExplorer',
        'weapp-vite.generateComponentInExplorer',
        'weapp-vite.openPageFromRoute',
        'weapp-vite.addCurrentPageToAppJson',
        'weapp-vite.addPageToAppJsonFromTreeItem',
        'weapp-vite.openDocs',
        'weapp-vite.openProjectFile',
        'weapp-vite.copyCurrentPageRoute',
        'weapp-vite.copyPageRouteFromTreeItem',
        'weapp-vite.revealCurrentPageInAppJson',
        'weapp-vite.revealCurrentPageInPagesTree',
        'weapp-vite.refreshPagesTree',
        'weapp-vite.filterProblemPagesInTree',
        'weapp-vite.filterCurrentPageInTree',
        'weapp-vite.clearPagesTreeFilter',
        'weapp-vite.repairProjectIssues',
        'weapp-vite.generateMissingComponentsFromProject',
        'weapp-vite.generateMissingPagesFromAppJson',
        'weapp-vite.syncUnregisteredPagesToAppJson',
        'weapp-vite.revealPageRouteInAppJsonFromTreeItem',
      ],
    )
    assert.equal(state.registeredProviders.length, 17)
    assert.equal(state.createdTreeViews.length, 1)
    assert.equal(state.createdTreeViews[0]?.viewId, 'weapp-vite.pages')
    assert.equal(state.statusBarItems.length, 1)
    assert.equal(state.statusBarItems[0]?.command, 'weapp-vite.runAction')
    assert.equal(state.outputChannels.length, 1)
    assert.equal(state.diagnosticCollections.length, 1)
    assert.ok(subscriptions.length >= 1)

    console.log('extensions/vscode smoke test ok')
  }
  finally {
    delete (globalThis as typeof globalThis & { __WEAPP_VITE_VSCODE_MOCK__?: unknown }).__WEAPP_VITE_VSCODE_MOCK__
    await fs.rm(tempDir, { force: true, recursive: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
