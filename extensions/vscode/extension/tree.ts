import path from 'node:path'
import vscode from 'vscode'

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

function createPageNode(
  route: string,
  pageFilePath: string | null,
  appJsonPath: string,
  workspacePath: string,
  status: WeappPagesTreePageNode['status'],
  current: boolean,
): WeappPagesTreeNode {
  return {
    kind: 'page',
    label: route,
    appJsonPath,
    current,
    description: getPageNodeDescription(pageFilePath, workspacePath),
    pageFilePath,
    route,
    status,
    tooltip: pageFilePath
      ? `route: ${route}\n页面文件: ${path.relative(workspacePath, pageFilePath)}`
      : `route: ${route}\n页面文件缺失，点击后打开 app.json`,
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
        ? [element.description, '当前页面'].filter(Boolean).join(' · ')
        : element.description
      item.contextValue = `weappPage.${element.status}`
      item.iconPath = element.current
        ? new vscode.ThemeIcon('target')
        : new vscode.ThemeIcon(
            element.status === 'missing'
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
      return element.children
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
    const createTrackedPageNode = (
      route: string,
      pageFilePath: string | null,
      status: WeappPagesTreePageNode['status'],
    ) => {
      const node = createPageNode(
        route,
        pageFilePath,
        snapshot.appJsonPath,
        workspacePath,
        status,
        route === this.currentRoute,
      ) as WeappPagesTreePageNode

      this.pageNodesByRoute.set(route, node)
      return node
    }

    rootNodes.push({
      kind: 'group',
      label: 'App Pages',
      description: `${snapshot.topLevelPages.length} 个页面`,
      children: snapshot.topLevelPages.map(page => createTrackedPageNode(
        page.route,
        page.pageFilePath,
        page.pageFilePath ? 'exists' : 'missing',
      )),
    })

    rootNodes.push({
      kind: 'group',
      label: 'Subpackages',
      description: `${snapshot.subpackages.length} 个分包`,
      children: snapshot.subpackages.map(subPackage => ({
        kind: 'subpackage',
        label: subPackage.root,
        description: `${subPackage.pages.length} 个页面`,
        children: subPackage.pages.map(page => createTrackedPageNode(
          page.route,
          page.pageFilePath,
          page.pageFilePath ? 'exists' : 'missing',
        )),
      })),
    })

    if (snapshot.unregisteredPages.length > 0) {
      rootNodes.push({
        kind: 'group',
        label: 'Unregistered Pages',
        description: `${snapshot.unregisteredPages.length} 个页面`,
        children: snapshot.unregisteredPages.map(page => createTrackedPageNode(
          page.route,
          page.pageFilePath,
          'unregistered',
        )),
      })
    }

    return rootNodes
  }
}
