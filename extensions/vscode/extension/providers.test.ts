import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { afterEach, it, vi } from 'vitest'

function createVscodeModule(mockVscode: Record<string, unknown>) {
  return {
    ...mockVscode,
    default: mockVscode,
  }
}

function createVueDocument(text: string, fsPath: string) {
  return {
    languageId: 'vue',
    uri: {
      fsPath,
      path: fsPath,
    },
    getText() {
      return text
    },
    positionAt(offset: number) {
      const lines = text.slice(0, offset).split('\n')
      const line = lines.length - 1
      const character = lines.at(-1)?.length ?? 0

      return {
        line,
        character,
      }
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.doUnmock('vscode')
  vi.resetModules()
})

it('creates document links for existing local usingComponents paths', async () => {
  const existingFiles = new Set([
    path.normalize('/workspace/src/app.json'),
    path.normalize('/workspace/src/components/card/user/index.vue'),
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        workspaceFolders: [
          {
            name: 'demo',
            uri: {
              fsPath: '/workspace',
              path: '/workspace',
            },
          },
        ],
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!existingFiles.has(uri.fsPath)) {
              throw new Error('not found')
            }

            return {
              type: 0,
            }
          },
          readFile: async () => Buffer.from('{}\n'),
        },
        getWorkspaceFolder: () => ({
          name: 'demo',
          uri: {
            fsPath: '/workspace',
            path: '/workspace',
          },
        }),
      },
      Uri: {
        file(targetPath: string) {
          return {
            fsPath: targetPath,
            path: targetPath,
          }
        },
      },
      Range: class {
        start
        end

        constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
          this.start = { line: startLine, character: startCharacter }
          this.end = { line: endLine, character: endCharacter }
        }
      },
      DocumentLink: class {
        range
        target
        tooltip

        constructor(range: any, target: any) {
          this.range = range
          this.target = target
        }
      },
      CompletionItemKind: {
        Property: 1,
        Value: 2,
        File: 3,
        Function: 4,
        Snippet: 5,
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappViteVueDocumentLinkProvider,
  } = await import('./providers')

  const provider = new WeappViteVueDocumentLinkProvider()
  const document = createVueDocument([
    '<json lang="jsonc">',
    '{',
    '  "usingComponents": {',
    '    "card-user": "/components/card/user/index",',
    '    "remote-demo": "plugin://demo/component",',
    '    "missing-demo": "/components/missing/index"',
    '  }',
    '}',
    '</json>',
  ].join('\n'), path.normalize('/workspace/src/pages/home/index.vue'))
  const links = await provider.provideDocumentLinks(document)

  assert.equal(links.length, 1)
  assert.equal(links[0].target.fsPath, path.normalize('/workspace/src/components/card/user/index.vue'))
  assert.equal(links[0].tooltip, '打开组件文件 /components/card/user/index')
})
