import assert from 'node:assert/strict'
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
        TreeItemCollapsibleState: {
          None: 0,
          Expanded: 2,
        },
        Uri: {
          file(fsPath: string) {
            return { fsPath, path: fsPath }
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

  const missingPageItem = provider.getTreeItem(appPages[1])

  assert.equal(missingPageItem.command?.arguments?.[0]?.fsPath, '/workspace/src/app.json')
  assert.equal(missingPageItem.contextValue, 'weappPage.missing')

  const subpackages = await provider.getChildren(rootNodes[1])

  assert.equal(subpackages[0].label, 'packageA')

  const subpackagePages = await provider.getChildren(subpackages[0])

  assert.equal(subpackagePages[0].label, 'packageA/detail/index')

  const unregisteredPages = await provider.getChildren(rootNodes[2])
  const unregisteredPageItem = provider.getTreeItem(unregisteredPages[0])

  assert.equal(unregisteredPageItem.contextValue, 'weappPage.unregistered')
})
