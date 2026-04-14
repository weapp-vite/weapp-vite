import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { afterEach, it, vi } from 'vitest'

afterEach(() => {
  vi.clearAllMocks()
  vi.doUnmock('vscode')
  vi.resetModules()
})

it('updates rooted usingComponents paths when a component file moves', async () => {
  const fileContents = new Map<string, string>([
    ['/workspace/src/app.json', '{}\n'],
    ['/workspace/src/pages/home/index.vue', [
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
              fsPath: '/workspace/src/pages/home/index.vue',
              path: '/workspace/src/pages/home/index.vue',
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
    '/workspace/src/components/card/user/index.vue',
    '/workspace/src/components/profile/card/index.vue',
  )

  assert.equal(updates.length, 1)
  assert.equal(updates[0].filePath, '/workspace/src/pages/home/index.vue')
  assert.equal(updates[0].nextText.includes('/components/profile/card/index'), true)

  const removalUpdates = await getVueTextsWithRemovedUsingComponentPath(
    {
      uri: {
        fsPath: '/workspace',
        path: '/workspace',
      },
    },
    '/workspace/src/components/card/user/index.vue',
  )

  assert.equal(removalUpdates.length, 1)
  assert.equal(removalUpdates[0].nextText.includes('/components/card/user/index'), false)
})
