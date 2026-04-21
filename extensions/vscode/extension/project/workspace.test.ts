/// <reference types="node" />

import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { afterEach, it, vi } from 'vitest'

function toUriPath(fsPath: string) {
  return fsPath.replace(/\\/gu, '/')
}

function normalizeMockUri<T extends { fsPath: string, path: string }>(uri: T): T {
  const fsPath = path.normalize(uri.fsPath)

  return {
    ...uri,
    fsPath,
    path: toUriPath(fsPath),
  }
}

function normalizeWorkspaceFolder<T extends { uri: { fsPath: string, path: string } }>(workspaceFolder: T): T {
  return {
    ...workspaceFolder,
    uri: normalizeMockUri(workspaceFolder.uri),
  }
}

function createVscodeModule(mockVscode: Record<string, unknown>) {
  const normalizedVscode = { ...mockVscode } as Record<string, any>

  if (normalizedVscode.workspace && typeof normalizedVscode.workspace === 'object') {
    normalizedVscode.workspace = { ...normalizedVscode.workspace }

    if (Array.isArray(normalizedVscode.workspace.workspaceFolders)) {
      normalizedVscode.workspace.workspaceFolders = normalizedVscode.workspace.workspaceFolders.map(normalizeWorkspaceFolder)
    }

    if (typeof normalizedVscode.workspace.getWorkspaceFolder === 'function') {
      const originalGetWorkspaceFolder = normalizedVscode.workspace.getWorkspaceFolder.bind(normalizedVscode.workspace)
      normalizedVscode.workspace.getWorkspaceFolder = (...args: any[]) => {
        const workspaceFolder = originalGetWorkspaceFolder(...args)

        return workspaceFolder ? normalizeWorkspaceFolder(workspaceFolder) : workspaceFolder
      }
    }
  }

  if (normalizedVscode.Uri && typeof normalizedVscode.Uri === 'object') {
    normalizedVscode.Uri = { ...normalizedVscode.Uri }

    if (typeof normalizedVscode.Uri.file === 'function') {
      const originalFile = normalizedVscode.Uri.file.bind(normalizedVscode.Uri)
      normalizedVscode.Uri.file = (targetPath: string) => normalizeMockUri(originalFile(targetPath))
    }
  }

  return {
    ...normalizedVscode,
    default: normalizedVscode,
  }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.doUnmock('vscode')
  vi.resetModules()
})

function normalizeFsPath(fsPath: string) {
  return path.normalize(fsPath)
}

it('updates rooted usingComponents paths when a component file moves', async () => {
  const fileContents = new Map<string, string>([
    [normalizeFsPath('/workspace/src/app.json'), '{}\n'],
    [normalizeFsPath('/workspace/src/pages/home/index.vue'), [
      '<json lang="jsonc">',
      '{',
      '  "usingComponents": {',
      '    "card-user": "/components/card/user/index"',
      '  }',
      '}',
      '</json>',
    ].join('\n')],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!fileContents.has(uri.fsPath)) {
              throw new Error('not found')
            }

            return {
              type: 0,
            }
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = fileContents.get(uri.fsPath)

            if (content == null) {
              throw new Error('not found')
            }

            return Buffer.from(content)
          },
        },
        findFiles: async () => [
          {
            fsPath: normalizeFsPath('/workspace/src/pages/home/index.vue'),
            path: normalizeFsPath('/workspace/src/pages/home/index.vue'),
          },
        ],
      },
      Uri: {
        file(fsPath: string) {
          return {
            fsPath,
            path: fsPath,
          }
        },
      },
      RelativePattern: class {
        base
        pattern

        constructor(base: string, pattern: string) {
          this.base = base
          this.pattern = pattern
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    getVueTextsWithMovedUsingComponentPath,
    getVueTextsWithRemovedUsingComponentPath,
  } = await import('./workspace')

  const updates = await getVueTextsWithMovedUsingComponentPath(
    {
      uri: {
        fsPath: '/workspace',
        path: '/workspace',
      },
    },
    normalizeFsPath('/workspace/src/components/card/user/index.vue'),
    normalizeFsPath('/workspace/src/components/profile/card/index.vue'),
  )

  assert.equal(updates.length, 1)
  assert.equal(updates[0].filePath, normalizeFsPath('/workspace/src/pages/home/index.vue'))
  assert.equal(updates[0].nextText.includes('/components/profile/card/index'), true)

  const removalUpdates = await getVueTextsWithRemovedUsingComponentPath(
    {
      uri: {
        fsPath: '/workspace',
        path: '/workspace',
      },
    },
    normalizeFsPath('/workspace/src/components/card/user/index.vue'),
  )

  assert.equal(removalUpdates.length, 1)
  assert.equal(removalUpdates[0].nextText.includes('/components/card/user/index'), false)
})

