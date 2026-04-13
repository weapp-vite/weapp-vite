import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, it, vi } from 'vitest'

const treeModuleUrl = pathToFileURL(path.resolve(__dirname, 'tree.ts')).href

afterEach(() => {
  vi.clearAllMocks()
  vi.doUnmock('vscode')
  vi.doUnmock('./workspace')
  vi.resetModules()
})

it('builds pages tree nodes from weapp pages snapshot', async () => {
  vi.doMock('vscode', () => {
    return {
      default: {
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
      },
    }
  })
  vi.doMock('./workspace', () => {
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

  assert.equal(appPages[0].label, 'pages/home/index')
  assert.equal(appPages[0].description, path.relative('/workspace', '/workspace/src/pages/home/index.vue'))
  assert.equal(appPages[1].description, '缺少页面文件')

  const appPageItem = provider.getTreeItem(appPages[0])

  assert.equal(appPageItem.command?.command, 'vscode.open')
  assert.equal(appPageItem.contextValue, 'weappPage.exists')
  assert.equal(appPageItem.iconPath?.id, 'file')

  const missingPageItem = provider.getTreeItem(appPages[1])

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

it('marks current page in pages tree', async () => {
  vi.doMock('vscode', () => {
    return {
      default: {
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
      },
    }
  })
  vi.doMock('./workspace', () => {
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
})

it('marks config drift pages in tree', async () => {
  vi.doMock('vscode', () => {
    return {
      default: {
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
            readFile: async (uri: { fsPath: string }) => {
              if (uri.fsPath.endsWith('index.vue')) {
                return Buffer.from([
                  '<script setup lang="ts">',
                  'definePageJson({',
                  '  navigationBarTitleText: \'Home\',',
                  '})',
                  '</script>',
                  '<json lang="jsonc">',
                  '{',
                  '  "navigationBarTitleText": "Index"',
                  '}',
                  '</json>',
                ].join('\n'))
              }

              return Buffer.from('')
            },
          },
        },
      },
    }
  })
  vi.doMock('./workspace', () => {
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
  const rootNodes = await provider.getChildren()
  const appPages = await provider.getChildren(rootNodes[0])
  const item = provider.getTreeItem(appPages[0])

  assert.equal(item.description, 'src/pages/home/index.vue · 配置漂移')
  assert.equal(item.iconPath?.id, 'alert')
  assert.equal(item.contextValue, 'weappPage.exists.drift')
  assert.equal(item.tooltip?.includes('配置漂移: navigationBarTitleText'), true)
})
