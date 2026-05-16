import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, it, vi } from 'vitest'

const projectTreeModuleUrl = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'projectTree.ts')).href

function createVscodeModule(mockVscode: Record<string, unknown>) {
  return {
    ...mockVscode,
    default: mockVscode,
  }
}

function createMockVscode() {
  return {
    EventEmitter: class {
      event = () => ({ dispose() {} })
      fire() {}
      dispose() {}
    },
    TreeItem: class {
      label
      collapsibleState

      constructor(label: string, collapsibleState: number) {
        this.label = label
        this.collapsibleState = collapsibleState
      }
    },
    ThemeIcon: class {
      id

      constructor(id: string) {
        this.id = id
      }
    },
    TreeItemCollapsibleState: {
      None: 0,
      Expanded: 2,
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.doUnmock('vscode')
  vi.doUnmock('../project/workspace')
  vi.resetModules()
})

it('builds project and task nodes for recognized workspace', async () => {
  vi.doMock('vscode', () => createVscodeModule(createMockVscode()))
  vi.doMock('../project/workspace', () => {
    const workspaceFolder = {
      name: 'demo',
      uri: {
        fsPath: '/workspace',
      },
    }

    return {
      getPrimaryWorkspaceFolder() {
        return workspaceFolder
      },
      getProjectContext: async () => {
        return {
          fileSignals: ['vite.config.ts'],
          packageManager: 'pnpm',
          packageSignals: ['dependency: weapp-vite'],
          workspaceFolder,
        }
      },
    }
  })
  vi.resetModules()

  const { WeappViteProjectTreeProvider } = await import(`${projectTreeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappViteProjectTreeProvider()
  const rootNodes = await provider.getChildren()

  assert.equal(rootNodes.length, 2)
  assert.equal(rootNodes[0].label, 'Project')
  assert.equal(rootNodes[0].description, 'demo')
  assert.equal(rootNodes[1].label, 'Tasks')

  const projectNodes = await provider.getChildren(rootNodes[0])

  assert.equal(projectNodes[0].label, '包管理器')
  assert.equal(projectNodes[0].description, 'pnpm')
  assert.equal(projectNodes[1].label, '识别信号')
  assert.equal(projectNodes[1].description, '2 个')

  const taskNodes = await provider.getChildren(rootNodes[1])
  const devItem = provider.getTreeItem(taskNodes[0])

  assert.equal(taskNodes.map(node => node.label).join(','), 'Dev,Build,Open DevTools,Doctor / Info,Generate')
  assert.equal(devItem.command?.command, 'weapp-vite.dev')
  assert.equal(devItem.iconPath?.id, 'debug-start')
})

it('shows a documentation action for unrecognized workspace', async () => {
  vi.doMock('vscode', () => createVscodeModule(createMockVscode()))
  vi.doMock('../project/workspace', () => {
    return {
      getPrimaryWorkspaceFolder() {
        return {
          name: 'demo',
          uri: {
            fsPath: '/workspace',
          },
        }
      },
      getProjectContext: async () => null,
    }
  })
  vi.resetModules()

  const { WeappViteProjectTreeProvider } = await import(`${projectTreeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappViteProjectTreeProvider()
  const rootNodes = await provider.getChildren()

  assert.equal(rootNodes.length, 2)
  assert.equal(rootNodes[0].label, '未识别为 weapp-vite 项目')
  assert.equal(rootNodes[1].label, '打开文档')
  assert.equal(provider.getTreeItem(rootNodes[1]).command?.command, 'weapp-vite.openDocs')
})
