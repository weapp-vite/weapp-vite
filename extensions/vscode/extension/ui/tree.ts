import * as vscode from 'vscode'

import {
  getPrimaryWorkspaceFolder,
  getWeappPagesTreeSnapshot,
} from '../project/workspace'
import {
  getRelativeDisplayPath,
} from '../shared/pathUtils'

interface WeappPagesTreeBaseNode {
  description?: string
  label: string
}

interface WeappPagesTreeGroupNode extends WeappPagesTreeBaseNode {
  children: WeappPagesTreeNode[]
  kind: 'group' | 'subpackage'
}

export type WeappPagesTreeFilterMode = 'all' | 'current' | 'problems'

interface WeappPagesTreeEmptyNode extends WeappPagesTreeBaseNode {
  contextValue: string
  kind: 'empty'
  tooltip: string
}

interface WeappPagesTreePageNode extends WeappPagesTreeBaseNode {
  appJsonPath: string
  badges: string[]
  baseStatus: 'exists' | 'missing' | 'unregistered'
  contextValue: string
  current: boolean
  iconId: string
  kind: 'page'
  pageFilePath: string | null
  route: string
  sortKey: string
  tooltip: string
}

type WeappPagesTreeNode = WeappPagesTreeEmptyNode | WeappPagesTreeGroupNode | WeappPagesTreePageNode

function getFilterModeLabel(filterMode: WeappPagesTreeFilterMode) {
  if (filterMode === 'current') {
    return '仅当前页'
  }

  if (filterMode === 'problems') {
    return '仅问题页'
  }

  return '全部页面'
}

function getPageNodeDescription(pageFilePath: string | null, workspacePath: string) {
  if (!pageFilePath) {
    return '缺少页面文件'
  }

  return getRelativeDisplayPath(workspacePath, pageFilePath)
}

function getPageNodeContextValue(
  baseStatus: WeappPagesTreePageNode['baseStatus'],
  current: boolean,
) {
  const parts = ['weappPage', baseStatus]

  if (current) {
    parts.push('current')
  }

  return parts.join('.')
}

function getPageNodeIconId(baseStatus: WeappPagesTreePageNode['baseStatus'], current: boolean) {
  if (baseStatus === 'missing') {
    return 'warning'
  }

  if (baseStatus === 'unregistered') {
    return 'circle-outline'
  }

  if (current) {
    return 'target'
  }

  return 'file'
}

function getPageNodeBadges(baseStatus: WeappPagesTreePageNode['baseStatus'], current: boolean) {
  const badges = []

  if (baseStatus === 'missing') {
    badges.push('缺少页面文件')
  }
  else if (baseStatus === 'unregistered') {
    badges.push('未声明')
  }

  if (current) {
    badges.push('当前页面')
  }

  return badges
}

function getPageNodeSortKey(baseStatus: WeappPagesTreePageNode['baseStatus'], current: boolean, route: string) {
  const priority = baseStatus === 'missing'
    ? 0
    : baseStatus === 'unregistered'
      ? 1
      : current
        ? 2
        : 3

  return `${priority}-${route}`
}

function sortPageNodes<T extends WeappPagesTreePageNode>(nodes: T[]) {
  return [...nodes].sort((left, right) => left.sortKey.localeCompare(right.sortKey))
}

function createPageNode(
  route: string,
  pageFilePath: string | null,
  appJsonPath: string,
  workspacePath: string,
  baseStatus: WeappPagesTreePageNode['baseStatus'],
  current: boolean,
): WeappPagesTreeNode {
  const primaryDescription = getPageNodeDescription(pageFilePath, workspacePath)
  const badges = getPageNodeBadges(baseStatus, current)

  return {
    kind: 'page',
    label: route,
    appJsonPath,
    badges,
    baseStatus,
    contextValue: getPageNodeContextValue(baseStatus, current),
    current,
    description: [primaryDescription, ...badges.filter(badge => badge !== primaryDescription)].filter(Boolean).join(' · '),
    iconId: getPageNodeIconId(baseStatus, current),
    pageFilePath,
    route,
    sortKey: getPageNodeSortKey(baseStatus, current, route),
    tooltip: [
      `route: ${route}`,
      pageFilePath
        ? `页面文件: ${getRelativeDisplayPath(workspacePath, pageFilePath)}`
        : '页面文件缺失，点击后打开 app.json',
      baseStatus === 'unregistered' ? '声明状态: 未加入 app.json' : '',
      current ? '当前页面: 是' : '',
    ].filter(Boolean).join('\n'),
  }
}

