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

function createTextDocument(languageId: string, text: string, fsPath: string) {
  return {
    languageId,
    uri: {
      fsPath,
      path: fsPath,
    },
    fileName: fsPath,
    getText() {
      return text
    },
    positionAt(offset: number) {
      const lines = text.slice(0, offset).split('\n')
      return {
        line: lines.length - 1,
        character: lines.at(-1)?.length ?? 0,
      }
    },
    offsetAt(position: { line: number, character: number }) {
      const lines = text.split('\n')
      let offset = 0

      for (let line = 0; line < position.line; line++) {
        offset += lines[line].length + 1
      }

      return offset + position.character
    },
  }
}

function getLanguageIdFromPath(fsPath: string) {
  if (fsPath.endsWith('.vue')) {
    return 'vue'
  }

  if (fsPath.endsWith('.wxml')) {
    return 'wxml'
  }

  if (fsPath.endsWith('.ts')) {
    return 'typescript'
  }

  if (fsPath.endsWith('.js')) {
    return 'javascript'
  }

  if (fsPath.endsWith('.json')) {
    return 'json'
  }

  return 'plaintext'
}

afterEach(() => {
  vi.clearAllMocks()
  vi.doUnmock('vscode')
  vi.resetModules()
})

it('provides script-side prop and event references for vue component definitions', async () => {
  const files = new Map<string, string>([
    [path.normalize('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [path.normalize('/workspace/src/app.json'), JSON.stringify({
      pages: ['pages/home/index'],
    })],
    [path.normalize('/workspace/src/components/card/user/index.vue'), [
      '<script setup lang="ts">',
      'defineProps<{',
      '  titleText?: string',
      '}>()',
      'defineEmits<{',
      '  (e: \'confirm\', value: number): void',
      '}>()',
      '</script>',
      '<template><view /></template>',
    ].join('\n')],
    [path.normalize('/workspace/src/pages/home/index.vue'), [
      '<template>',
      '  <card-user title-text="a" bind:confirm="handleTap" />',
      '</template>',
      '<json>',
      '{',
      '  "usingComponents": {',
      '    "card-user": "../../components/card/user/index"',
      '  }',
      '}',
      '</json>',
    ].join('\n')],
    [path.normalize('/workspace/src/pages/detail/index.wxml'), '<card-user title-text="b" bind:confirm="handleTap"></card-user>'],
    [path.normalize('/workspace/src/pages/detail/index.json'), JSON.stringify({
      usingComponents: {
        'card-user': '/components/card/user/index',
      },
    })],
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
            if (!files.has(path.normalize(uri.fsPath))) {
              throw new Error('not found')
            }

            return { type: 0 }
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = files.get(path.normalize(uri.fsPath))

            if (content == null) {
              throw new Error('not found')
            }

            return Buffer.from(content)
          },
        },
        findFiles: async (pattern: { pattern?: string }) => {
          const suffix = pattern.pattern?.endsWith('*.vue')
            ? '.vue'
            : pattern.pattern?.endsWith('*.wxml')
              ? '.wxml'
              : ''

          return [...files.keys()]
            .filter(filePath => filePath.endsWith(suffix))
            .map((filePath) => {
              return {
                fsPath: filePath,
                path: filePath,
              }
            })
        },
        openTextDocument: async (uri: { fsPath: string }) => {
          const fsPath = path.normalize(uri.fsPath)
          const text = files.get(fsPath)

          if (text == null) {
            throw new Error('not found')
          }

          return createTextDocument(getLanguageIdFromPath(fsPath), text, fsPath)
        },
        getWorkspaceFolder: () => ({
          name: 'demo',
          uri: {
            fsPath: '/workspace',
            path: '/workspace',
          },
        }),
        getConfiguration: () => ({
          get(_key: string, defaultValue: unknown) {
            return defaultValue
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
      Position: class {
        line
        character

        constructor(line: number, character: number) {
          this.line = line
          this.character = character
        }
      },
      Range: class {
        start
        end

        constructor(start: any, end: any) {
          this.start = start
          this.end = end
        }
      },
      Location: class {
        uri
        range

        constructor(uri: any, range: any) {
          this.uri = uri
          this.range = range
        }
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
    WeappTemplateScriptReferenceProvider,
  } = await import('./templateScriptProviders')

  const provider = new WeappTemplateScriptReferenceProvider()
  const document = createTextDocument(
    'vue',
    files.get(path.normalize('/workspace/src/components/card/user/index.vue'))!,
    path.normalize('/workspace/src/components/card/user/index.vue'),
  )
  const documentText = document.getText()
  const propPosition = document.positionAt(documentText.indexOf('titleText') + 2)
  const eventPosition = document.positionAt(documentText.indexOf('confirm') + 2)

  const propReferences = await provider.provideReferences(document as any, propPosition as any, { includeDeclaration: true } as any)
  const eventReferences = await provider.provideReferences(document as any, eventPosition as any, { includeDeclaration: true } as any)

  assert.equal(propReferences.length, 3)
  assert.equal(propReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/components/card/user/index.vue')).length, 1)
  assert.equal(propReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/pages/home/index.vue')).length, 1)
  assert.equal(propReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/pages/detail/index.wxml')).length, 1)
  assert.equal(eventReferences.length, 3)
  assert.equal(eventReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/components/card/user/index.vue')).length, 1)
  assert.equal(eventReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/pages/home/index.vue')).length, 1)
  assert.equal(eventReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/pages/detail/index.wxml')).length, 1)
})

it('provides script-side prop and event references for native component scripts', async () => {
  const files = new Map<string, string>([
    [path.normalize('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [path.normalize('/workspace/src/app.json'), JSON.stringify({
      pages: ['pages/home/index'],
    })],
    [path.normalize('/workspace/src/components/card/native/index.wxml'), '<view />'],
    [path.normalize('/workspace/src/components/card/native/index.ts'), [
      'Component({',
      '  properties: {',
      '    titleText: String,',
      '  },',
      '  methods: {',
      '    submit() {',
      '      this.triggerEvent(\'confirm\')',
      '    },',
      '  },',
      '})',
    ].join('\n')],
    [path.normalize('/workspace/src/pages/home/index.vue'), [
      '<template>',
      '  <card-native title-text="a" bind:confirm="handleTap" />',
      '</template>',
      '<json>',
      '{',
      '  "usingComponents": {',
      '    "card-native": "../../components/card/native/index"',
      '  }',
      '}',
      '</json>',
    ].join('\n')],
    [path.normalize('/workspace/src/pages/detail/index.wxml'), '<card-native title-text="b" bind:confirm="handleTap"></card-native>'],
    [path.normalize('/workspace/src/pages/detail/index.json'), JSON.stringify({
      usingComponents: {
        'card-native': '/components/card/native/index',
      },
    })],
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
            if (!files.has(path.normalize(uri.fsPath))) {
              throw new Error('not found')
            }

            return { type: 0 }
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = files.get(path.normalize(uri.fsPath))

            if (content == null) {
              throw new Error('not found')
            }

            return Buffer.from(content)
          },
        },
        findFiles: async (pattern: { pattern?: string }) => {
          const suffix = pattern.pattern?.endsWith('*.vue')
            ? '.vue'
            : pattern.pattern?.endsWith('*.wxml')
              ? '.wxml'
              : ''

          return [...files.keys()]
            .filter(filePath => filePath.endsWith(suffix))
            .map((filePath) => {
              return {
                fsPath: filePath,
                path: filePath,
              }
            })
        },
        openTextDocument: async (uri: { fsPath: string }) => {
          const fsPath = path.normalize(uri.fsPath)
          const text = files.get(fsPath)

          if (text == null) {
            throw new Error('not found')
          }

          return createTextDocument(getLanguageIdFromPath(fsPath), text, fsPath)
        },
        getWorkspaceFolder: () => ({
          name: 'demo',
          uri: {
            fsPath: '/workspace',
            path: '/workspace',
          },
        }),
        getConfiguration: () => ({
          get(_key: string, defaultValue: unknown) {
            return defaultValue
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
      Position: class {
        line
        character

        constructor(line: number, character: number) {
          this.line = line
          this.character = character
        }
      },
      Range: class {
        start
        end

        constructor(start: any, end: any) {
          this.start = start
          this.end = end
        }
      },
      Location: class {
        uri
        range

        constructor(uri: any, range: any) {
          this.uri = uri
          this.range = range
        }
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
    WeappTemplateScriptReferenceProvider,
  } = await import('./templateScriptProviders')

  const provider = new WeappTemplateScriptReferenceProvider()
  const document = createTextDocument(
    'typescript',
    files.get(path.normalize('/workspace/src/components/card/native/index.ts'))!,
    path.normalize('/workspace/src/components/card/native/index.ts'),
  )
  const documentText = document.getText()
  const propPosition = document.positionAt(documentText.indexOf('titleText') + 2)
  const eventPosition = document.positionAt(documentText.indexOf('confirm') + 2)

  const propReferences = await provider.provideReferences(document as any, propPosition as any, { includeDeclaration: true } as any)
  const eventReferences = await provider.provideReferences(document as any, eventPosition as any, { includeDeclaration: true } as any)

  assert.equal(propReferences.length, 3)
  assert.equal(propReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/components/card/native/index.ts')).length, 1)
  assert.equal(propReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/pages/home/index.vue')).length, 1)
  assert.equal(propReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/pages/detail/index.wxml')).length, 1)
  assert.equal(eventReferences.length, 3)
  assert.equal(eventReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/components/card/native/index.ts')).length, 1)
  assert.equal(eventReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/pages/home/index.vue')).length, 1)
  assert.equal(eventReferences.filter((item: any) => item.uri.fsPath === path.normalize('/workspace/src/pages/detail/index.wxml')).length, 1)
})