it('updates rooted usingComponents paths when a component directory moves', async () => {
  const fileContents = new Map<string, string>([
    [normalizeFsPath('/workspace/src/app.json'), '{}\n'],
    [normalizeFsPath('/workspace/src/pages/home/index.vue'), [
      '<json lang="jsonc">',
      '{',
      '  "usingComponents": {',
      '    "card-user": "/components/card/user/index"',
      '  }',
      '}',
      '</json>',
    ].join('\n')],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!fileContents.has(uri.fsPath)) {
              throw new Error('not found')
            }

            return {
              type: 0,
            }
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = fileContents.get(uri.fsPath)

            if (content == null) {
              throw new Error('not found')
            }

            return Buffer.from(content)
          },
        },
        findFiles: async () => [
          {
            fsPath: normalizeFsPath('/workspace/src/pages/home/index.vue'),
            path: normalizeFsPath('/workspace/src/pages/home/index.vue'),
          },
        ],
      },
      Uri: {
        file(fsPath: string) {
          return {
            fsPath,
            path: fsPath,
          }
        },
      },
      RelativePattern: class {
        base
        pattern

        constructor(base: string, pattern: string) {
          this.base = base
          this.pattern = pattern
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    getVueTextsWithMovedUsingComponentPath,
  } = await import('./workspace')

  const updates = await getVueTextsWithMovedUsingComponentPath(
    {
      uri: {
        fsPath: '/workspace',
        path: '/workspace',
      },
    },
    normalizeFsPath('/workspace/src/components/card'),
    normalizeFsPath('/workspace/src/components/profile/card'),
  )

  assert.equal(updates.length, 1)
  assert.equal(updates[0].nextText.includes('/components/profile/card/user/index'), true)
})

it('removes usingComponents paths when a component directory is deleted', async () => {
  const fileContents = new Map<string, string>([
    [normalizeFsPath('/workspace/src/app.json'), '{}\n'],
    [normalizeFsPath('/workspace/src/pages/home/index.vue'), [
      '<json lang="jsonc">',
      '{',
      '  "usingComponents": {',
      '    "card-user": "/components/card/user/index",',
      '    "user-avatar": "/components/avatar/index"',
      '  }',
      '}',
      '</json>',
    ].join('\n')],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!fileContents.has(uri.fsPath)) {
              throw new Error('not found')
            }

            return {
              type: 0,
            }
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = fileContents.get(uri.fsPath)

            if (content == null) {
              throw new Error('not found')
            }

            return Buffer.from(content)
          },
        },
        findFiles: async () => [
          {
            fsPath: normalizeFsPath('/workspace/src/pages/home/index.vue'),
            path: normalizeFsPath('/workspace/src/pages/home/index.vue'),
          },
        ],
      },
      Uri: {
        file(fsPath: string) {
          return {
            fsPath,
            path: fsPath,
          }
        },
      },
      RelativePattern: class {
        base
        pattern

        constructor(base: string, pattern: string) {
          this.base = base
          this.pattern = pattern
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    getVueTextsWithRemovedUsingComponentPath,
  } = await import('./workspace')

  const updates = await getVueTextsWithRemovedUsingComponentPath(
    {
      uri: {
        fsPath: '/workspace',
        path: '/workspace',
      },
    },
    normalizeFsPath('/workspace/src/components/card'),
  )

  assert.equal(updates.length, 1)
  assert.equal(updates[0].nextText.includes('/components/card/user/index'), false)
  assert.equal(updates[0].nextText.includes('/components/avatar/index'), true)
})

