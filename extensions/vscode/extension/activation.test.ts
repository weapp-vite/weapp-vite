/// <reference types="node" />

import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, it, vi } from 'vitest'

const extensionIndexUrl = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'index.ts')).href

interface Disposable {
  dispose: () => void
}
type Handler = (...args: unknown[]) => unknown
interface CommandRegistration {
  command: string
  handler: unknown
}
interface ProviderRegistration {
  type: string
  selector: unknown
}
interface TreeViewRecord {
  viewId: string
  options: unknown
}
interface DiagnosticCollectionRecord {
  name: string
  entries: unknown[]
  set: () => void
  delete: () => void
  dispose: () => void
}
interface OutputChannelRecord {
  name: string
  lines: string[]
  appendLine: (line: string) => void
  clear: () => void
  show: () => void
  dispose: () => void
}
interface StatusBarItemRecord {
  command: string | undefined
  text: string
  tooltip: string
  showCalled: boolean
  hideCalled: boolean
  show: () => void
  hide: () => void
  dispose: () => void
}
interface MockUri {
  fsPath?: string
  path?: string
  value?: string
}
interface MockPosition {
  line: number
  character: number
}
interface MockRangeValue {
  start: MockPosition
  end: MockPosition
}
interface MockTextDocument {
  uri: { path: string }
}
interface MockExtensionContext {
  subscriptions: Disposable[]
}
interface MockVscodeModule extends Record<string, unknown> {
  default?: Record<string, unknown>
}
interface MockVscodeState {
  mockVscode: Record<string, unknown>
  registeredCommands: CommandRegistration[]
  registeredProviders: ProviderRegistration[]
  createdTreeViews: TreeViewRecord[]
  diagnosticCollections: DiagnosticCollectionRecord[]
  outputChannels: OutputChannelRecord[]
  statusBarItems: StatusBarItemRecord[]
}

function createVscodeModule(mockVscode: Record<string, unknown>) {
  return {
    ...mockVscode,
    default: mockVscode,
  }
}

function createMockVscode() {
  const registeredCommands: CommandRegistration[] = []
  const registeredProviders: ProviderRegistration[] = []
  const createdTreeViews: TreeViewRecord[] = []
  const diagnosticCollections: DiagnosticCollectionRecord[] = []
  const outputChannels: OutputChannelRecord[] = []
  const statusBarItems: StatusBarItemRecord[] = []

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
      activeTextEditor: undefined as unknown,
      visibleTextEditors: [] as unknown[],
      createOutputChannel(name: string) {
        const channel: OutputChannelRecord = {
          name,
          lines: [],
          appendLine(line: string) {
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
      createTextEditorDecorationType() {
        return {
          dispose() {},
        }
      },
      createTreeView(viewId: string, options: unknown) {
        const treeView: TreeViewRecord & { reveal: () => Promise<boolean>, dispose: () => void } = {
          options,
          reveal: async () => true,
          viewId,
          dispose() {},
        }
        createdTreeViews.push(treeView)
        return treeView
      },
      onDidChangeActiveTextEditor(handler: Handler) {
        return { dispose() {}, handler }
      },
      onDidChangeVisibleTextEditors(handler: Handler) {
        return { dispose() {}, handler }
      },
    },
    workspace: {
      workspaceFolders: [] as unknown[],
      textDocuments: [] as unknown[],
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
        get<T>(_key: string, defaultValue: T) {
          return defaultValue
        },
        update: async () => true,
      }),
      findFiles: async () => [],
      onDidChangeWorkspaceFolders(handler: Handler) {
        return { dispose() {}, handler }
      },
      onDidChangeConfiguration(handler: Handler) {
        return { dispose() {}, handler }
      },
      onDidSaveTextDocument(handler: Handler) {
        return { dispose() {}, handler }
      },
      onDidOpenTextDocument(handler: Handler) {
        return { dispose() {}, handler }
      },
      onDidChangeTextDocument(handler: Handler) {
        return { dispose() {}, handler }
      },
      onDidCloseTextDocument(handler: Handler) {
        return { dispose() {}, handler }
      },
      onDidRenameFiles(handler: Handler) {
        return { dispose() {}, handler }
      },
      onDidDeleteFiles(handler: Handler) {
        return { dispose() {}, handler }
      },
      applyEdit: async () => true,
      openTextDocument: async (): Promise<MockTextDocument> => ({
        uri: { path: '/tmp/demo.ts' },
      }),
    },
    commands: {
      registerCommand(command: string, handler: unknown) {
        registeredCommands.push({ command, handler })
        return { dispose() {} }
      },
    },
    ConfigurationTarget: {
      Global: 1,
    },
    languages: {
      createDiagnosticCollection(name: string) {
        const collection: DiagnosticCollectionRecord = {
          name,
          entries: [],
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
      file(fsPath: string): MockUri {
        return { fsPath, path: fsPath }
      },
      parse(value: string): MockUri {
        return { value }
      },
    },
    Range: class {
      start: MockPosition
      end: MockPosition

      constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
        this.start = { line: startLine, character: startCharacter }
        this.end = { line: endLine, character: endCharacter }
      }
    },
    Diagnostic: class {
      range: MockRangeValue
      message: string
      severity: number

      constructor(range: MockRangeValue, message: string, severity: number) {
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
      File: 5,
      Module: 6,
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
    DocumentLink: class {
      range: MockRangeValue
      target: MockUri

      constructor(range: MockRangeValue, target: MockUri) {
        this.range = range
        this.target = target
      }
    },
    WorkspaceEdit: class {
      replace() {}
    },
    EventEmitter: class {
      event = (): Disposable => ({ dispose: () => {} })
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
    mockVscode,
    registeredCommands,
    registeredProviders,
    createdTreeViews,
    diagnosticCollections,
    outputChannels,
    statusBarItems,
  }
}

async function withMockedVscode(run: (state: MockVscodeState) => Promise<void> | void) {
  const state = createMockVscode()

  vi.doMock('vscode', () => {
    return createVscodeModule(state.mockVscode) satisfies MockVscodeModule
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
    const subscriptions: Disposable[] = []

    extension.activate({ subscriptions } satisfies MockExtensionContext)

    assert.equal(state.registeredCommands.length, 41)
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
        'weapp-vite.insertJsonBlockTemplate',
        'weapp-vite.insertDefineConfigTemplate',
        'weapp-vite.insertDefinePageJsonTemplate',
        'weapp-vite.syncDefinePageJsonTitleFromJson',
        'weapp-vite.syncJsonTitleFromDefinePageJson',
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
        'weapp-vite.filterDriftPagesInTree',
        'weapp-vite.clearPagesTreeFilter',
        'weapp-vite.repairProjectIssues',
        'weapp-vite.generateMissingComponentsFromProject',
        'weapp-vite.generateMissingPagesFromAppJson',
        'weapp-vite.syncUnregisteredPagesToAppJson',
        'weapp-vite.revealPageRouteInAppJsonFromTreeItem',
        'weapp-vite.syncDefinePageJsonFromJsonInTreeItem',
        'weapp-vite.syncJsonFromDefinePageJsonInTreeItem',
      ],
    )
    assert.equal(state.registeredProviders.length, 17)
    assert.equal(state.createdTreeViews.length, 1)
    assert.equal(state.createdTreeViews[0].viewId, 'weapp-vite.pages')
    assert.equal(state.statusBarItems.length, 1)
    assert.equal(state.statusBarItems[0].command, 'weapp-vite.runAction')
    assert.equal(state.outputChannels.length, 1)
    assert.equal(state.diagnosticCollections.length, 1)
    assert.ok(subscriptions.length >= 1)
  })
})
