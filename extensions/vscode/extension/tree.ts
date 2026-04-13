import { Buffer } from 'node:buffer'
import path from 'node:path'
import vscode from 'vscode'

import {
  getVuePageConfigDriftFields,
} from './content'
import {
  getPrimaryWorkspaceFolder,
  getWeappPagesTreeSnapshot,
} from './workspace'

interface WeappPagesTreeBaseNode {
  description?: string
  label: string
}

interface WeappPagesTreeGroupNode extends WeappPagesTreeBaseNode {
  children: WeappPagesTreeNode[]
  kind: 'group' | 'subpackage'
}

interface WeappPagesTreePageNode extends WeappPagesTreeBaseNode {
  appJsonPath: string
  driftFields: string[]
  current: boolean
  kind: 'page'
  pageFilePath: string | null
  route: string
  status: 'exists' | 'missing' | 'unregistered'
  tooltip: string
}

type WeappPagesTreeNode = WeappPagesTreeGroupNode | WeappPagesTreePageNode

function getPageNodeDescription(pageFilePath: string | null, workspacePath: string) {
  if (!pageFilePath) {
    return '缺少页面文件'
  }

  return path.relative(workspacePath, pageFilePath)
}

async function getPageDriftFields(pageFilePath: string | null) {
  if (!pageFilePath || path.extname(pageFilePath) !== '.vue') {
    return []
  }

  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(pageFilePath))
    return getVuePageConfigDriftFields(Buffer.from(bytes).toString('utf8'))
  }
  catch {
    return []
  }
}

function createPageNode(
  route: string,
  pageFilePath: string | null,
  appJsonPath: string,
  workspacePath: string,
  status: WeappPagesTreePageNode['status'],
  current: boolean,
  driftFields: string[],
): WeappPagesTreeNode {
  return {
    kind: 'page',
    label: route,
    appJsonPath,
    driftFields,
    current,
    description: getPageNodeDescription(pageFilePath, workspacePath),
    pageFilePath,
    route,
    status,
    tooltip: [
      `route: ${route}`,
      pageFilePath
        ? `页面文件: ${path.relative(workspacePath, pageFilePath)}`
        : '页面文件缺失，点击后打开 app.json',
      driftFields.length > 0 ? `配置漂移: ${driftFields.join(', ')}` : '',
    ].filter(Boolean).join('\n'),
  }
}

export class WeappVitePagesTreeProvider implements vscode.TreeDataProvider<WeappPagesTreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<WeappPagesTreeNode | undefined>()
  private currentRoute: string | null = null
  private pageNodesByRoute = new Map<string, WeappPagesTreePageNode>()

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event

  refresh() {
    this.pageNodesByRoute.clear()
    this.onDidChangeTreeDataEmitter.fire(undefined)
  }

  setCurrentRoute(route: string | null) {
    if (this.currentRoute === route) {
      return
    }

    this.currentRoute = route
    this.refresh()
  }

  getPageNodeByRoute(route: string) {
    return this.pageNodesByRoute.get(route) ?? null
  }

  getTreeItem(element: WeappPagesTreeNode) {
    const collapsibleState = element.kind === 'page'
      ? vscode.TreeItemCollapsibleState.None
      : vscode.TreeItemCollapsibleState.Expanded
    const item = new vscode.TreeItem(element.label, collapsibleState)

    item.description = element.description

    if (element.kind === 'page') {
      const targetUri = vscode.Uri.file(element.pageFilePath ?? element.appJsonPath)

      item.command = {
        command: 'vscode.open',
        title: element.pageFilePath ? '打开页面文件' : '打开 app.json',
        arguments: [targetUri],
      }
      item.description = element.current
        ? [element.description, element.driftFields.length > 0 ? '配置漂移' : '', '当前页面'].filter(Boolean).join(' · ')
        : [element.description, element.driftFields.length > 0 ? '配置漂移' : ''].filter(Boolean).join(' · ')
      item.contextValue = element.driftFields.length > 0
        ? `weappPage.${element.status}.drift`
        : `weappPage.${element.status}`
      item.iconPath = element.current
        ? new vscode.ThemeIcon('target')
        : new vscode.ThemeIcon(
            element.driftFields.length > 0
              ? 'alert'
              : element.status === 'missing'
                ? 'warning'
                : element.status === 'unregistered'
                  ? 'circle-outline'
                  : 'file',
          )
      item.resourceUri = element.pageFilePath ? targetUri : undefined
      item.tooltip = element.tooltip
    }
    else {
      item.contextValue = element.kind === 'group' ? 'weappPages.group' : 'weappPages.subpackage'
    }

    return item
  }

  async getChildren(element?: WeappPagesTreeNode) {
    if (element) {
      return 'children' in element ? element.children : []
    }

    const workspaceFolder = getPrimaryWorkspaceFolder()

    if (!workspaceFolder) {
      return []
    }

    const snapshot = await getWeappPagesTreeSnapshot(workspaceFolder)

    if (!snapshot) {
      return []
    }

    const workspacePath = snapshot.workspaceFolder.uri.fsPath
    const rootNodes: WeappPagesTreeNode[] = []
    this.pageNodesByRoute.clear()
    const createTrackedPageNode = async (
      route: string,
      pageFilePath: string | null,
      status: WeappPagesTreePageNode['status'],
    ) => {
      const driftFields = await getPageDriftFields(pageFilePath)
      const node = createPageNode(
        route,
        pageFilePath,
        snapshot.appJsonPath,
        workspacePath,
        status,
        route === this.currentRoute,
        driftFields,
      ) as WeappPagesTreePageNode

      this.pageNodesByRoute.set(route, node)
      return node
    }

    rootNodes.push({
      kind: 'group',
      label: 'App Pages',
      description: `${snapshot.topLevelPages.length} 个页面`,
      children: await Promise.all(snapshot.topLevelPages.map(async page => createTrackedPageNode(
        page.route,
        page.pageFilePath,
        page.pageFilePath ? 'exists' : 'missing',
      ))),
    })

    rootNodes.push({
      kind: 'group',
      label: 'Subpackages',
      description: `${snapshot.subpackages.length} 个分包`,
      children: await Promise.all(snapshot.subpackages.map(async (subPackage) => {
        return {
          kind: 'subpackage',
          label: subPackage.root,
          description: `${subPackage.pages.length} 个页面`,
          children: await Promise.all(subPackage.pages.map(async page => createTrackedPageNode(
            page.route,
            page.pageFilePath,
            page.pageFilePath ? 'exists' : 'missing',
          ))),
        }
      })),
    })

    if (snapshot.unregisteredPages.length > 0) {
      rootNodes.push({
        kind: 'group',
        label: 'Unregistered Pages',
        description: `${snapshot.unregisteredPages.length} 个页面`,
        children: await Promise.all(snapshot.unregisteredPages.map(async page => createTrackedPageNode(
          page.route,
          page.pageFilePath,
          'unregistered',
        ))),
      })
    }

    return rootNodes
  }
}