it('resolves rooted usingComponents from the nearest monorepo project when app.config.ts is used', async () => {
  const workspaceRoot = normalizeFsPath('/workspace')
  const projectRoot = normalizeFsPath('/workspace/apps/demo')
  const documentPath = normalizeFsPath('/workspace/apps/demo/src/components/vue-with-native/index.vue')
  const fileContents = new Map<string, string>([
    [normalizeFsPath('/workspace/apps/demo/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': 'workspace:*',
      },
    }, null, 2)],
    [normalizeFsPath('/workspace/apps/demo/vite.config.ts'), [
      'import { defineConfig } from \'weapp-vite\'',
      'export default defineConfig({})',
    ].join('\n')],
    [normalizeFsPath('/workspace/apps/demo/src/app.config.ts'), 'export default {}'],
    [normalizeFsPath(documentPath), '<json>{"usingComponents":{"native-badge":"/native/native-badge/index"}}</json>'],
    [normalizeFsPath('/workspace/apps/demo/src/native/native-badge/index.js'), 'Component({})'],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      window: {
        activeTextEditor: undefined,
      },
      workspace: {
        workspaceFolders: [
          {
            uri: {
              fsPath: workspaceRoot,
              path: workspaceRoot,
            },
          },
        ],
        getWorkspaceFolder: () => ({
          uri: {
            fsPath: workspaceRoot,
            path: workspaceRoot,
          },
        }),
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!fileContents.has(uri.fsPath)) {
              throw new Error('not found')
            }

            return {
              type: 0,
            }
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = fileContents.get(uri.fsPath)

            if (content == null) {
              throw new Error('not found')
            }

            return Buffer.from(content)
          },
        },
      },
      Uri: {
        file(fsPath: string) {
          return {
            fsPath,
            path: fsPath,
          }
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    getVueUsingComponentFileStatus,
  } = await import('./workspace')

  const status = await getVueUsingComponentFileStatus({
    languageId: 'vue',
    uri: {
      fsPath: documentPath,
      path: documentPath,
    },
  }, '/native/native-badge/index')

  assert.equal(status?.workspacePath, projectRoot)
  assert.equal(status?.componentFilePath, normalizeFsPath('/workspace/apps/demo/src/native/native-badge/index.js'))
  assert.deepEqual(status?.candidatePaths, [
    normalizeFsPath('/workspace/apps/demo/src/native/native-badge/index.vue'),
    normalizeFsPath('/workspace/apps/demo/src/native/native-badge/index.ts'),
    normalizeFsPath('/workspace/apps/demo/src/native/native-badge/index.js'),
    normalizeFsPath('/workspace/apps/demo/src/native/native-badge/index.wxml'),
  ])
})

it('updates app.json routes when a page directory moves', async () => {
  const fileContents = new Map<string, string>([
    [normalizeFsPath('/workspace/src/app.json'), JSON.stringify({
      pages: [
        'pages/card/user/index',
        'pages/home/index',
      ],
    }, null, 2)],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!fileContents.has(uri.fsPath)) {
              throw new Error('not found')
            }

            return {
              type: 0,
            }
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = fileContents.get(uri.fsPath)

            if (content == null) {
              throw new Error('not found')
            }

            return Buffer.from(content)
          },
        },
      },
      Uri: {
        file(fsPath: string) {
          return {
            fsPath,
            path: fsPath,
          }
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    getAppJsonTextWithMovedRoutes,
  } = await import('./workspace')

  const updates = await getAppJsonTextWithMovedRoutes(
    {
      uri: {
        fsPath: '/workspace',
        path: '/workspace',
      },
    },
    normalizeFsPath('/workspace/src/pages/card'),
    normalizeFsPath('/workspace/src/pages/profile/card'),
  )

  assert.equal(updates.length, 1)
  assert.equal(updates[0].nextText.includes('pages/profile/card/user/index'), true)
  assert.equal(updates[0].nextText.includes('pages/card/user/index'), false)
})

