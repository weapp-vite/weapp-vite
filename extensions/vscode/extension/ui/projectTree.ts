import * as vscode from 'vscode'

import {
  getPrimaryWorkspaceFolder,
  getProjectContext,
} from '../project/workspace'

interface WeappViteProjectBaseNode {
  command?: string
  contextValue: string
  description?: string
  iconId: string
  label: string
  tooltip?: string
}

interface WeappViteProjectGroupNode extends WeappViteProjectBaseNode {
  children: WeappViteProjectNode[]
  kind: 'group'
}

interface WeappViteProjectActionNode extends WeappViteProjectBaseNode {
  kind: 'action' | 'info'
}

type WeappViteProjectNode = WeappViteProjectActionNode | WeappViteProjectGroupNode

export class WeappViteProjectTreeProvider implements vscode.TreeDataProvider<WeappViteProjectNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<WeappViteProjectNode | undefined>()

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event

  refresh() {
    this.onDidChangeTreeDataEmitter.fire(undefined)
  }

  getTreeItem(element: WeappViteProjectNode) {
    const collapsibleState = element.kind === 'group'
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None
    const item = new vscode.TreeItem(element.label, collapsibleState)

    item.contextValue = element.contextValue
    item.description = element.description
    item.iconPath = new vscode.ThemeIcon(element.iconId)
    item.tooltip = element.tooltip

    if (element.command) {
      item.command = {
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

    const context = await getProjectContext(workspaceFolder)

    if (!context) {
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

    const signalCount = context.packageSignals.length + context.fileSignals.length

    return [
      {
        kind: 'group',
        label: 'Project',
        description: context.workspaceFolder.name,
        contextValue: 'weappProject.group',
        iconId: 'root-folder',
        children: [
          {
            kind: 'info',
            label: '包管理器',
            description: context.packageManager,
            contextValue: 'weappProject.info',
            iconId: 'package',
          },
          {
            kind: 'info',
            label: '识别信号',
            description: `${signalCount} 个`,
            contextValue: 'weappProject.info',
            iconId: signalCount > 0 ? 'pass' : 'warning',
            tooltip: [...context.packageSignals, ...context.fileSignals].join('\n') || '暂无识别信号',
          },
          {
            kind: 'action',
            label: '打开项目文件',
            command: 'weapp-vite.openProjectFile',
            contextValue: 'weappProject.action',
            iconId: 'go-to-file',
          },
          {
            kind: 'action',
            label: '项目概览',
            command: 'weapp-vite.showProjectInfo',
            contextValue: 'weappProject.action',
            iconId: 'info',
          },
        ],
      },
      {
        kind: 'group',
        label: 'Tasks',
        description: '常用命令',
        contextValue: 'weappProject.group',
        iconId: 'terminal',
        children: [
          {
            kind: 'action',
            label: 'Dev',
            command: 'weapp-vite.dev',
            contextValue: 'weappProject.action',
            iconId: 'debug-start',
          },
          {
            kind: 'action',
            label: 'Build',
            command: 'weapp-vite.build',
            contextValue: 'weappProject.action',
            iconId: 'tools',
          },
          {
            kind: 'action',
            label: 'Open DevTools',
            command: 'weapp-vite.open',
            contextValue: 'weappProject.action',
            iconId: 'device-mobile',
          },
          {
            kind: 'action',
            label: 'Doctor / Info',
            command: 'weapp-vite.doctor',
            contextValue: 'weappProject.action',
            iconId: 'pulse',
          },
          {
            kind: 'action',
            label: 'Generate',
            command: 'weapp-vite.generate',
            contextValue: 'weappProject.action',
            iconId: 'new-file',
          },
        ],
      },
    ] satisfies WeappViteProjectNode[]
  }
}
