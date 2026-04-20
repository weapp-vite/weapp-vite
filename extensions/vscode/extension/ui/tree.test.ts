/// <reference types="node" />

import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, it, vi } from 'vitest'

const treeModuleUrl = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'tree.ts')).href

function createVscodeModule(mockVscode: Record<string, unknown>) {
  return {
    ...mockVscode,
    default: mockVscode,
  }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.doUnmock('vscode')
  vi.doUnmock('../project/workspace')
  vi.resetModules()
})

it('builds pages tree nodes from weapp pages snapshot', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
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
        static File = {
          id: 'file',
        }

        constructor(id: string) {
          this.id = id
        }
      },
      TreeItemCollapsibleState: {
        None: 0,
        Expanded: 2,
      },
      Uri: {
        file(fsPath: string) {
          return { fsPath, path: fsPath }
        },
      },
      workspace: {
        fs: {
          readFile: async () => Buffer.from(''),
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.doMock('../project/workspace', () => {
    return {
      getPrimaryWorkspaceFolder() {
        return {
          uri: {
            fsPath: '/workspace',
          },
        }
      },
      getWeappPagesTreeSnapshot: async () => {
        return {
          appJsonPath: '/workspace/src/app.json',
          subpackages: [
            {
              root: 'packageA',
              pages: [
                {
                  pageFilePath: '/workspace/src/packageA/detail/index.vue',
                  route: 'packageA/detail/index',
                },
              ],
            },
          ],
          topLevelPages: [
            {
              pageFilePath: '/workspace/src/pages/home/index.vue',
              route: 'pages/home/index',
            },
            {
              pageFilePath: null,
              route: 'pages/missing/index',
            },
          ],
          unregisteredPages: [
            {
              pageFilePath: '/workspace/src/pages/extra/index.vue',
              route: 'pages/extra/index',
            },
          ],
          workspaceFolder: {
            uri: {
              fsPath: '/workspace',
            },
          },
        }
      },
    }
  })
  vi.resetModules()

  const { WeappVitePagesTreeProvider } = await import(`${treeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappVitePagesTreeProvider()
  const rootNodes = await provider.getChildren()

  assert.equal(rootNodes.length, 3)
  assert.equal(rootNodes[0].label, 'App Pages')
  assert.equal(rootNodes[1].label, 'Subpackages')
  assert.equal(rootNodes[2].label, 'Unregistered Pages')

  const appPages = await provider.getChildren(rootNodes[0])

  assert.equal(appPages[0].label, 'pages/missing/index')
  assert.equal(appPages[0].description, '缺少页面文件')
  assert.equal(appPages[1].label, 'pages/home/index')
  assert.equal(appPages[1].description, 'src/pages/home/index.vue')

  const appPageItem = provider.getTreeItem(appPages[1])

  assert.equal(appPageItem.command?.command, 'vscode.open')
  assert.equal(appPageItem.contextValue, 'weappPage.exists')
  assert.equal(appPageItem.iconPath?.id, 'file')

  const missingPageItem = provider.getTreeItem(appPages[0])

  assert.equal(missingPageItem.command?.arguments?.[0]?.fsPath, '/workspace/src/app.json')
  assert.equal(missingPageItem.contextValue, 'weappPage.missing')
  assert.equal(missingPageItem.iconPath?.id, 'warning')

  const subpackages = await provider.getChildren(rootNodes[1])

  assert.equal(subpackages[0].label, 'packageA')

  const subpackagePages = await provider.getChildren(subpackages[0])

  assert.equal(subpackagePages[0].label, 'packageA/detail/index')

  const unregisteredPages = await provider.getChildren(rootNodes[2])
  const unregisteredPageItem = provider.getTreeItem(unregisteredPages[0])

  assert.equal(unregisteredPageItem.contextValue, 'weappPage.unregistered')
  assert.equal(unregisteredPageItem.iconPath?.id, 'circle-outline')
})

it('uses html-like file icon resource for existing wxml pages in tree', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
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
        static File = {
          id: 'file',
        }

        constructor(id: string) {
          this.id = id
        }
      },
      TreeItemCollapsibleState: {
        None: 0,
        Expanded: 2,
      },
      Uri: {
        file(fsPath: string) {
          return { fsPath, path: fsPath }
        },
      },
      workspace: {
        fs: {
          readFile: async () => Buffer.from(''),
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.doMock('../project/workspace', () => {
    return {
      getPrimaryWorkspaceFolder() {
        return {
          uri: {
            fsPath: '/workspace',
          },
        }
      },
      getWeappPagesTreeSnapshot: async () => {
        return {
          appJsonPath: '/workspace/src/app.json',
          subpackages: [],
          topLevelPages: [
            {
              pageFilePath: '/workspace/src/pages/native/index.wxml',
              route: 'pages/native/index',
            },
          ],
          unregisteredPages: [],
          workspaceFolder: {
            uri: {
              fsPath: '/workspace',
            },
          },
        }
      },
    }
  })
  vi.resetModules()

  const { WeappVitePagesTreeProvider } = await import(`${treeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappVitePagesTreeProvider()
  const rootNodes = await provider.getChildren()
  const appPages = await provider.getChildren(rootNodes[0])
  const wxmlPageItem = provider.getTreeItem(appPages[0])

  assert.equal(wxmlPageItem.iconPath?.id, 'file')
  assert.equal(wxmlPageItem.resourceUri?.fsPath, '/workspace/src/pages/native/index.html')
  assert.equal(wxmlPageItem.command?.arguments?.[0]?.fsPath, '/workspace/src/pages/native/index.wxml')
})

it('marks current page in pages tree', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
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
      Uri: {
        file(fsPath: string) {
          return { fsPath, path: fsPath }
        },
      },
      workspace: {
        fs: {
          readFile: async () => Buffer.from(''),
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.doMock('../project/workspace', () => {
    return {
      getPrimaryWorkspaceFolder() {
        return {
          uri: {
            fsPath: '/workspace',
          },
        }
      },
      getWeappPagesTreeSnapshot: async () => {
        return {
          appJsonPath: '/workspace/src/app.json',
          subpackages: [],
          topLevelPages: [
            {
              pageFilePath: '/workspace/src/pages/home/index.vue',
              route: 'pages/home/index',
            },
          ],
          unregisteredPages: [],
          workspaceFolder: {
            uri: {
              fsPath: '/workspace',
            },
          },
        }
      },
    }
  })
  vi.resetModules()

  const { WeappVitePagesTreeProvider } = await import(`${treeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappVitePagesTreeProvider()

  provider.setCurrentRoute('pages/home/index')
  const rootNodes = await provider.getChildren()
  const appPages = await provider.getChildren(rootNodes[0])
  const currentItem = provider.getTreeItem(appPages[0])

  assert.equal(currentItem.description, 'src/pages/home/index.vue · 当前页面')
  assert.equal(currentItem.iconPath?.id, 'target')
  assert.equal(currentItem.contextValue, 'weappPage.exists.current')
})

it('prioritizes missing status over current state and sorts problem pages first', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
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
      Uri: {
        file(fsPath: string) {
          return { fsPath, path: fsPath }
        },
      },
      workspace: {
        fs: {
          readFile: async () => Buffer.from(''),
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.doMock('../project/workspace', () => {
    return {
      getPrimaryWorkspaceFolder() {
        return {
          uri: {
            fsPath: '/workspace',
          },
        }
      },
      getWeappPagesTreeSnapshot: async () => {
        return {
          appJsonPath: '/workspace/src/app.json',
          subpackages: [],
          topLevelPages: [
            {
              pageFilePath: '/workspace/src/pages/ok/index.vue',
              route: 'pages/ok/index',
            },
            {
              pageFilePath: null,
              route: 'pages/current-missing/index',
            },
          ],
          unregisteredPages: [],
          workspaceFolder: {
            uri: {
              fsPath: '/workspace',
            },
          },
        }
      },
    }
  })
  vi.resetModules()

  const { WeappVitePagesTreeProvider } = await import(`${treeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappVitePagesTreeProvider()

  provider.setCurrentRoute('pages/current-missing/index')
  const rootNodes = await provider.getChildren()
  const appPages = await provider.getChildren(rootNodes[0])
  const firstItem = provider.getTreeItem(appPages[0])

  assert.equal(appPages[0].label, 'pages/current-missing/index')
  assert.equal(firstItem.description, '缺少页面文件 · 当前页面')
  assert.equal(firstItem.iconPath?.id, 'warning')
  assert.equal(firstItem.contextValue, 'weappPage.missing.current')
})

it('resolves page node by route after refresh', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
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
      Uri: {
        file(fsPath: string) {
          return { fsPath, path: fsPath }
        },
      },
      workspace: {
        fs: {
          readFile: async () => Buffer.from(''),
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.doMock('../project/workspace', () => {
    return {
      getPrimaryWorkspaceFolder() {
        return {
          uri: {
            fsPath: '/workspace',
          },
        }
      },
      getWeappPagesTreeSnapshot: async () => {
        return {
          appJsonPath: '/workspace/src/app.json',
          subpackages: [],
          topLevelPages: [
            {
              pageFilePath: '/workspace/src/pages/home/index.vue',
              route: 'pages/home/index',
            },
          ],
          unregisteredPages: [],
          workspaceFolder: {
            uri: {
              fsPath: '/workspace',
            },
          },
        }
      },
    }
  })
  vi.resetModules()

  const { WeappVitePagesTreeProvider } = await import(`${treeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappVitePagesTreeProvider()

  provider.refresh()
  const pageNode = await provider.resolvePageNodeByRoute('pages/home/index')

  assert.equal(pageNode?.route, 'pages/home/index')
  assert.equal(pageNode?.contextValue, 'weappPage.exists')
})

it('filters current page nodes in tree', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
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
      Uri: {
        file(fsPath: string) {
          return { fsPath, path: fsPath }
        },
      },
      workspace: {
        fs: {
          readFile: async () => Buffer.from(''),
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.doMock('../project/workspace', () => {
    return {
      getPrimaryWorkspaceFolder() {
        return {
          uri: {
            fsPath: '/workspace',
          },
        }
      },
      getWeappPagesTreeSnapshot: async () => {
        return {
          appJsonPath: '/workspace/src/app.json',
          subpackages: [
            {
              root: 'packageA',
              pages: [
                {
                  pageFilePath: '/workspace/src/packageA/detail/index.vue',
                  route: 'packageA/detail/index',
                },
              ],
            },
          ],
          topLevelPages: [
            {
              pageFilePath: '/workspace/src/pages/home/index.vue',
              route: 'pages/home/index',
            },
          ],
          unregisteredPages: [
            {
              pageFilePath: '/workspace/src/pages/extra/index.vue',
              route: 'pages/extra/index',
            },
          ],
          workspaceFolder: {
            uri: {
              fsPath: '/workspace',
            },
          },
        }
      },
    }
  })
  vi.resetModules()

  const { WeappVitePagesTreeProvider } = await import(`${treeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappVitePagesTreeProvider()

  provider.setCurrentRoute('packageA/detail/index')
  provider.setFilterMode('current')
  const rootNodes = await provider.getChildren()

  assert.equal(rootNodes.length, 1)
  assert.equal(rootNodes[0].label, 'Subpackages')
  assert.equal(rootNodes[0].description, '1 个分包')

  const subpackages = await provider.getChildren(rootNodes[0])

  assert.equal(subpackages.length, 1)
  assert.equal(subpackages[0].label, 'packageA')
})

it('filters problem page nodes in tree', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
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
      Uri: {
        file(fsPath: string) {
          return { fsPath, path: fsPath }
        },
      },
      workspace: {
        fs: {
          readFile: async () => Buffer.from(''),
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.doMock('../project/workspace', () => {
    return {
      getPrimaryWorkspaceFolder() {
        return {
          uri: {
            fsPath: '/workspace',
          },
        }
      },
      getWeappPagesTreeSnapshot: async () => {
        return {
          appJsonPath: '/workspace/src/app.json',
          subpackages: [],
          topLevelPages: [
            {
              pageFilePath: '/workspace/src/pages/ok/index.vue',
              route: 'pages/ok/index',
            },
            {
              pageFilePath: null,
              route: 'pages/missing/index',
            },
          ],
          unregisteredPages: [
            {
              pageFilePath: '/workspace/src/pages/extra/index.vue',
              route: 'pages/extra/index',
            },
          ],
          workspaceFolder: {
            uri: {
              fsPath: '/workspace',
            },
          },
        }
      },
    }
  })
  vi.resetModules()

  const { WeappVitePagesTreeProvider } = await import(`${treeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappVitePagesTreeProvider()

  provider.setFilterMode('problems')
  const problemGroups = await provider.getChildren()

  assert.equal(problemGroups.length, 2)
  assert.equal(problemGroups[0].label, 'App Pages')
  assert.equal(problemGroups[0].description, '1 个页面')
  assert.equal(problemGroups[1].label, 'Unregistered Pages')

  const problemPages = await provider.getChildren(problemGroups[0])

  assert.deepEqual(problemPages.map(page => page.label), [
    'pages/missing/index',
  ])
})

it('shows empty filter node when no page matches current filter', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
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
      Uri: {
        file(fsPath: string) {
          return { fsPath, path: fsPath }
        },
      },
      workspace: {
        fs: {
          readFile: async () => Buffer.from(''),
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.doMock('../project/workspace', () => {
    return {
      getPrimaryWorkspaceFolder() {
        return {
          uri: {
            fsPath: '/workspace',
          },
        }
      },
      getWeappPagesTreeSnapshot: async () => {
        return {
          appJsonPath: '/workspace/src/app.json',
          subpackages: [],
          topLevelPages: [
            {
              pageFilePath: '/workspace/src/pages/home/index.vue',
              route: 'pages/home/index',
            },
          ],
          unregisteredPages: [],
          workspaceFolder: {
            uri: {
              fsPath: '/workspace',
            },
          },
        }
      },
    }
  })
  vi.resetModules()

  const { WeappVitePagesTreeProvider } = await import(`${treeModuleUrl}?t=${Date.now()}`)
  const provider = new WeappVitePagesTreeProvider()

  provider.setFilterMode('problems')
  const rootNodes = await provider.getChildren()
  const emptyItem = provider.getTreeItem(rootNodes[0])

  assert.equal(rootNodes.length, 1)
  assert.equal(rootNodes[0].label, '当前筛选没有匹配页面')
  assert.equal(rootNodes[0].description, '仅问题页')
  assert.equal(emptyItem.command?.command, 'weapp-vite.clearPagesTreeFilter')
  assert.equal(emptyItem.iconPath?.id, 'filter')
  assert.equal(emptyItem.contextValue, 'weappPages.emptyFilter')
})
