import vscode from 'vscode'

import {
  addCurrentPageToAppJson,
  copyCurrentPageRoute,
  createPageFromRoute,
  insertCommonScripts,
  insertDefineConfigTemplate,
  insertJsonBlockTemplate,
  openDocumentation,
  openProjectFile,
  revealCurrentPageInAppJson,
  runWorkspaceCommand,
  showCommandPalette,
  showProjectOverview,
} from './commands'
import {
  isAppJsonDiagnosticsEnabled,
  isPackageJsonDiagnosticsEnabled,
  isStatusBarEnabled,
} from './config'
import {
  OUTPUT_CHANNEL_NAME,
  STATUS_BAR_PRIORITY,
  VITE_CONFIG_FILE_PATTERN,
} from './constants'
import {
  buildAppJsonDiagnostics,
  buildPackageJsonDiagnostics,
} from './content'
import {
  WeappViteAppJsonCompletionProvider,
  WeappViteCodeActionProvider,
  WeappViteConfigCompletionProvider,
  WeappViteHoverProvider,
  WeappVitePackageJsonCompletionProvider,
  WeappViteVueCompletionProvider,
} from './providers'
import {
  getMissingAppJsonPageRoutes,
  getProjectContext,
  isAppJsonDocument,
  isPackageJsonDocument,
} from './workspace'

let outputChannel
let statusBarItem
let diagnostics

function getOutputChannel() {
  outputChannel ??= vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME)
  return outputChannel
}

function getDiagnostics() {
  diagnostics ??= vscode.languages.createDiagnosticCollection('weapp-vite')
  return diagnostics
}

function refreshPackageJsonDiagnostics(document: any) {
  if (!isPackageJsonDocument(document)) {
    return
  }

  if (!isPackageJsonDiagnosticsEnabled()) {
    getDiagnostics().delete(document.uri)
    return
  }

  getDiagnostics().set(document.uri, buildPackageJsonDiagnostics(document))
}

async function refreshAppJsonDiagnostics(document: any) {
  if (!isAppJsonDocument(document)) {
    return
  }

  if (!isAppJsonDiagnosticsEnabled()) {
    getDiagnostics().delete(document.uri)
    return
  }

  const missingRoutes = await getMissingAppJsonPageRoutes(document)
  getDiagnostics().set(document.uri, buildAppJsonDiagnostics(document, missingRoutes))
}

async function refreshStatusBar() {
  if (!statusBarItem) {
    return
  }

  if (!isStatusBarEnabled()) {
    statusBarItem.hide()
    return
  }

  const context = await getProjectContext()

  if (!context) {
    statusBarItem.hide()
    return
  }

  statusBarItem.text = '$(tools) weapp-vite'
  statusBarItem.tooltip = [
    `工作区: ${context.workspaceFolder.name}`,
    `包管理器: ${context.packageManager}`,
    ...context.packageSignals,
    ...context.fileSignals,
  ].join('\n')
  statusBarItem.show()
}

