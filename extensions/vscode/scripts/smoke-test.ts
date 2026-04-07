import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import Module from 'node:module'
import path from 'node:path'
import process from 'node:process'

function createMockVscode() {
  const registeredCommands: Array<{ command: string, handler: unknown }> = []
  const registeredProviders: Array<{ type: string, selector: unknown }> = []
  const diagnosticCollections: Array<{ name: string }> = []
  const outputChannels: Array<{ name: string }> = []
  const statusBarItems: Array<{ command?: string }> = []

  const mockVscode = {
    StatusBarAlignment: {
      Left: 1,
    },
    window: {
      activeTextEditor: undefined,
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
      setStatusBarMessage() {},
      onDidChangeActiveTextEditor() {
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
        readFile: async () => Buffer.from(''),
      },
      getWorkspaceFolder: () => undefined,
      getConfiguration: () => ({
        get(_key: string, defaultValue: unknown) {
          return defaultValue
        },
      }),
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
      applyEdit: async () => true,
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
      registerHoverProvider(selector: unknown) {
        registeredProviders.push({ type: 'hover', selector })
        return { dispose() {} }
      },
    },
    env: {
      openExternal: async () => true,
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
  }

  return {
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
  const distEntryPath = path.join(extensionRoot, 'dist', 'extension.js')
  const state = createMockVscode()
  const originalLoad = Module._load

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'vscode') {
      return state.mockVscode
    }

    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    const distRequire = Module.createRequire(distEntryPath)
    const extension = distRequire(distEntryPath)
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
    assert.equal(state.statusBarItems[0]?.command, 'weapp-vite.runAction')
    assert.equal(state.outputChannels.length, 1)
    assert.equal(state.diagnosticCollections.length, 1)
    assert.ok(subscriptions.length >= 1)

    console.log('extensions/vscode smoke test ok')
  }
  finally {
    Module._load = originalLoad
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