export class WeappVitePagesTreeProvider implements vscode.TreeDataProvider<WeappPagesTreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<WeappPagesTreeNode | undefined>()
  private currentRoute: string | null = null
  private filterMode: WeappPagesTreeFilterMode = 'all'
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

  setFilterMode(filterMode: WeappPagesTreeFilterMode) {
    if (this.filterMode === filterMode) {
      return
    }

    this.filterMode = filterMode
    this.refresh()
  }

  clearFilterMode() {
    this.setFilterMode('all')
  }

  getFilterMode() {
    return this.filterMode
  }

  getPageNodeByRoute(route: string) {
    return this.pageNodesByRoute.get(route) ?? null
  }

  async resolvePageNodeByRoute(route: string) {
    const cachedNode = this.getPageNodeByRoute(route)

    if (cachedNode) {
      return cachedNode
    }

    await this.getChildren()
    return this.getPageNodeByRoute(route)
  }

  getTreeItem(element: WeappPagesTreeNode) {
    const collapsibleState = element.kind === 'page' || element.kind === 'empty'
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
      item.description = element.description
      item.contextValue = element.contextValue
      item.iconPath = new vscode.ThemeIcon(element.iconId)
      item.resourceUri = element.pageFilePath ? targetUri : undefined
      item.tooltip = element.tooltip
    }
    else if (element.kind === 'empty') {
      item.command = {
        command: 'weapp-vite.clearPagesTreeFilter',
        title: '清除 Pages 筛选',
      }
      item.contextValue = element.contextValue
      item.iconPath = new vscode.ThemeIcon('filter')
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
      baseStatus: WeappPagesTreePageNode['baseStatus'],
    ) => {
      const node = createPageNode(
        route,
        pageFilePath,
        snapshot.appJsonPath,
        workspacePath,
        baseStatus,
        route === this.currentRoute,
      ) as WeappPagesTreePageNode

      this.pageNodesByRoute.set(route, node)
      return node
    }
    const filterPageNodes = <T extends WeappPagesTreePageNode>(nodes: T[]) => {
      if (this.filterMode === 'all') {
        return nodes
      }

      return nodes.filter((node) => {
        if (this.filterMode === 'current') {
          return node.current
        }

        return node.baseStatus !== 'exists'
      })
    }
    const createPageGroupNode = (label: string, descriptionLabel: string, children: WeappPagesTreePageNode[]): WeappPagesTreeGroupNode | null => {
      const filteredChildren = sortPageNodes(filterPageNodes(children))

      if (filteredChildren.length === 0) {
        return null
      }

      return {
        kind: 'group',
        label,
        description: `${filteredChildren.length} 个${descriptionLabel}`,
        children: filteredChildren,
      }
    }
    const topLevelPages = await Promise.all(snapshot.topLevelPages.map(async page => createTrackedPageNode(
      page.route,
      page.pageFilePath,
      page.pageFilePath ? 'exists' : 'missing',
    )))

    const appPagesGroup = createPageGroupNode('App Pages', '页面', topLevelPages)

    if (appPagesGroup) {
      rootNodes.push(appPagesGroup)
    }

    const subpackageNodes = (await Promise.all(snapshot.subpackages.map(async (subPackage) => {
      const pages = await Promise.all(subPackage.pages.map(async page => createTrackedPageNode(
        page.route,
        page.pageFilePath,
        page.pageFilePath ? 'exists' : 'missing',
      )))
      const filteredChildren = sortPageNodes(filterPageNodes(pages))

      if (filteredChildren.length === 0) {
        return null
      }

      return {
        kind: 'subpackage',
        label: subPackage.root,
        description: `${filteredChildren.length} 个页面`,
        children: filteredChildren,
      } satisfies WeappPagesTreeGroupNode
    }))).filter(Boolean) as WeappPagesTreeGroupNode[]

    if (subpackageNodes.length > 0) {
      rootNodes.push({
        kind: 'group',
        label: 'Subpackages',
        description: `${subpackageNodes.length} 个分包`,
        children: subpackageNodes,
      })
    }

    if (snapshot.unregisteredPages.length > 0) {
      const unregisteredPages = await Promise.all(snapshot.unregisteredPages.map(async page => createTrackedPageNode(
        page.route,
        page.pageFilePath,
        'unregistered',
      )))
      const unregisteredGroup = createPageGroupNode('Unregistered Pages', '页面', unregisteredPages)

      if (unregisteredGroup) {
        rootNodes.push(unregisteredGroup)
      }
    }

    if (rootNodes.length === 0 && this.filterMode !== 'all') {
      const emptyNode: WeappPagesTreeEmptyNode = {
        kind: 'empty',
        label: '当前筛选没有匹配页面',
        description: getFilterModeLabel(this.filterMode),
        contextValue: 'weappPages.emptyFilter',
        tooltip: `当前筛选: ${getFilterModeLabel(this.filterMode)}\n点击后清除筛选并恢复完整页面树。`,
      }

      return [emptyNode]
    }

    return rootNodes
  }
}
