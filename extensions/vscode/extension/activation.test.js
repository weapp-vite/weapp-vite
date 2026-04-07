const assert = require('node:assert/strict')
const { Buffer } = require('node:buffer')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')

const extensionEntryPath = path.resolve(__dirname, '..', 'extension.js')

function createMockVscode() {
  const registeredCommands = []
  const registeredProviders = []
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
      setStatusBarMessage() {},
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
        readFile: async () => Buffer.from(''),
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
      registerHoverProvider(selector) {
        registeredProviders.push({ type: 'hover', selector })
        return { dispose() {} }
      },
    },
    env: {
      openExternal: async () => true,
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
  }

  return {
    mockVscode,
    registeredCommands,
    registeredProviders,
    diagnosticCollections,
    outputChannels,
    statusBarItems,
  }
}

function withMockedVscode(run) {
  const originalLoad = Module._load
  const state = createMockVscode()

  Module._load = function patchedLoader(request, parent, isMain) {
    if (request === 'vscode') {
      return state.mockVscode
    }

    return originalLoad.call(this, request, parent, isMain)
  }

  delete require.cache[extensionEntryPath]
  delete require.cache[path.resolve(__dirname, 'index.js')]

  try {
    return run(state)
  }
  finally {
    delete require.cache[extensionEntryPath]
    delete require.cache[path.resolve(__dirname, 'index.js')]
    Module._load = originalLoad
  }
}

test('extension entry exports activate and deactivate', () => {
  withMockedVscode(() => {
    const extension = require(extensionEntryPath)

    assert.equal(typeof extension.activate, 'function')
    assert.equal(typeof extension.deactivate, 'function')
  })
})

test('activate registers commands, providers, status bar and diagnostics', () => {
  withMockedVscode((state) => {
    const extension = require(extensionEntryPath)
    const subscriptions = []

    extension.activate({ subscriptions })

    assert.equal(state.registeredCommands.length, 12)
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
        'weapp-vite.insertCommonScripts',
        'weapp-vite.openDocs',
      ],
    )
    assert.equal(state.registeredProviders.length, 5)
    assert.equal(state.statusBarItems.length, 1)
    assert.equal(state.statusBarItems[0].command, 'weapp-vite.runAction')
    assert.equal(state.outputChannels.length, 1)
    assert.equal(state.diagnosticCollections.length, 1)
    assert.ok(subscriptions.length >= 1)
  })
})
