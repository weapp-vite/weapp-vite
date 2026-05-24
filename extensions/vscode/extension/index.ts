import type {
  WeappViteProjectCommandTarget,
  WeappViteProjectNode,
} from './ui/projectTree'

import type {
  WeappPagesTreeFilterMode,
} from './ui/tree'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import * as vscode from 'vscode'
import {
  buildAppJsonDiagnostics,
  buildPackageJsonDiagnostics,
  buildVuePageConfigConsistencyDiagnostics,
  buildVuePageDiagnostics,
  buildVueUsingComponentDiagnostics,
} from './editor/content'
import {
  WeappWxmlDocumentFormattingProvider,
} from './editor/format'
import {
  WeappViteAppJsonCompletionProvider,
  WeappViteAppJsonDocumentLinkProvider,
  WeappViteCodeActionProvider,
  WeappViteConfigCompletionProvider,
  WeappViteHoverProvider,
  WeappVitePackageJsonCompletionProvider,
  WeappViteVueCompletionProvider,
  WeappViteVueDocumentLinkProvider,
} from './editor/providers'
import {
  getPageFileCandidatePaths,
  getRouteFromPageFilePath,
} from './project/navigation'
import {
  clearProjectContextCache,
  findNearestWeappViteProjectWorkspaceFolder,
  getAppJsonTextWithMovedRoute,
  getAppJsonTextWithMovedRoutes,
  getAppJsonTextWithRemovedRoute,
  getAppJsonTextWithRemovedRoutes,
  getCurrentPageRouteCandidate,
  getMissingAppJsonPageRoutes,
  getMissingVueUsingComponents,
  getProjectAppJsonPath,
  getProjectContext,
  getProjectContextCandidates,
  getVueTextsWithMovedUsingComponentPath,
  getVueTextsWithRemovedUsingComponentPath,
  isAppJsonDocument,
  isPackageJsonDocument,
  isVueDocument,
} from './project/workspace'
import {
  isAppJsonDiagnosticsEnabled,
  isPackageJsonDiagnosticsEnabled,
  isStatusBarEnabled,
} from './shared/config'
import {
  OUTPUT_CHANNEL_NAME,
  STATUS_BAR_PRIORITY,
  VITE_CONFIG_FILE_PATTERN,
} from './shared/constants'
import {
  TemplateDecorationController,
} from './template/templateDecorations'
import {
  WeappTemplateCompletionProvider,
  WeappTemplateDefinitionProvider,
  WeappTemplateDocumentHighlightProvider,
  WeappTemplateDocumentLinkProvider,
  WeappTemplateHoverProvider,
  WeappTemplateReferenceProvider,
  WeappTemplateRenameProvider,
} from './template/templateProviders'
import {
  WeappTemplateScriptReferenceProvider,
  WeappTemplateScriptRenameProvider,
} from './template/templateScriptProviders'
import {
  addCurrentPageToAppJson,
  addPageToAppJsonFromTreeItem,
  copyCurrentPageRoute,
  copyPageRouteFromTreeItem,
  createComponentFromUsingComponents,
  createPageFromRoute,
  createPageFromTreeItem,
  generateMissingComponentsFromProject,
  generateMissingPagesFromAppJson,
  insertCommonScripts,
  insertDefineConfigTemplate,
  insertDefinePageJsonTemplate,
  openDocumentation,
  openPageFromRoute,
  openProjectFile,
  repairProjectIssues,
  revealCurrentPageInAppJson,
  revealPageRouteInAppJsonFromTreeItem,
  runWorkspaceCommand,
  showCommandPalette,
  showProjectOverview,
  syncUnregisteredPagesToAppJson,
} from './ui/commands'
import {
  generateComponentInExplorer,
  generatePageInExplorer,
  showGeneratePicker,
} from './ui/generate'
import {
  enableWeappViteFileIcons,
} from './ui/icons'
import {
  WeappViteProjectTreeProvider,
} from './ui/projectTree'
import {
  WeappVitePagesTreeProvider,
} from './ui/tree'

let outputChannel
let statusBarItem
let diagnostics

const viteConfigDocumentSelectors = [
  { language: 'javascript', scheme: 'file', pattern: '**/vite.config.*' },
  { language: 'typescript', scheme: 'file', pattern: '**/vite.config.*' },
  { language: 'javascript', scheme: 'file', pattern: '**/weapp-vite.config.*' },
  { language: 'typescript', scheme: 'file', pattern: '**/weapp-vite.config.*' },
]

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

