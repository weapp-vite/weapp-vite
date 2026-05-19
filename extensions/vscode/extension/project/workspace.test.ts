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

it('excludes heavy generated and dependency folders from workspace file scans', async () => {
  const findFilesCalls: Array<{
    exclude: string | undefined
    maxResults: number | undefined
    pattern: { base: string, pattern: string }
  }> = []

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        findFiles: async (pattern: { base: string, pattern: string }, exclude?: string, maxResults?: number) => {
          findFilesCalls.push({
            pattern,
            exclude,
            maxResults,
          })

          return []
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
    findWorkspaceFiles,
    WORKSPACE_FIND_FILES_EXCLUDE_PATTERN,
  } = await import('./workspace')

  await findWorkspaceFiles('/workspace', '**/*.vue', 25)

  assert.equal(findFilesCalls.length, 1)
  assert.equal(findFilesCalls[0].pattern.base, '/workspace')
  assert.equal(findFilesCalls[0].pattern.pattern, '**/*.vue')
  assert.equal(findFilesCalls[0].exclude, WORKSPACE_FIND_FILES_EXCLUDE_PATTERN)
  assert.equal(findFilesCalls[0].maxResults, 25)
  assert.match(WORKSPACE_FIND_FILES_EXCLUDE_PATTERN, /node_modules/u)
  assert.match(WORKSPACE_FIND_FILES_EXCLUDE_PATTERN, /\.pnpm/u)
  assert.match(WORKSPACE_FIND_FILES_EXCLUDE_PATTERN, /\.codex-tmp/u)
  assert.match(WORKSPACE_FIND_FILES_EXCLUDE_PATTERN, /submodules/u)
})

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

