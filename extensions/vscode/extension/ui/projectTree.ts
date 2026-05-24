import * as vscode from 'vscode'

import {
  getPrimaryWorkspaceFolder,
  getProjectContextCandidates,
} from '../project/workspace'
import {
  getRelativeDisplayPath,
} from '../shared/pathUtils'

export interface WeappViteProjectCommandTarget {
  projectPath?: string
}

interface WeappViteProjectBaseNode {
  command?: string
  commandTarget?: WeappViteProjectCommandTarget
  contextValue: string
  description?: string
  iconId: string
  label: string
  defaultExpanded?: boolean
  tooltip?: string
}

interface WeappViteProjectGroupNode extends WeappViteProjectBaseNode {
  children: WeappViteProjectNode[]
  kind: 'group'
}

interface WeappViteProjectActionNode extends WeappViteProjectBaseNode {
  kind: 'action' | 'info'
}

export type WeappViteProjectNode = WeappViteProjectActionNode | WeappViteProjectGroupNode

function hasAnyScript(scripts: Record<string, string> | undefined, candidates: string[]) {
  return candidates.some(candidate => typeof scripts?.[candidate] === 'string')
}

export class WeappViteProjectTreeProvider implements vscode.TreeDataProvider<WeappViteProjectNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<WeappViteProjectNode | undefined>()

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event

  refresh() {
    this.onDidChangeTreeDataEmitter.fire(undefined)
  }

  getTreeItem(element: WeappViteProjectNode) {
    const collapsibleState = element.kind === 'group'
      ? element.defaultExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None
    const item = new vscode.TreeItem(element.label, collapsibleState)

    item.contextValue = element.contextValue
    item.description = element.description
    item.iconPath = new vscode.ThemeIcon(element.iconId)
    item.tooltip = element.tooltip

    if (element.command) {
      item.command = {
        arguments: element.commandTarget ? [element.commandTarget] : undefined,
        command: element.command,
        title: element.label,
      }
    }

    return item
  }

  async getChildren(element?: WeappViteProjectNode) {
    if (element) {
      return 'children' in element ? element.children : []
    }

    const workspaceFolder = getPrimaryWorkspaceFolder()

    if (!workspaceFolder) {
      return [
        {
          kind: 'info',
          label: '未打开工作区',
          contextValue: 'weappProject.empty',
          iconId: 'folder',
          tooltip: '请先打开一个 weapp-vite 项目工作区。',
        },
      ] satisfies WeappViteProjectNode[]
    }

    const contexts = await getProjectContextCandidates(workspaceFolder)

    if (contexts.length === 0) {
      return [
        {
          kind: 'info',
          label: '未识别为 weapp-vite 项目',
          description: workspaceFolder.name,
          contextValue: 'weappProject.unrecognized',
          iconId: 'warning',
          tooltip: '当前工作区未发现 weapp-vite 依赖、脚本或配置文件信号。',
        },
        {
          kind: 'action',
          label: '打开文档',
          command: 'weapp-vite.openDocs',
          contextValue: 'weappProject.action',
          iconId: 'book',
        },
      ] satisfies WeappViteProjectNode[]
    }

    return contexts.map((context) => {
      const projectPath = context.workspaceFolder.uri.fsPath
      const relativePath = getRelativeDisplayPath(workspaceFolder.uri.fsPath, projectPath)
      const commandTarget = {
        projectPath,
      }
      const actionNodes: WeappViteProjectNode[] = [
        {
          kind: 'action',
          label: '打开项目文件',
          command: 'weapp-vite.openProjectFile',
          commandTarget,
          contextValue: 'weappProject.action',
          iconId: 'go-to-file',
        },
        {
          kind: 'action',
          label: '查看 Pages',
          command: 'weapp-vite.selectProject',
          commandTarget,
          contextValue: 'weappProject.action',
          iconId: 'list-tree',
        },
      ]

      if (hasAnyScript(context.scripts, ['dev', 'dev:open'])) {
        actionNodes.push({
          kind: 'action',
          label: 'Dev',
          command: 'weapp-vite.dev',
          commandTarget,
          contextValue: 'weappProject.action',
          iconId: 'debug-start',
        })
      }

      if (hasAnyScript(context.scripts, ['build'])) {
        actionNodes.push({
          kind: 'action',
          label: 'Build',
          command: 'weapp-vite.build',
          commandTarget,
          contextValue: 'weappProject.action',
          iconId: 'tools',
        })
      }

      if (hasAnyScript(context.scripts, ['open'])) {
        actionNodes.push({
          kind: 'action',
          label: 'Open DevTools',
          command: 'weapp-vite.open',
          commandTarget,
          contextValue: 'weappProject.action',
          iconId: 'device-mobile',
        })
      }

      if (hasAnyScript(context.scripts, ['doctor', 'info'])) {
        actionNodes.push({
          kind: 'action',
          label: 'Doctor / Info',
          command: 'weapp-vite.doctor',
          commandTarget,
          contextValue: 'weappProject.action',
          iconId: 'pulse',
        })
      }

      if (hasAnyScript(context.scripts, ['generate', 'g'])) {
        actionNodes.push({
          kind: 'action',
          label: 'Generate',
          command: 'weapp-vite.generate',
          commandTarget,
          contextValue: 'weappProject.action',
          iconId: 'new-file',
        })
      }

      actionNodes.push(
        {
          kind: 'action',
          label: '修复项目问题',
          command: 'weapp-vite.repairProjectIssues',
          commandTarget,
          contextValue: 'weappProject.action',
          iconId: 'wrench',
        },
        {
          kind: 'action',
          label: '生成缺失页面',
          command: 'weapp-vite.generateMissingPagesFromAppJson',
          commandTarget,
          contextValue: 'weappProject.action',
          iconId: 'diff-added',
        },
        {
          kind: 'action',
          label: '生成缺失组件',
          command: 'weapp-vite.generateMissingComponentsFromProject',
          commandTarget,
          contextValue: 'weappProject.action',
          iconId: 'symbol-method',
        },
        {
          kind: 'action',
          label: '同步未注册页面',
          command: 'weapp-vite.syncUnregisteredPagesToAppJson',
          commandTarget,
          contextValue: 'weappProject.action',
          iconId: 'sync',
        },
      )

      return {
        kind: 'group',
        label: context.workspaceFolder.name,
        command: 'weapp-vite.selectProject',
        commandTarget,
        description: relativePath || '.',
        contextValue: 'weappProject.project',
        iconId: 'root-folder',
        tooltip: projectPath,
        children: actionNodes,
      }
    }) satisfies WeappViteProjectNode[]
  }
}