async function resolveProjectWorkspaceFolderFromTarget(commandTarget?: WeappViteProjectCommandTarget) {
  const projectPath = commandTarget?.projectPath

  if (!projectPath) {
    return null
  }

  const contexts = await getProjectContextCandidates()
  const matchedContext = contexts.find(context => context.workspaceFolder.uri.fsPath === projectPath)

  return matchedContext?.workspaceFolder ?? null
}

async function selectProjectForPagesTree(
  pagesTreeProvider: WeappVitePagesTreeProvider,
  pagesTreeView: any,
  commandTarget?: WeappViteProjectCommandTarget,
) {
  const workspaceFolder = await resolveProjectWorkspaceFolderFromTarget(commandTarget)

  if (!workspaceFolder) {
    return
  }

  pagesTreeProvider.setProjectWorkspaceFolder(workspaceFolder)
  await syncPagesTreeState(pagesTreeProvider, pagesTreeView)
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

function createDebouncedTask(delay: number, task: () => void | Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined

  const schedule = () => {
    if (timer) {
      clearTimeout(timer)
    }

    timer = setTimeout(() => {
      timer = undefined
      void task()
    }, delay)
  }

  schedule.dispose = () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  return schedule
}

function getDocumentRefreshKey(document: any) {
  return document.uri?.toString?.() ?? document.uri?.fsPath ?? document.fileName
}

function createDebouncedDocumentTask(delay: number, task: (document: any) => void | Promise<void>) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const schedule = (document: any) => {
    const key = getDocumentRefreshKey(document)
    const pendingTimer = timers.get(key)

    if (pendingTimer) {
      clearTimeout(pendingTimer)
    }

    timers.set(key, setTimeout(() => {
      timers.delete(key)
      void task(document)
    }, delay))
  }

  schedule.dispose = () => {
    for (const timer of timers.values()) {
      clearTimeout(timer)
    }

    timers.clear()
  }

  return schedule
}