export function activate(context: any) {
  const codeActionProvider = new WeappViteCodeActionProvider()
  const vueCompletionProvider = new WeappViteVueCompletionProvider()
  const appJsonCompletionProvider = new WeappViteAppJsonCompletionProvider()
  const packageJsonCompletionProvider = new WeappVitePackageJsonCompletionProvider()
  const viteConfigCompletionProvider = new WeappViteConfigCompletionProvider()
  const hoverProvider = new WeappViteHoverProvider()
  const state = {
    getOutputChannel,
    terminalCache: undefined,
  }
  const disposables = [
    vscode.commands.registerCommand('weapp-vite.generate', () => runWorkspaceCommand('generate', state)),
    vscode.commands.registerCommand('weapp-vite.dev', () => runWorkspaceCommand('dev', state)),
    vscode.commands.registerCommand('weapp-vite.build', () => runWorkspaceCommand('build', state)),
    vscode.commands.registerCommand('weapp-vite.open', () => runWorkspaceCommand('open', state)),
    vscode.commands.registerCommand('weapp-vite.doctor', () => runWorkspaceCommand('doctor', state)),
    vscode.commands.registerCommand('weapp-vite.showProjectInfo', () => showProjectOverview(state)),
    vscode.commands.registerCommand('weapp-vite.showOutput', () => getOutputChannel().show(true)),
    vscode.commands.registerCommand('weapp-vite.runAction', () => showCommandPalette(state)),
    vscode.commands.registerCommand('weapp-vite.insertJsonBlockTemplate', () => insertJsonBlockTemplate()),
    vscode.commands.registerCommand('weapp-vite.insertDefineConfigTemplate', () => insertDefineConfigTemplate()),
    vscode.commands.registerCommand('weapp-vite.insertCommonScripts', document => insertCommonScripts(document, refreshPackageJsonDiagnostics)),
    vscode.commands.registerCommand('weapp-vite.createPageFromRoute', (document, route) => createPageFromRoute(document, route)),
    vscode.commands.registerCommand('weapp-vite.addCurrentPageToAppJson', () => addCurrentPageToAppJson(state)),
    vscode.commands.registerCommand('weapp-vite.openDocs', () => openDocumentation()),
    vscode.commands.registerCommand('weapp-vite.openProjectFile', () => openProjectFile(state)),
    vscode.commands.registerCommand('weapp-vite.copyCurrentPageRoute', () => copyCurrentPageRoute(state)),
    vscode.commands.registerCommand('weapp-vite.revealCurrentPageInAppJson', () => revealCurrentPageInAppJson(state)),
    vscode.languages.registerCodeActionsProvider(
      [
        { language: 'json', scheme: 'file' },
        { language: 'jsonc', scheme: 'file' },
        { language: 'javascript', scheme: 'file' },
        { language: 'typescript', scheme: 'file' },
        { language: 'vue', scheme: 'file' },
      ],
      codeActionProvider,
    ),
    vscode.languages.registerCompletionItemProvider(
      { language: 'vue', scheme: 'file' },
      vueCompletionProvider,
      '<',
    ),
    vscode.languages.registerCompletionItemProvider(
      [
        { language: 'json', scheme: 'file', pattern: '**/app.json' },
        { language: 'jsonc', scheme: 'file', pattern: '**/app.json' },
      ],
      appJsonCompletionProvider,
      '"',
      '/',
    ),
    vscode.languages.registerCompletionItemProvider(
      [
        { language: 'json', scheme: 'file', pattern: '**/package.json' },
        { language: 'jsonc', scheme: 'file', pattern: '**/package.json' },
      ],
      packageJsonCompletionProvider,
      '"',
      ':',
    ),
    vscode.languages.registerCompletionItemProvider(
      [
        { language: 'javascript', scheme: 'file', pattern: '**/vite.config.*' },
        { language: 'typescript', scheme: 'file', pattern: '**/vite.config.*' },
      ],
      viteConfigCompletionProvider,
      'g',
      'p',
      '{',
      '\n',
    ),
    vscode.languages.registerHoverProvider(
      [
        { language: 'json', scheme: 'file', pattern: '**/package.json' },
        { language: 'jsonc', scheme: 'file', pattern: '**/package.json' },
        { language: 'javascript', scheme: 'file', pattern: '**/vite.config.*' },
        { language: 'typescript', scheme: 'file', pattern: '**/vite.config.*' },
        { language: 'vue', scheme: 'file' },
      ],
      hoverProvider,
    ),
    vscode.window.onDidChangeActiveTextEditor(() => {
      void refreshStatusBar()
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void refreshStatusBar()
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('weapp-vite')) {
        void refreshStatusBar()

        for (const document of vscode.workspace.textDocuments) {
          refreshPackageJsonDiagnostics(document)
          void refreshAppJsonDiagnostics(document)
        }
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isPackageJsonDocument(document)) {
        refreshPackageJsonDiagnostics(document)
      }

      if (isAppJsonDocument(document)) {
        void refreshAppJsonDiagnostics(document)
      }

      if (document.fileName.endsWith('package.json') || VITE_CONFIG_FILE_PATTERN.test(document.fileName)) {
        void refreshStatusBar()
      }
    }),
    vscode.workspace.onDidOpenTextDocument((document) => {
      refreshPackageJsonDiagnostics(document)
      void refreshAppJsonDiagnostics(document)
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      refreshPackageJsonDiagnostics(event.document)
      void refreshAppJsonDiagnostics(event.document)
    }),
  ]

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, STATUS_BAR_PRIORITY)
  statusBarItem.command = 'weapp-vite.runAction'
  disposables.push(statusBarItem)

  void refreshStatusBar()

  for (const document of vscode.workspace.textDocuments) {
    refreshPackageJsonDiagnostics(document)
    void refreshAppJsonDiagnostics(document)
  }

  context.subscriptions.push(...disposables, getOutputChannel(), getDiagnostics(), {
    dispose() {
      state.terminalCache = undefined
      statusBarItem = undefined
      outputChannel = undefined
      diagnostics = undefined
    },
  })
}

export function deactivate() {}
