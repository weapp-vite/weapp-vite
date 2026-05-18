import * as vscode from 'vscode'

import {
  getPrimaryWorkspaceFolder,
  getProjectContextCandidates,
} from '../project/workspace'
import {
  getRelativeDisplayPath,
} from '../shared/pathUtils'

interface WeappViteProjectCommandTarget {
  projectPath?: string
}

interface WeappViteProjectBaseNode {
  command?: string
  commandTarget?: WeappViteProjectCommandTarget
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
      const signalCount = context.packageSignals.length + context.fileSignals.length
      const projectPath = context.workspaceFolder.uri.fsPath
      const relativePath = getRelativeDisplayPath(workspaceFolder.uri.fsPath, projectPath)
      const commandTarget = {
        projectPath,
      }

      return {
        kind: 'group',
        label: context.workspaceFolder.name,
        description: relativePath || '.',
        contextValue: 'weappProject.project',
        iconId: 'root-folder',
        tooltip: projectPath,
        children: [
          {
            kind: 'group',
            label: 'Project',
            description: context.packageManager,
            contextValue: 'weappProject.group',
            iconId: 'info',
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
                commandTarget,
                contextValue: 'weappProject.action',
                iconId: 'go-to-file',
              },
              {
                kind: 'action',
                label: '项目概览',
                command: 'weapp-vite.showProjectInfo',
                commandTarget,
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
                commandTarget,
                contextValue: 'weappProject.action',
                iconId: 'debug-start',
              },
              {
                kind: 'action',
                label: 'Build',
                command: 'weapp-vite.build',
                commandTarget,
                contextValue: 'weappProject.action',
                iconId: 'tools',
              },
              {
                kind: 'action',
                label: 'Open DevTools',
                command: 'weapp-vite.open',
                commandTarget,
                contextValue: 'weappProject.action',
                iconId: 'device-mobile',
              },
              {
                kind: 'action',
                label: 'Doctor / Info',
                command: 'weapp-vite.doctor',
                commandTarget,
                contextValue: 'weappProject.action',
                iconId: 'pulse',
              },
              {
                kind: 'action',
                label: 'Generate',
                command: 'weapp-vite.generate',
                commandTarget,
                contextValue: 'weappProject.action',
                iconId: 'new-file',
              },
            ],
          },
        ],
      }
    }) satisfies WeappViteProjectNode[]
  }
}