async function syncRenamedPageRoute(file: { oldUri: any, newUri: any }) {
  const projectFolder = await findNearestWeappViteProjectWorkspaceFolder(file.newUri.fsPath)

  if (!projectFolder) {
    return false
  }

  const appJsonUpdates = await getAppJsonTextWithMovedRoutes(projectFolder, file.oldUri.fsPath, file.newUri.fsPath)

  if (appJsonUpdates.length > 0) {
    for (const update of appJsonUpdates) {
      await writeTextFile(update.appJsonPath, update.nextText)
    }

    return true
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

async function syncRenamedUsingComponentPaths(file: { oldUri: any, newUri: any }) {
  const projectFolder = await findNearestWeappViteProjectWorkspaceFolder(file.newUri.fsPath)

  if (!projectFolder) {
    return false
  }

  const updates = await getVueTextsWithMovedUsingComponentPath(projectFolder, file.oldUri.fsPath, file.newUri.fsPath)

  if (updates.length === 0) {
    return false
  }

  for (const update of updates) {
    await writeTextFile(update.filePath, update.nextText)
  }

  return true
}

async function syncDeletedPageRoute(file: { fsPath: string }) {
  const projectFolder = await findNearestWeappViteProjectWorkspaceFolder(file.fsPath)

  if (!projectFolder) {
    return false
  }

  const appJsonUpdates = await getAppJsonTextWithRemovedRoutes(projectFolder, file.fsPath)

  if (appJsonUpdates.length > 0) {
    for (const update of appJsonUpdates) {
      await writeTextFile(update.appJsonPath, update.nextText)
    }

    return true
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

async function syncDeletedUsingComponentPaths(file: { fsPath: string }) {
  const projectFolder = await findNearestWeappViteProjectWorkspaceFolder(file.fsPath)

  if (!projectFolder) {
    return false
  }

  const updates = await getVueTextsWithRemovedUsingComponentPath(projectFolder, file.fsPath)

  if (updates.length === 0) {
    return false
  }

  for (const update of updates) {
    await writeTextFile(update.filePath, update.nextText)
  }

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
  const vueDocumentLinkProvider = new WeappViteVueDocumentLinkProvider()
  const wxmlDocumentFormattingProvider = new WeappWxmlDocumentFormattingProvider()
  const wxmlCompletionProvider = new WeappTemplateCompletionProvider()
  const wxmlHoverProvider = new WeappTemplateHoverProvider()
  const wxmlDocumentHighlightProvider = new WeappTemplateDocumentHighlightProvider()
  const wxmlDocumentLinkProvider = new WeappTemplateDocumentLinkProvider()
  const wxmlDefinitionProvider = new WeappTemplateDefinitionProvider()
  const wxmlReferenceProvider = new WeappTemplateReferenceProvider()
  const wxmlRenameProvider = new WeappTemplateRenameProvider()
  const wxmlScriptReferenceProvider = new WeappTemplateScriptReferenceProvider()
  const wxmlScriptRenameProvider = new WeappTemplateScriptRenameProvider()
  const templateDecorationController = new TemplateDecorationController()
  const projectTreeProvider = new WeappViteProjectTreeProvider()
  const projectTreeView = vscode.window.createTreeView('weapp-vite.project', {
    showCollapseAll: true,
    treeDataProvider: projectTreeProvider,
  })
  const pagesTreeProvider = new WeappVitePagesTreeProvider()
  const pagesTreeView = vscode.window.createTreeView('weapp-vite.pages', {
    showCollapseAll: true,
    treeDataProvider: pagesTreeProvider,
  })
  const state = {
    getOutputChannel,
    terminalCache: undefined,
  }
  const scheduleStatusBarRefresh = createDebouncedTask(250, refreshStatusBar)
  const schedulePagesTreeRefresh = createDebouncedTask(350, () => {
    pagesTreeProvider.refresh()
  })
  const schedulePagesTreeStateSync = createDebouncedDocumentTask(350, async (document) => {
    await syncPagesTreeState(pagesTreeProvider, pagesTreeView, document)
  })
  const schedulePackageJsonDiagnosticsRefresh = createDebouncedDocumentTask(300, refreshPackageJsonDiagnostics)
  const scheduleAppJsonDiagnosticsRefresh = createDebouncedDocumentTask(300, refreshAppJsonDiagnostics)
  const scheduleVuePageDiagnosticsRefresh = createDebouncedDocumentTask(450, refreshVuePageDiagnostics)
  const refreshProjectState = (refreshTree = true) => {
    clearProjectContextCache()
    scheduleStatusBarRefresh()

    if (refreshTree) {
      projectTreeProvider.refresh()
    }
  }
  const refreshPagesState = (document?: any) => {
    schedulePagesTreeRefresh()

    const targetDocument = document ?? vscode.window.activeTextEditor?.document

    if (targetDocument) {
      schedulePagesTreeStateSync(targetDocument)
    }
  }
  const disposables = [
    vscode.commands.registerCommand('weapp-vite.generate', resourceUri => showGeneratePicker(state, resourceUri)),
    vscode.commands.registerCommand('weapp-vite.dev', commandTarget => runWorkspaceCommand('dev', state, commandTarget)),
    vscode.commands.registerCommand('weapp-vite.build', commandTarget => runWorkspaceCommand('build', state, commandTarget)),
    vscode.commands.registerCommand('weapp-vite.open', commandTarget => runWorkspaceCommand('open', state, commandTarget)),
    vscode.commands.registerCommand('weapp-vite.useFileIcons', () => enableWeappViteFileIcons()),
    vscode.commands.registerCommand('weapp-vite.doctor', commandTarget => runWorkspaceCommand('doctor', state, commandTarget)),
    vscode.commands.registerCommand('weapp-vite.selectProject', commandTarget => selectProjectForPagesTree(pagesTreeProvider, pagesTreeView, commandTarget)),
    vscode.commands.registerCommand('weapp-vite.showProjectInfo', commandTarget => showProjectOverview(state, commandTarget)),
    vscode.commands.registerCommand('weapp-vite.showOutput', () => getOutputChannel().show(true)),
    vscode.commands.registerCommand('weapp-vite.runAction', () => showCommandPalette(state)),
    vscode.commands.registerCommand('weapp-vite.insertDefineConfigTemplate', () => insertDefineConfigTemplate()),
    vscode.commands.registerCommand('weapp-vite.insertDefinePageJsonTemplate', () => insertDefinePageJsonTemplate()),
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
    vscode.commands.registerCommand('weapp-vite.openProjectFile', commandTarget => openProjectFile(state, commandTarget)),
    vscode.commands.registerCommand('weapp-vite.copyCurrentPageRoute', () => copyCurrentPageRoute(state)),
    vscode.commands.registerCommand('weapp-vite.copyPageRouteFromTreeItem', item => copyPageRouteFromTreeItem(item, state)),
    vscode.commands.registerCommand('weapp-vite.revealCurrentPageInAppJson', () => revealCurrentPageInAppJson(state)),
    vscode.commands.registerCommand('weapp-vite.revealCurrentPageInPagesTree', () => revealCurrentPageInPagesTree(pagesTreeProvider, pagesTreeView)),
    vscode.commands.registerCommand('weapp-vite.refreshPagesTree', () => refreshPagesTree(pagesTreeProvider, pagesTreeView)),
    vscode.commands.registerCommand('weapp-vite.filterProblemPagesInTree', () => applyPagesTreeFilter(pagesTreeProvider, pagesTreeView, 'problems')),
    vscode.commands.registerCommand('weapp-vite.filterCurrentPageInTree', () => applyPagesTreeFilter(pagesTreeProvider, pagesTreeView, 'current')),
    vscode.commands.registerCommand('weapp-vite.clearPagesTreeFilter', () => clearPagesTreeFilter(pagesTreeProvider, pagesTreeView)),
    vscode.commands.registerCommand('weapp-vite.repairProjectIssues', () => repairProjectIssues(state)),
    vscode.commands.registerCommand('weapp-vite.generateMissingComponentsFromProject', () => generateMissingComponentsFromProject(state)),
    vscode.commands.registerCommand('weapp-vite.generateMissingPagesFromAppJson', () => generateMissingPagesFromAppJson(state)),
    vscode.commands.registerCommand('weapp-vite.syncUnregisteredPagesToAppJson', () => syncUnregisteredPagesToAppJson(state)),
    vscode.commands.registerCommand('weapp-vite.revealPageRouteInAppJsonFromTreeItem', item => revealPageRouteInAppJsonFromTreeItem(item, state)),
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
    vscode.languages.registerDocumentLinkProvider(
      { language: 'vue', scheme: 'file' },
      vueDocumentLinkProvider,
    ),
    vscode.languages.registerDocumentFormattingEditProvider(
      { language: 'wxml', scheme: 'file' },
      wxmlDocumentFormattingProvider,
    ),
    vscode.languages.registerDocumentLinkProvider(
      [
        { language: 'vue', scheme: 'file' },
        { language: 'wxml', scheme: 'file' },
      ],
      wxmlDocumentLinkProvider,
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
      viteConfigDocumentSelectors,
      viteConfigCompletionProvider,
      'g',
      'p',
      '{',
      '\n',
    ),
    vscode.languages.registerCompletionItemProvider(
      [
        { language: 'vue', scheme: 'file' },
        { language: 'wxml', scheme: 'file' },
      ],
      wxmlCompletionProvider,
      '<',
      ' ',
      ':',
      '@',
      '.',
      '-',
      '"',
      '\'',
    ),
    vscode.languages.registerHoverProvider(
      [
        { language: 'json', scheme: 'file', pattern: '**/package.json' },
        { language: 'jsonc', scheme: 'file', pattern: '**/package.json' },
        ...viteConfigDocumentSelectors,
        { language: 'vue', scheme: 'file' },
      ],
      hoverProvider,
    ),
    vscode.languages.registerHoverProvider(
      [
        { language: 'vue', scheme: 'file' },
        { language: 'wxml', scheme: 'file' },
      ],
      wxmlHoverProvider,
    ),
    vscode.languages.registerDocumentHighlightProvider(
      [
        { language: 'vue', scheme: 'file' },
        { language: 'wxml', scheme: 'file' },
      ],
      wxmlDocumentHighlightProvider,
    ),
    vscode.languages.registerDefinitionProvider(
      [
        { language: 'vue', scheme: 'file' },
        { language: 'wxml', scheme: 'file' },
      ],
      wxmlDefinitionProvider,
    ),
    vscode.languages.registerReferenceProvider(
      [
        { language: 'vue', scheme: 'file' },
        { language: 'wxml', scheme: 'file' },
      ],
      wxmlReferenceProvider,
    ),
    vscode.languages.registerReferenceProvider(
      [
        { language: 'javascript', scheme: 'file' },
        { language: 'typescript', scheme: 'file' },
        { language: 'vue', scheme: 'file' },
      ],
      wxmlScriptReferenceProvider,
    ),
    vscode.languages.registerRenameProvider(
      [
        { language: 'vue', scheme: 'file' },
        { language: 'wxml', scheme: 'file' },
      ],
      wxmlRenameProvider,
    ),
    vscode.languages.registerRenameProvider(
      [
        { language: 'javascript', scheme: 'file' },
        { language: 'typescript', scheme: 'file' },
        { language: 'vue', scheme: 'file' },
      ],
      wxmlScriptRenameProvider,
    ),
    vscode.window.onDidChangeActiveTextEditor(() => {
      scheduleStatusBarRefresh()
      refreshPagesState()
    }),
    projectTreeView.onDidChangeSelection((event: { selection?: readonly WeappViteProjectNode[] }) => {
      const [selectedNode] = event.selection ?? []
      const commandTarget = selectedNode?.commandTarget

      if (commandTarget?.projectPath) {
        void selectProjectForPagesTree(pagesTreeProvider, pagesTreeView, commandTarget)
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      refreshProjectState()
      refreshPagesState()
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('weapp-vite')) {
        refreshProjectState()
        refreshPagesState()

        for (const document of vscode.workspace.textDocuments) {
          schedulePackageJsonDiagnosticsRefresh(document)
          scheduleAppJsonDiagnosticsRefresh(document)
          scheduleVuePageDiagnosticsRefresh(document)
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

      if (isPackageJsonDocument(document) || VITE_CONFIG_FILE_PATTERN.test(document.fileName)) {
        refreshProjectState()
      }

      if (isAppJsonDocument(document) || isVueDocument(document)) {
        refreshPagesState(document)
      }
    }),
    vscode.workspace.onDidOpenTextDocument((document) => {
      void refreshPackageJsonDiagnostics(document)
      void refreshAppJsonDiagnostics(document)
      void refreshVuePageDiagnostics(document)
      if (isAppJsonDocument(document) || isVueDocument(document)) {
        refreshPagesState(document)
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      schedulePackageJsonDiagnosticsRefresh(event.document)
      scheduleAppJsonDiagnosticsRefresh(event.document)
      scheduleVuePageDiagnosticsRefresh(event.document)
      if (isPackageJsonDocument(event.document) || VITE_CONFIG_FILE_PATTERN.test(event.document.fileName)) {
        refreshProjectState(false)
      }

      if (isAppJsonDocument(event.document) || isVueDocument(event.document)) {
        refreshPagesState(event.document)
      }
    }),
    vscode.workspace.onDidRenameFiles((event) => {
      void (async () => {
        let didSyncAnyRoute = false

        for (const file of event.files) {
          didSyncAnyRoute = await syncRenamedPageRoute(file) || didSyncAnyRoute
          didSyncAnyRoute = await syncRenamedUsingComponentPaths(file) || didSyncAnyRoute
        }

        if (!didSyncAnyRoute) {
          return
        }

        refreshProjectState()

        for (const document of vscode.workspace.textDocuments) {
          void refreshAppJsonDiagnostics(document)
          void refreshVuePageDiagnostics(document)
        }

        refreshPagesState()
      })()
    }),
    vscode.workspace.onDidDeleteFiles((event) => {
      void (async () => {
        let didSyncAnyRoute = false

        for (const file of event.files) {
          didSyncAnyRoute = await syncDeletedPageRoute(file) || didSyncAnyRoute
          didSyncAnyRoute = await syncDeletedUsingComponentPaths(file) || didSyncAnyRoute
        }

        if (!didSyncAnyRoute) {
          return
        }

        refreshProjectState()

        for (const document of vscode.workspace.textDocuments) {
          void refreshAppJsonDiagnostics(document)
          void refreshVuePageDiagnostics(document)
        }

        refreshPagesState()
      })()
    }),
    {
      dispose() {
        scheduleStatusBarRefresh.dispose()
        schedulePagesTreeRefresh.dispose()
        schedulePagesTreeStateSync.dispose()
        schedulePackageJsonDiagnosticsRefresh.dispose()
        scheduleAppJsonDiagnosticsRefresh.dispose()
        scheduleVuePageDiagnosticsRefresh.dispose()
      },
    },
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

  context.subscriptions.push(...disposables, projectTreeView, pagesTreeView, getDiagnostics(), {
    dispose() {
      templateDecorationController.dispose()
      state.terminalCache = undefined
      statusBarItem = undefined
      outputChannel = undefined
      diagnostics = undefined
    },
  })
}

export function deactivate() {}
