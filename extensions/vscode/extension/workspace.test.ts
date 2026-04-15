import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { afterEach, it, vi } from 'vitest'

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
    return {
      default: {
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
      },
    }
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
    return {
      default: {
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
      },
    }
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
    return {
      default: {
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
      },
    }
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
    return {
      default: {
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
      },
    }
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
    return {
      default: {
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
      },
    }
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
