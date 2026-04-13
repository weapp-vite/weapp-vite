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
  badges: string[]
  baseStatus: 'exists' | 'missing' | 'unregistered'
  contextValue: string
  driftFields: string[]
  current: boolean
  iconId: string
  kind: 'page'
  pageFilePath: string | null
  route: string
  sortKey: string
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

function getPageNodeContextValue(
  baseStatus: WeappPagesTreePageNode['baseStatus'],
  current: boolean,
  driftFields: string[],
) {
  const parts = ['weappPage', baseStatus]

  if (driftFields.length > 0) {
    parts.push('drift')
  }

  if (current) {
    parts.push('current')
  }

  return parts.join('.')
}

function getPageNodeIconId(baseStatus: WeappPagesTreePageNode['baseStatus'], current: boolean, driftFields: string[]) {
  if (baseStatus === 'missing') {
    return 'warning'
  }

  if (baseStatus === 'unregistered') {
    return 'circle-outline'
  }

  if (driftFields.length > 0) {
    return 'alert'
  }

  if (current) {
    return 'target'
  }

  return 'file'
}

function getPageNodeBadges(baseStatus: WeappPagesTreePageNode['baseStatus'], current: boolean, driftFields: string[]) {
  const badges = []

  if (baseStatus === 'missing') {
    badges.push('缺少页面文件')
  }
  else if (baseStatus === 'unregistered') {
    badges.push('未声明')
  }

  if (driftFields.length > 0) {
    badges.push('配置漂移')
  }

  if (current) {
    badges.push('当前页面')
  }

  return badges
}

function getPageNodeSortKey(baseStatus: WeappPagesTreePageNode['baseStatus'], current: boolean, driftFields: string[], route: string) {
  const priority = baseStatus === 'missing'
    ? 0
    : baseStatus === 'unregistered'
      ? 1
      : driftFields.length > 0
        ? 2
        : current
          ? 3
          : 4

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
  driftFields: string[],
): WeappPagesTreeNode {
  const primaryDescription = getPageNodeDescription(pageFilePath, workspacePath)
  const badges = getPageNodeBadges(baseStatus, current, driftFields)

  return {
    kind: 'page',
    label: route,
    appJsonPath,
    badges,
    baseStatus,
    contextValue: getPageNodeContextValue(baseStatus, current, driftFields),
    driftFields,
    current,
    description: [primaryDescription, ...badges.filter(badge => badge !== primaryDescription)].filter(Boolean).join(' · '),
    iconId: getPageNodeIconId(baseStatus, current, driftFields),
    pageFilePath,
    route,
    sortKey: getPageNodeSortKey(baseStatus, current, driftFields, route),
    tooltip: [
      `route: ${route}`,
      pageFilePath
        ? `页面文件: ${path.relative(workspacePath, pageFilePath)}`
        : '页面文件缺失，点击后打开 app.json',
      baseStatus === 'unregistered' ? '声明状态: 未加入 app.json' : '',
      driftFields.length > 0 ? `配置漂移: ${driftFields.join(', ')}` : '',
      current ? '当前页面: 是' : '',
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
      item.description = element.description
      item.contextValue = element.contextValue
      item.iconPath = new vscode.ThemeIcon(element.iconId)
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
      baseStatus: WeappPagesTreePageNode['baseStatus'],
    ) => {
      const driftFields = await getPageDriftFields(pageFilePath)
      const node = createPageNode(
        route,
        pageFilePath,
        snapshot.appJsonPath,
        workspacePath,
        baseStatus,
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
      children: sortPageNodes(await Promise.all(snapshot.topLevelPages.map(async page => createTrackedPageNode(
        page.route,
        page.pageFilePath,
        page.pageFilePath ? 'exists' : 'missing',
      )))),
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
          children: sortPageNodes(await Promise.all(subPackage.pages.map(async page => createTrackedPageNode(
            page.route,
            page.pageFilePath,
            page.pageFilePath ? 'exists' : 'missing',
          )))),
        }
      })),
    })

    if (snapshot.unregisteredPages.length > 0) {
      rootNodes.push({
        kind: 'group',
        label: 'Unregistered Pages',
        description: `${snapshot.unregisteredPages.length} 个页面`,
        children: sortPageNodes(await Promise.all(snapshot.unregisteredPages.map(async page => createTrackedPageNode(
          page.route,
          page.pageFilePath,
          'unregistered',
        )))),
      })
    }

    return rootNodes
  }
}