it('removes app.json routes when a page directory is deleted', async () => {
  const fileContents = new Map<string, string>([
    [normalizeFsPath('/workspace/src/app.json'), JSON.stringify({
      pages: [
        'pages/card/user/index',
        'pages/home/index',
      ],
    }, null, 2)],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!fileContents.has(uri.fsPath)) {
              throw new Error('not found')
            }

            return {
              type: 0,
            }
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = fileContents.get(uri.fsPath)

            if (content == null) {
              throw new Error('not found')
            }

            return Buffer.from(content)
          },
        },
      },
      Uri: {
        file(fsPath: string) {
          return {
            fsPath,
            path: fsPath,
          }
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    getAppJsonTextWithRemovedRoutes,
  } = await import('./workspace')

  const updates = await getAppJsonTextWithRemovedRoutes(
    {
      uri: {
        fsPath: '/workspace',
        path: '/workspace',
      },
    },
    normalizeFsPath('/workspace/src/pages/card'),
  )

  assert.equal(updates.length, 1)
  assert.equal(updates[0].nextText.includes('pages/card/user/index'), false)
  assert.equal(updates[0].nextText.includes('pages/home/index'), true)
})

it('treats weapp-vite.config files as vite config documents', async () => {
  vi.doMock('vscode', () => {
    return createVscodeModule({})
  })
  vi.resetModules()

  const {
    isViteConfigDocument,
  } = await import('./workspace')

  assert.equal(isViteConfigDocument({ fileName: '/workspace/weapp-vite.config.ts' }), true)
  assert.equal(isViteConfigDocument({ fileName: '/workspace/nested/weapp-vite.config.mjs' }), true)
  assert.equal(isViteConfigDocument({ fileName: '/workspace/src/main.ts' }), false)
})

it('finds dedicated weapp-vite config files when resolving project config path', async () => {
  const existingPaths = new Set<string>([
    normalizeFsPath('/workspace/weapp-vite.config.ts'),
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!existingPaths.has(uri.fsPath)) {
              throw new Error('not found')
            }

            return {
              type: 0,
            }
          },
        },
      },
      Uri: {
        file(fsPath: string) {
          return {
            fsPath,
            path: fsPath,
          }
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    getProjectViteConfigPath,
  } = await import('./workspace')

  const viteConfigPath = await getProjectViteConfigPath({
    uri: {
      fsPath: '/workspace',
      path: '/workspace',
    },
  })

  assert.equal(viteConfigPath, normalizeFsPath('/workspace/weapp-vite.config.ts'))
})

it('collects weapp-vite project signals from dedicated config files', async () => {
  const fileContents = new Map<string, string>([
    [normalizeFsPath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^0.0.0',
      },
    })],
    [normalizeFsPath('/workspace/weapp-vite.config.ts'), 'import { defineConfig } from \'weapp-vite\'\nexport default defineConfig({})\n'],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!fileContents.has(uri.fsPath)) {
              throw new Error('not found')
            }

            return {
              type: 0,
            }
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = fileContents.get(uri.fsPath)

            if (content == null) {
              throw new Error('not found')
            }

            return Buffer.from(content)
          },
        },
      },
      Uri: {
        file(fsPath: string) {
          return {
            fsPath,
            path: fsPath,
          }
        },
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    getWeappViteProjectSignals,
  } = await import('./workspace')

  const signals = await getWeappViteProjectSignals('/workspace')

  assert.equal(signals.hasWeappViteConfigSignal, true)
  assert.equal(signals.fileSignals.includes('weapp-vite.config.ts 引用了 weapp-vite'), true)
  assert.equal(signals.isConfirmedWeappViteProject, true)
})
