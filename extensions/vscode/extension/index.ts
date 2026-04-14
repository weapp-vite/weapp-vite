import type {
  WeappPagesTreeFilterMode,
} from './tree'

import { Buffer } from 'node:buffer'
import path from 'node:path'
import vscode from 'vscode'
import {
  addCurrentPageToAppJson,
  addPageToAppJsonFromTreeItem,
  copyCurrentPageRoute,
  copyPageRouteFromTreeItem,
  createComponentFromUsingComponents,
  createPageFromRoute,
  createPageFromTreeItem,
  generateMissingPagesFromAppJson,
  insertCommonScripts,
  insertDefineConfigTemplate,
  insertDefinePageJsonTemplate,
  insertJsonBlockTemplate,
  openDocumentation,
  openPageFromRoute,
  openProjectFile,
  revealCurrentPageInAppJson,
  revealPageRouteInAppJsonFromTreeItem,
  runWorkspaceCommand,
  showCommandPalette,
  showProjectOverview,
  syncDefinePageJsonFromJsonInTreeItem,
  syncDefinePageJsonTitleFromJson,
  syncJsonFromDefinePageJsonInTreeItem,
  syncJsonTitleFromDefinePageJson,
  syncUnregisteredPagesToAppJson,
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
  buildVuePageConfigConsistencyDiagnostics,
  buildVuePageDiagnostics,
  buildVueUsingComponentDiagnostics,
} from './content'
import {
  generateComponentInExplorer,
  generatePageInExplorer,
  showGeneratePicker,
} from './generate'
import {
  getPageFileCandidatePaths,
  getRouteFromPageFilePath,
} from './navigation'
import {
  WeappViteAppJsonCompletionProvider,
  WeappViteAppJsonDocumentLinkProvider,
  WeappViteCodeActionProvider,
  WeappViteConfigCompletionProvider,
  WeappViteHoverProvider,
  WeappVitePackageJsonCompletionProvider,
  WeappViteVueCompletionProvider,
} from './providers'
import {
  WeappVitePagesTreeProvider,
} from './tree'
import {
  findNearestWeappViteProjectWorkspaceFolder,
  getAppJsonTextWithMovedRoute,
  getAppJsonTextWithRemovedRoute,
  getCurrentPageRouteCandidate,
  getMissingAppJsonPageRoutes,
  getMissingVueUsingComponents,
  getProjectAppJsonPath,
  getProjectContext,
  isAppJsonDocument,
  isPackageJsonDocument,
  isVueDocument,
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

async function refreshPackageJsonDiagnostics(document: any) {
  if (!isPackageJsonDocument(document)) {
    return
  }

  if (!isPackageJsonDiagnosticsEnabled()) {
    getDiagnostics().delete(document.uri)
    return
  }

  getDiagnostics().set(document.uri, await buildPackageJsonDiagnostics(document))
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

async function refreshVuePageDiagnostics(document: any) {
  if (!isVueDocument(document)) {
    return
  }

  if (!isAppJsonDiagnosticsEnabled()) {
    getDiagnostics().delete(document.uri)
    return
  }

  const currentPageCandidate = await getCurrentPageRouteCandidate(document)
  const missingUsingComponents = await getMissingVueUsingComponents(document)
  getDiagnostics().set(document.uri, [
    ...buildVuePageDiagnostics(currentPageCandidate),
    ...buildVuePageConfigConsistencyDiagnostics(document),
    ...buildVueUsingComponentDiagnostics(document.getText(), missingUsingComponents),
  ])
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

async function syncPagesTreeState(pagesTreeProvider: WeappVitePagesTreeProvider, pagesTreeView: any, document = vscode.window.activeTextEditor?.document) {
  const currentPageCandidate = await getCurrentPageRouteCandidate(document)
  const currentRoute = currentPageCandidate?.route ?? null

  pagesTreeProvider.setCurrentRoute(currentRoute)

  if (!currentRoute) {
    return
  }

  const pageNode = await pagesTreeProvider.resolvePageNodeByRoute(currentRoute)

  if (!pageNode) {
    return
  }

  try {
    await pagesTreeView.reveal(pageNode, {
      expand: true,
      focus: false,
      select: true,
    })
  }
  catch {
  }
}

async function revealCurrentPageInPagesTree(pagesTreeProvider: WeappVitePagesTreeProvider, pagesTreeView: any) {
  await syncPagesTreeState(pagesTreeProvider, pagesTreeView)
}

async function refreshPagesTree(pagesTreeProvider: WeappVitePagesTreeProvider, pagesTreeView: any) {
  pagesTreeProvider.refresh()
  await syncPagesTreeState(pagesTreeProvider, pagesTreeView)
}

async function applyPagesTreeFilter(
  pagesTreeProvider: WeappVitePagesTreeProvider,
  pagesTreeView: any,
  filterMode: WeappPagesTreeFilterMode,
) {
  pagesTreeProvider.setFilterMode(filterMode)
  await syncPagesTreeState(pagesTreeProvider, pagesTreeView)
}

async function clearPagesTreeFilter(pagesTreeProvider: WeappVitePagesTreeProvider, pagesTreeView: any) {
  pagesTreeProvider.clearFilterMode()
  await syncPagesTreeState(pagesTreeProvider, pagesTreeView)
}

async function writeTextFile(filePath: string, text: string) {
  await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(text, 'utf8'))
}

async function syncRenamedPageRoute(file: { oldUri: any, newUri: any }) {
  const projectFolder = await findNearestWeappViteProjectWorkspaceFolder(file.newUri.fsPath)

  if (!projectFolder) {
    return false
  }

  const appJsonPath = await getProjectAppJsonPath(projectFolder)

  if (!appJsonPath) {
    return false
  }

  const relativeFromPath = path.relative(path.dirname(appJsonPath), file.oldUri.fsPath)
  const relativeToPath = path.relative(path.dirname(appJsonPath), file.newUri.fsPath)
  const fromRoute = getRouteFromPageFilePath(relativeFromPath)
  const toRoute = getRouteFromPageFilePath(relativeToPath)

  if (!fromRoute || !toRoute || fromRoute === toRoute) {
    return false
  }

  const appJsonUpdate = await getAppJsonTextWithMovedRoute(appJsonPath, fromRoute, toRoute)

  if (!appJsonUpdate) {
    return false
  }

  await writeTextFile(appJsonUpdate.appJsonPath, appJsonUpdate.nextText)
  return true
}

async function syncDeletedPageRoute(file: { fsPath: string }) {
  const projectFolder = await findNearestWeappViteProjectWorkspaceFolder(file.fsPath)

  if (!projectFolder) {
    return false
  }

  const appJsonPath = await getProjectAppJsonPath(projectFolder)

  if (!appJsonPath) {
    return false
  }

  const appJsonDir = path.dirname(appJsonPath)
  const relativePath = path.relative(appJsonDir, file.fsPath)
  const route = getRouteFromPageFilePath(relativePath)

  if (!route) {
    return false
  }

  const siblingCandidates = getPageFileCandidatePaths(route)
    .map(candidate => path.join(appJsonDir, candidate))
    .filter(candidatePath => candidatePath !== file.fsPath)

  for (const candidatePath of siblingCandidates) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(candidatePath))
      return false
    }
    catch {
    }
  }

  const appJsonUpdate = await getAppJsonTextWithRemovedRoute(appJsonPath, route)

  if (!appJsonUpdate) {
    return false
  }

  await writeTextFile(appJsonUpdate.appJsonPath, appJsonUpdate.nextText)
  return true
}

