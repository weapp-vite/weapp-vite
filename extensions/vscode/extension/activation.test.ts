import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, it, vi } from 'vitest'

const extensionIndexUrl = pathToFileURL(path.resolve(__dirname, 'index.ts')).href

function createMockVscode() {
  const registeredCommands = []
  const registeredProviders = []
  const createdTreeViews = []
  const diagnosticCollections = []
  const outputChannels = []
  const statusBarItems = []

  const mockVscode = {
    StatusBarAlignment: {
      Left: 1,
    },
    window: {
      activeTextEditor: undefined,
      createOutputChannel(name) {
        const channel = {
          name,
          lines: [],
          appendLine(line) {
            this.lines.push(line)
          },
          clear() {
            this.lines = []
          },
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
          showCalled: false,
          hideCalled: false,
          show() {
            this.showCalled = true
          },
          hide() {
            this.hideCalled = true
          },
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
      createTreeView(viewId, options) {
        const treeView = {
          options,
          reveal: async () => true,
          viewId,
          dispose() {},
        }
        createdTreeViews.push(treeView)
        return treeView
      },
      onDidChangeActiveTextEditor(handler) {
        return { dispose() {}, handler }
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
        get(_key, defaultValue) {
          return defaultValue
        },
      }),
      onDidChangeWorkspaceFolders(handler) {
        return { dispose() {}, handler }
      },
      onDidChangeConfiguration(handler) {
        return { dispose() {}, handler }
      },
      onDidSaveTextDocument(handler) {
        return { dispose() {}, handler }
      },
      onDidOpenTextDocument(handler) {
        return { dispose() {}, handler }
      },
      onDidChangeTextDocument(handler) {
        return { dispose() {}, handler }
      },
      applyEdit: async () => true,
      openTextDocument: async () => ({
        uri: { path: '/tmp/demo.ts' },
      }),
    },
    commands: {
      registerCommand(command, handler) {
        registeredCommands.push({ command, handler })
        return { dispose() {} }
      },
    },
    languages: {
      createDiagnosticCollection(name) {
        const collection = {
          name,
          entries: [],
          set() {},
          delete() {},
          dispose() {},
        }
        diagnosticCollections.push(collection)
        return collection
      },
      registerCodeActionsProvider(selector) {
        registeredProviders.push({ type: 'codeActions', selector })
        return { dispose() {} }
      },
      registerCompletionItemProvider(selector) {
        registeredProviders.push({ type: 'completion', selector })
        return { dispose() {} }
      },
      registerDocumentLinkProvider(selector) {
        registeredProviders.push({ type: 'documentLink', selector })
        return { dispose() {} }
      },
      registerHoverProvider(selector) {
        registeredProviders.push({ type: 'hover', selector })
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
      file(fsPath) {
        return { fsPath, path: fsPath }
      },
      parse(value) {
        return { value }
      },
    },
    Range: class {
      constructor(startLine, startCharacter, endLine, endCharacter) {
        this.start = { line: startLine, character: startCharacter }
        this.end = { line: endLine, character: endCharacter }
      }
    },
    Diagnostic: class {
      constructor(range, message, severity) {
        this.range = range
        this.message = message
        this.severity = severity
      }
    },
    DiagnosticSeverity: {
      Information: 1,
    },
    CodeAction: class {
      constructor(title, kind) {
        this.title = title
        this.kind = kind
      }
    },
    CodeActionKind: {
      QuickFix: 'QuickFix',
      RefactorRewrite: 'RefactorRewrite',
    },
    CompletionItem: class {
      constructor(label, kind) {
        this.label = label
        this.kind = kind
      }
    },
    CompletionItemKind: {
      Snippet: 1,
      Property: 2,
      Function: 3,
      Value: 4,
      File: 5,
    },
    SnippetString: class {
      constructor(value) {
        this.value = value
      }
    },
    MarkdownString: class {
      constructor(value) {
        this.value = value
      }
    },
    Hover: class {
      constructor(contents) {
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
      constructor(label, collapsibleState) {
        this.label = label
        this.collapsibleState = collapsibleState
      }
    },
    ThemeIcon: class {
      constructor(id) {
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
    mockVscode,
    registeredCommands,
    registeredProviders,
    createdTreeViews,
    diagnosticCollections,
    outputChannels,
    statusBarItems,
  }
}

async function withMockedVscode(run: (state: ReturnType<typeof createMockVscode>) => Promise<void> | void) {
  const state = createMockVscode()

  vi.doMock('vscode', () => {
    return {
      default: state.mockVscode,
    }
  })
  vi.resetModules()

  try {
    await run(state)
  }
  finally {
    vi.doUnmock('vscode')
    vi.resetModules()
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

it('extension index exports activate and deactivate', async () => {
  await withMockedVscode(async () => {
    const extension = await import(`${extensionIndexUrl}?t=${Date.now()}`)

    assert.equal(typeof extension.activate, 'function')
    assert.equal(typeof extension.deactivate, 'function')
  })
})

it('activate registers commands, providers, status bar and diagnostics', async () => {
  await withMockedVscode(async (state) => {
    const extension = await import(`${extensionIndexUrl}?t=${Date.now()}`)
    const subscriptions = []

    extension.activate({ subscriptions })

    assert.equal(state.registeredCommands.length, 37)
    assert.deepEqual(
      state.registeredCommands.map(item => item.command),
      [
        'weapp-vite.generate',
        'weapp-vite.dev',
        'weapp-vite.build',
        'weapp-vite.open',
        'weapp-vite.doctor',
        'weapp-vite.showProjectInfo',
        'weapp-vite.showOutput',
        'weapp-vite.runAction',
        'weapp-vite.insertJsonBlockTemplate',
        'weapp-vite.insertDefineConfigTemplate',
        'weapp-vite.insertDefinePageJsonTemplate',
        'weapp-vite.syncDefinePageJsonTitleFromJson',
        'weapp-vite.syncJsonTitleFromDefinePageJson',
        'weapp-vite.insertCommonScripts',
        'weapp-vite.createPageFromRoute',
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
        'weapp-vite.filterDriftPagesInTree',
        'weapp-vite.clearPagesTreeFilter',
        'weapp-vite.generateMissingPagesFromAppJson',
        'weapp-vite.syncUnregisteredPagesToAppJson',
        'weapp-vite.revealPageRouteInAppJsonFromTreeItem',
        'weapp-vite.syncDefinePageJsonFromJsonInTreeItem',
        'weapp-vite.syncJsonFromDefinePageJsonInTreeItem',
      ],
    )
    assert.equal(state.registeredProviders.length, 7)
    assert.equal(state.createdTreeViews.length, 1)
    assert.equal(state.createdTreeViews[0].viewId, 'weapp-vite.pages')
    assert.equal(state.statusBarItems.length, 1)
    assert.equal(state.statusBarItems[0].command, 'weapp-vite.runAction')
    assert.equal(state.outputChannels.length, 1)
    assert.equal(state.diagnosticCollections.length, 1)
    assert.ok(subscriptions.length >= 1)
  })
})