it.each([
  {
    name: 'pnpm packageManager',
    expectedPackageManager: 'pnpm',
    rootFiles: {
      'package.json': JSON.stringify({
        packageManager: 'pnpm@9.0.0',
        workspaces: [
          'apps/*',
        ],
      }, null, 2),
    },
  },
  {
    name: 'yarn packageManager',
    expectedPackageManager: 'yarn',
    rootFiles: {
      'package.json': JSON.stringify({
        packageManager: 'yarn@4.0.0',
        workspaces: [
          'apps/*',
        ],
      }, null, 2),
    },
  },
  {
    name: 'npm packageManager',
    expectedPackageManager: 'npm',
    rootFiles: {
      'package.json': JSON.stringify({
        packageManager: 'npm@10.0.0',
        workspaces: [
          'apps/*',
        ],
      }, null, 2),
    },
  },
  {
    name: 'pnpm lockfile',
    expectedPackageManager: 'pnpm',
    rootFiles: {
      'package.json': JSON.stringify({
        workspaces: [
          'apps/*',
        ],
      }, null, 2),
      'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    },
  },
  {
    name: 'yarn lockfile',
    expectedPackageManager: 'yarn',
    rootFiles: {
      'package.json': JSON.stringify({
        workspaces: [
          'apps/*',
        ],
      }, null, 2),
      'yarn.lock': '# yarn lockfile\n',
    },
  },
  {
    name: 'npm lockfile',
    expectedPackageManager: 'npm',
    rootFiles: {
      'package.json': JSON.stringify({
        workspaces: [
          'apps/*',
        ],
      }, null, 2),
      'package-lock.json': '{}\n',
    },
  },
])('discovers weapp-vite project contexts under a $name monorepo workspace root', async ({ expectedPackageManager, rootFiles }) => {
  const workspaceRoot = normalizeFsPath('/workspace')
  const projectRoot = normalizeFsPath('/workspace/apps/demo')
  const fileContents = new Map<string, string>(Object.entries(rootFiles).map(([fileName, content]) => [
    normalizeFsPath(`/workspace/${fileName}`),
    content,
  ]))

  for (const [filePath, content] of [
    [normalizeFsPath('/workspace/apps/demo/package.json'), JSON.stringify({
      scripts: {
        dev: 'wv dev',
      },
      dependencies: {
        'weapp-vite': 'workspace:*',
      },
    }, null, 2)],
    [normalizeFsPath('/workspace/apps/demo/vite.config.ts'), 'import { defineConfig } from \'weapp-vite\'\nexport default defineConfig({})\n'],
    [normalizeFsPath('/workspace/apps/demo/src/app.json'), '{}'],
    [normalizeFsPath('/workspace/packages/tooling/package.json'), JSON.stringify({
      scripts: {
        build: 'tsc -p tsconfig.json',
      },
    }, null, 2)],
  ] as Array<[string, string]>) {
    fileContents.set(filePath, content)
  }

  vi.doMock('vscode', () => {
    const mockVscode = {
      window: {
        activeTextEditor: undefined,
      },
      workspace: {
        workspaceFolders: [
          {
            name: 'workspace',
            uri: {
              fsPath: workspaceRoot,
              path: workspaceRoot,
            },
          },
        ],
        getWorkspaceFolder: () => ({
          name: 'workspace',
          uri: {
            fsPath: workspaceRoot,
            path: workspaceRoot,
          },
        }),
        findFiles: async () => [
          {
            fsPath: normalizeFsPath('/workspace/package.json'),
            path: '/workspace/package.json',
          },
          {
            fsPath: normalizeFsPath('/workspace/apps/demo/package.json'),
            path: '/workspace/apps/demo/package.json',
          },
          {
            fsPath: normalizeFsPath('/workspace/packages/tooling/package.json'),
            path: '/workspace/packages/tooling/package.json',
          },
        ],
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
    getProjectContext,
    getProjectContextCandidates,
  } = await import('./workspace')

  const contexts = await getProjectContextCandidates({
    name: 'workspace',
    uri: {
      fsPath: workspaceRoot,
      path: workspaceRoot,
    },
  })
  const context = await getProjectContext({
    name: 'workspace',
    uri: {
      fsPath: workspaceRoot,
      path: workspaceRoot,
    },
  })

  assert.equal(contexts.length, 1)
  assert.equal(contexts[0].workspaceFolder.uri.fsPath, projectRoot)
  assert.equal(contexts[0].packageJsonPath, normalizeFsPath('/workspace/apps/demo/package.json'))
  assert.equal(contexts[0].packageManager, expectedPackageManager)
  assert.deepEqual(contexts[0].scripts, {
    dev: 'wv dev',
  })
  assert.equal(context?.workspaceFolder.uri.fsPath, projectRoot)
})

it('caches project context candidates until the cache is cleared', async () => {
  const workspaceRoot = normalizeFsPath('/workspace')
  const projectRoot = normalizeFsPath('/workspace/apps/demo')
  const fileContents = new Map<string, string>([
    [normalizeFsPath('/workspace/apps/demo/package.json'), JSON.stringify({
      scripts: {
        dev: 'wv dev',
      },
      dependencies: {
        'weapp-vite': 'workspace:*',
      },
    }, null, 2)],
    [normalizeFsPath('/workspace/apps/demo/vite.config.ts'), 'import { defineConfig } from \'weapp-vite\'\nexport default defineConfig({})\n'],
    [normalizeFsPath('/workspace/apps/demo/src/app.json'), '{}'],
  ])
  let findFilesCalls = 0

  vi.doMock('vscode', () => {
    const mockVscode = {
      window: {
        activeTextEditor: undefined,
      },
      workspace: {
        workspaceFolders: [
          {
            name: 'workspace',
            uri: {
              fsPath: workspaceRoot,
              path: workspaceRoot,
            },
          },
        ],
        findFiles: async () => {
          findFilesCalls += 1

          return [
            {
              fsPath: normalizeFsPath('/workspace/apps/demo/package.json'),
              path: '/workspace/apps/demo/package.json',
            },
          ]
        },
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
    clearProjectContextCache,
    getProjectContext,
    getProjectContextCandidates,
  } = await import('./workspace')
  const workspaceFolder = {
    name: 'workspace',
    uri: {
      fsPath: workspaceRoot,
      path: workspaceRoot,
    },
  }

  const firstContexts = await getProjectContextCandidates(workspaceFolder)
  const cachedContext = await getProjectContext(workspaceFolder)

  assert.equal(findFilesCalls, 1)
  assert.equal(firstContexts[0].workspaceFolder.uri.fsPath, projectRoot)
  assert.equal(cachedContext?.workspaceFolder.uri.fsPath, projectRoot)

  clearProjectContextCache()

  await getProjectContextCandidates(workspaceFolder)

  assert.equal(findFilesCalls, 2)
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
