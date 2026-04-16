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
    lineAt(line: number) {
      return {
        text: text.split('\n')[line] ?? '',
      }
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

afterEach(() => {
  vi.clearAllMocks()
  vi.doUnmock('vscode')
  vi.resetModules()
})

it('provides local component definitions and resource links for wxml documents', async () => {
  const files = new Map<string, string>([
    [path.normalize('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [path.normalize('/workspace/src/app.json'), '{}'],
    [path.normalize('/workspace/src/pages/home/index.json'), JSON.stringify({
      usingComponents: {
        'card-user': '/components/card/user/index',
      },
    })],
    [path.normalize('/workspace/src/pages/home/index.ts'), [
      'const pageTitle = \'demo\'',
      'function handleTap() {}',
    ].join('\n')],
    [path.normalize('/workspace/src/pages/home/index.wxss'), [
      '.hero { color: red; }',
      '.hero-title { color: blue; }',
    ].join('\n')],
    [path.normalize('/workspace/src/components/card/user/index.vue'), [
      '<script setup lang="ts">',
      'defineProps<{',
      '  titleText?: string',
      '  count: number',
      '}>()',
      'const active = defineModel<boolean>(\'active\')',
      '</script>',
      '<template><view /></template>',
    ].join('\n')],
    [path.normalize('/workspace/src/assets/banner.png'), 'binary'],
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
      Location: class {
        uri
        range

        constructor(uri: any, range: any) {
          this.uri = uri
          this.range = range
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
      CompletionItem: class {
        label
        kind

        constructor(label: string, kind: number) {
          this.label = label
          this.kind = kind
        }
      },
      CompletionItemKind: {
        Module: 1,
        Property: 2,
        Value: 3,
      },
      SnippetString: class {
        value

        constructor(value: string) {
          this.value = value
        }
      },
      MarkdownString: class {
        value

        constructor(value: string) {
          this.value = value
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
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateCompletionProvider,
    WeappTemplateDefinitionProvider,
    WeappTemplateDocumentLinkProvider,
  } = await import('./templateProviders')

  const completionProvider = new WeappTemplateCompletionProvider()
  const definitionProvider = new WeappTemplateDefinitionProvider()
  const linkProvider = new WeappTemplateDocumentLinkProvider()
  const document = createTextDocument(
    'wxml',
    '<card-user class="hero hero-title" bindtap="handleTap" src="/assets/banner.png">{{ pageTitle }}</card-user>',
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const documentText = document.getText()
  const tagPosition = document.positionAt(documentText.indexOf('card-user') + 2)
  const attributePosition = document.positionAt(documentText.indexOf('bindtap') - 1)
  const classValuePosition = document.positionAt(documentText.indexOf('hero-title') + 2)
  const methodPosition = document.positionAt(documentText.indexOf('handleTap') + 2)
  const interpolationPosition = document.positionAt(documentText.indexOf('pageTitle') + 2)

  const completionItems = await completionProvider.provideCompletionItems(document as any, tagPosition as any)
  const attributeCompletionItems = await completionProvider.provideCompletionItems(document as any, attributePosition as any)
  const classCompletionItems = await completionProvider.provideCompletionItems(document as any, classValuePosition as any)
  const tagDefinition = await definitionProvider.provideDefinition(document as any, tagPosition as any)
  const classDefinition = await definitionProvider.provideDefinition(document as any, classValuePosition as any)
  const methodDefinition = await definitionProvider.provideDefinition(document as any, methodPosition as any)
  const interpolationDefinition = await definitionProvider.provideDefinition(document as any, interpolationPosition as any)
  const links = await linkProvider.provideDocumentLinks(document as any)

  assert.equal(completionItems[0].label, 'card-user')
  assert.equal(attributeCompletionItems.some((item: any) => item.label === 'title-text'), true)
  assert.equal(attributeCompletionItems.some((item: any) => item.label === 'active'), true)
  assert.equal(classCompletionItems.some((item: any) => item.label === 'hero-title'), true)
  assert.equal(tagDefinition?.uri.fsPath, path.normalize('/workspace/src/components/card/user/index.vue'))
  assert.equal(classDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.wxss'))
  assert.equal(methodDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.ts'))
  assert.equal(interpolationDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.ts'))
  assert.equal(links.length, 1)
  assert.equal(links[0].target.fsPath, path.normalize('/workspace/src/assets/banner.png'))
})

it('provides style class completions and definitions inside vue template values', async () => {
  const files = new Map<string, string>([
    [path.normalize('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [path.normalize('/workspace/src/app.json'), JSON.stringify({
      pages: ['pages/home/index'],
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
      Location: class {
        uri
        range

        constructor(uri: any, range: any) {
          this.uri = uri
          this.range = range
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
      CompletionItem: class {
        label
        kind

        constructor(label: string, kind: number) {
          this.label = label
          this.kind = kind
        }
      },
      CompletionItemKind: {
        Module: 1,
        Property: 2,
        Value: 3,
      },
      SnippetString: class {
        value

        constructor(value: string) {
          this.value = value
        }
      },
      MarkdownString: class {
        value

        constructor(value: string) {
          this.value = value
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
    WeappTemplateCompletionProvider,
    WeappTemplateDefinitionProvider,
  } = await import('./templateProviders')

  const document = createTextDocument(
    'vue',
    [
      '<template>',
      '  <view class="page-title"></view>',
      '</template>',
      '<script setup lang="ts">',
      'const title = \'demo\'',
      '</script>',
      '<style scoped>',
      '.page-title { color: red; }',
      '.page-desc { color: blue; }',
      '</style>',
    ].join('\n'),
    path.normalize('/workspace/src/pages/home/index.vue'),
  )
  const documentText = document.getText()
  const classPosition = document.positionAt(documentText.indexOf('page-title') + 2)
  const completionProvider = new WeappTemplateCompletionProvider()
  const definitionProvider = new WeappTemplateDefinitionProvider()

  const completionItems = await completionProvider.provideCompletionItems(document as any, classPosition as any)
  const definition = await definitionProvider.provideDefinition(document as any, classPosition as any)

  assert.equal(completionItems.some((item: any) => item.label === 'page-desc'), true)
  assert.equal(definition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.vue'))
})
