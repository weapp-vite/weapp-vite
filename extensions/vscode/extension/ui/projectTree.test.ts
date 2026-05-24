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
      Collapsed: 1,
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

it('builds project actions for recognized workspace', async () => {
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
      getProjectContextCandidates: async () => [{
        fileSignals: ['vite.config.ts'],
        packageManager: 'pnpm',
        packageSignals: ['dependency: weapp-vite'],
        scripts: {
          build: 'pnpm build',
          dev: 'pnpm dev',
          doctor: 'pnpm info',
          generate: 'pnpm generate',
          open: 'pnpm open',
        },
        workspaceFolder,
      }],
    }
  })
  vi.resetModules()

  const { WeappViteProjectTreeProvider } = await import(`${projectTreeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappViteProjectTreeProvider()
  const rootNodes = await provider.getChildren()

  assert.equal(rootNodes.length, 1)
  assert.equal(rootNodes[0].label, 'demo')
  assert.equal(rootNodes[0].description, '.')

  const rootItem = provider.getTreeItem(rootNodes[0])

  assert.equal(rootItem.command?.command, 'weapp-vite.selectProject')
  assert.equal(rootItem.collapsibleState, 1)
  assert.deepEqual(rootItem.command?.arguments, [
    {
      projectPath: '/workspace',
    },
  ])

  const projectNodes = await provider.getChildren(rootNodes[0])

  assert.equal(projectNodes.map(node => node.label).join(','), '打开项目文件,查看 Pages,Dev,Build,Open DevTools,Doctor / Info,Generate,修复项目问题,生成缺失页面,生成缺失组件,同步未注册页面')

  const devItem = provider.getTreeItem(projectNodes[2])

  assert.equal(devItem.command?.command, 'weapp-vite.dev')
  assert.deepEqual(devItem.command?.arguments, [
    {
      projectPath: '/workspace',
    },
  ])
  assert.equal(devItem.iconPath?.id, 'debug-start')
})

it('shows all monorepo projects and scopes task commands to each project', async () => {
  vi.doMock('vscode', () => createVscodeModule(createMockVscode()))
  vi.doMock('../project/workspace', () => {
    const workspaceFolder = {
      name: 'workspace',
      uri: {
        fsPath: '/workspace',
      },
    }

    return {
      getPrimaryWorkspaceFolder() {
        return workspaceFolder
      },
      getProjectContextCandidates: async () => [
        {
          fileSignals: ['src/app.json'],
          packageManager: 'pnpm',
          packageSignals: ['依赖包含 weapp-vite'],
          scripts: {
            build: 'pnpm build',
          },
          workspaceFolder: {
            name: 'alpha',
            uri: {
              fsPath: '/workspace/apps/alpha',
            },
          },
        },
        {
          fileSignals: ['src/app.json'],
          packageManager: 'yarn',
          packageSignals: ['脚本 dev 调用了 weapp-vite CLI'],
          scripts: {
            build: 'yarn build',
            dev: 'yarn dev',
          },
          workspaceFolder: {
            name: 'beta',
            uri: {
              fsPath: '/workspace/packages/beta',
            },
          },
        },
      ],
    }
  })
  vi.resetModules()

  const { WeappViteProjectTreeProvider } = await import(`${projectTreeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappViteProjectTreeProvider()
  const rootNodes = await provider.getChildren()

  assert.equal(rootNodes.map(node => `${node.label}:${node.description}`).join(','), 'alpha:apps/alpha,beta:packages/beta')

  const betaTasks = await provider.getChildren(rootNodes[1])
  const buildNode = betaTasks.find(node => node.label === 'Build')

  assert.ok(buildNode)

  const buildItem = provider.getTreeItem(buildNode)

  assert.equal(buildItem.command?.command, 'weapp-vite.build')
  assert.deepEqual(buildItem.command?.arguments, [
    {
      projectPath: '/workspace/packages/beta',
    },
  ])
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
      getProjectContextCandidates: async () => [],
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