export function activate(context: any) {
  const codeActionProvider = new WeappViteCodeActionProvider()
  const vueCompletionProvider = new WeappViteVueCompletionProvider()
  const appJsonCompletionProvider = new WeappViteAppJsonCompletionProvider()
  const appJsonDocumentLinkProvider = new WeappViteAppJsonDocumentLinkProvider()
  const packageJsonCompletionProvider = new WeappVitePackageJsonCompletionProvider()
  const viteConfigCompletionProvider = new WeappViteConfigCompletionProvider()
  const hoverProvider = new WeappViteHoverProvider()
  const pagesTreeProvider = new WeappVitePagesTreeProvider()
  const pagesTreeView = vscode.window.createTreeView('weapp-vite.pages', {
    showCollapseAll: true,
    treeDataProvider: pagesTreeProvider,
  })
  const state = {
    getOutputChannel,
    terminalCache: undefined,
  }
  const disposables = [
    vscode.commands.registerCommand('weapp-vite.generate', resourceUri => showGeneratePicker(state, resourceUri)),
    vscode.commands.registerCommand('weapp-vite.dev', () => runWorkspaceCommand('dev', state)),
    vscode.commands.registerCommand('weapp-vite.build', () => runWorkspaceCommand('build', state)),
    vscode.commands.registerCommand('weapp-vite.open', () => runWorkspaceCommand('open', state)),
    vscode.commands.registerCommand('weapp-vite.doctor', () => runWorkspaceCommand('doctor', state)),
    vscode.commands.registerCommand('weapp-vite.showProjectInfo', () => showProjectOverview(state)),
    vscode.commands.registerCommand('weapp-vite.showOutput', () => getOutputChannel().show(true)),
    vscode.commands.registerCommand('weapp-vite.runAction', () => showCommandPalette(state)),
    vscode.commands.registerCommand('weapp-vite.insertJsonBlockTemplate', () => insertJsonBlockTemplate()),
    vscode.commands.registerCommand('weapp-vite.insertDefineConfigTemplate', () => insertDefineConfigTemplate()),
    vscode.commands.registerCommand('weapp-vite.insertDefinePageJsonTemplate', () => insertDefinePageJsonTemplate()),
    vscode.commands.registerCommand('weapp-vite.syncDefinePageJsonTitleFromJson', document => syncDefinePageJsonTitleFromJson(document)),
    vscode.commands.registerCommand('weapp-vite.syncJsonTitleFromDefinePageJson', document => syncJsonTitleFromDefinePageJson(document)),
    vscode.commands.registerCommand('weapp-vite.insertCommonScripts', document => insertCommonScripts(document, refreshPackageJsonDiagnostics)),
    vscode.commands.registerCommand('weapp-vite.createPageFromRoute', (document, route) => createPageFromRoute(document, route)),
    vscode.commands.registerCommand('weapp-vite.createComponentFromUsingComponents', (document, componentPath) => createComponentFromUsingComponents(document, componentPath)),
    vscode.commands.registerCommand('weapp-vite.createPageFromTreeItem', item => createPageFromTreeItem(item)),
    vscode.commands.registerCommand('weapp-vite.generatePageInExplorer', resourceUri => generatePageInExplorer(resourceUri, state)),
    vscode.commands.registerCommand('weapp-vite.generateComponentInExplorer', resourceUri => generateComponentInExplorer(resourceUri, state)),
    vscode.commands.registerCommand('weapp-vite.openPageFromRoute', (document, route) => openPageFromRoute(document, route)),
    vscode.commands.registerCommand('weapp-vite.addCurrentPageToAppJson', () => addCurrentPageToAppJson(state)),
    vscode.commands.registerCommand('weapp-vite.addPageToAppJsonFromTreeItem', item => addPageToAppJsonFromTreeItem(item, state)),
    vscode.commands.registerCommand('weapp-vite.openDocs', () => openDocumentation()),
    vscode.commands.registerCommand('weapp-vite.openProjectFile', () => openProjectFile(state)),
    vscode.commands.registerCommand('weapp-vite.copyCurrentPageRoute', () => copyCurrentPageRoute(state)),
    vscode.commands.registerCommand('weapp-vite.copyPageRouteFromTreeItem', item => copyPageRouteFromTreeItem(item, state)),
    vscode.commands.registerCommand('weapp-vite.revealCurrentPageInAppJson', () => revealCurrentPageInAppJson(state)),
    vscode.commands.registerCommand('weapp-vite.revealCurrentPageInPagesTree', () => revealCurrentPageInPagesTree(pagesTreeProvider, pagesTreeView)),
    vscode.commands.registerCommand('weapp-vite.refreshPagesTree', () => refreshPagesTree(pagesTreeProvider, pagesTreeView)),
    vscode.commands.registerCommand('weapp-vite.filterProblemPagesInTree', () => applyPagesTreeFilter(pagesTreeProvider, pagesTreeView, 'problems')),
    vscode.commands.registerCommand('weapp-vite.filterCurrentPageInTree', () => applyPagesTreeFilter(pagesTreeProvider, pagesTreeView, 'current')),
    vscode.commands.registerCommand('weapp-vite.filterDriftPagesInTree', () => applyPagesTreeFilter(pagesTreeProvider, pagesTreeView, 'drift')),
    vscode.commands.registerCommand('weapp-vite.clearPagesTreeFilter', () => clearPagesTreeFilter(pagesTreeProvider, pagesTreeView)),
    vscode.commands.registerCommand('weapp-vite.generateMissingPagesFromAppJson', () => generateMissingPagesFromAppJson(state)),
    vscode.commands.registerCommand('weapp-vite.syncUnregisteredPagesToAppJson', () => syncUnregisteredPagesToAppJson(state)),
    vscode.commands.registerCommand('weapp-vite.revealPageRouteInAppJsonFromTreeItem', item => revealPageRouteInAppJsonFromTreeItem(item, state)),
    vscode.commands.registerCommand('weapp-vite.syncDefinePageJsonFromJsonInTreeItem', item => syncDefinePageJsonFromJsonInTreeItem(item)),
    vscode.commands.registerCommand('weapp-vite.syncJsonFromDefinePageJsonInTreeItem', item => syncJsonFromDefinePageJsonInTreeItem(item)),
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
    vscode.languages.registerDocumentLinkProvider(
      [
        { language: 'json', scheme: 'file', pattern: '**/app.json' },
        { language: 'jsonc', scheme: 'file', pattern: '**/app.json' },
      ],
      appJsonDocumentLinkProvider,
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
      void syncPagesTreeState(pagesTreeProvider, pagesTreeView)
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void refreshStatusBar()
      pagesTreeProvider.refresh()
      void syncPagesTreeState(pagesTreeProvider, pagesTreeView)
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('weapp-vite')) {
        void refreshStatusBar()
        void syncPagesTreeState(pagesTreeProvider, pagesTreeView)

        for (const document of vscode.workspace.textDocuments) {
          void refreshPackageJsonDiagnostics(document)
          void refreshAppJsonDiagnostics(document)
          void refreshVuePageDiagnostics(document)
        }
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isPackageJsonDocument(document)) {
        void refreshPackageJsonDiagnostics(document)
      }

      if (isAppJsonDocument(document)) {
        void refreshAppJsonDiagnostics(document)
      }

      if (isVueDocument(document)) {
        void refreshVuePageDiagnostics(document)
      }

      if (document.fileName.endsWith('package.json') || VITE_CONFIG_FILE_PATTERN.test(document.fileName)) {
        void refreshStatusBar()
      }

      pagesTreeProvider.refresh()
      if (vscode.window.activeTextEditor?.document === document) {
        void syncPagesTreeState(pagesTreeProvider, pagesTreeView, document)
      }
    }),
    vscode.workspace.onDidOpenTextDocument((document) => {
      void refreshPackageJsonDiagnostics(document)
      void refreshAppJsonDiagnostics(document)
      void refreshVuePageDiagnostics(document)
      pagesTreeProvider.refresh()
      if (vscode.window.activeTextEditor?.document === document) {
        void syncPagesTreeState(pagesTreeProvider, pagesTreeView, document)
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      void refreshPackageJsonDiagnostics(event.document)
      void refreshAppJsonDiagnostics(event.document)
      void refreshVuePageDiagnostics(event.document)
      pagesTreeProvider.refresh()
      if (vscode.window.activeTextEditor?.document === event.document) {
        void syncPagesTreeState(pagesTreeProvider, pagesTreeView, event.document)
      }
    }),
    vscode.workspace.onDidRenameFiles((event) => {
      void (async () => {
        let didSyncAnyRoute = false

        for (const file of event.files) {
          didSyncAnyRoute = await syncRenamedPageRoute(file) || didSyncAnyRoute
        }

        if (!didSyncAnyRoute) {
          return
        }

        pagesTreeProvider.refresh()
        void refreshStatusBar()

        for (const document of vscode.workspace.textDocuments) {
          void refreshAppJsonDiagnostics(document)
          void refreshVuePageDiagnostics(document)
        }

        void syncPagesTreeState(pagesTreeProvider, pagesTreeView)
      })()
    }),
    vscode.workspace.onDidDeleteFiles((event) => {
      void (async () => {
        let didSyncAnyRoute = false

        for (const file of event.files) {
          didSyncAnyRoute = await syncDeletedPageRoute(file) || didSyncAnyRoute
        }

        if (!didSyncAnyRoute) {
          return
        }

        pagesTreeProvider.refresh()
        void refreshStatusBar()

        for (const document of vscode.workspace.textDocuments) {
          void refreshAppJsonDiagnostics(document)
          void refreshVuePageDiagnostics(document)
        }

        void syncPagesTreeState(pagesTreeProvider, pagesTreeView)
      })()
    }),
  ]

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, STATUS_BAR_PRIORITY)
  statusBarItem.command = 'weapp-vite.runAction'
  disposables.push(statusBarItem)

  void refreshStatusBar()
  void syncPagesTreeState(pagesTreeProvider, pagesTreeView)

  for (const document of vscode.workspace.textDocuments) {
    void refreshPackageJsonDiagnostics(document)
    void refreshAppJsonDiagnostics(document)
  }

  context.subscriptions.push(...disposables, pagesTreeView, getOutputChannel(), getDiagnostics(), {
    dispose() {
      state.terminalCache = undefined
      statusBarItem = undefined
      outputChannel = undefined
      diagnostics = undefined
    },
  })
}

export function deactivate() {}
