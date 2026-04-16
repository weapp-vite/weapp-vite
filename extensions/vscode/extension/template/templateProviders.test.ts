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
      'const bottom = 24',
      'const handlers = {',
      '  onTap() {},',
      '}',
      'function handleTap() {}',
    ].join('\n')],
    [path.normalize('/workspace/src/pages/home/index.wxss'), [
      '.hero { color: red; }',
      '.hero-title { color: blue; }',
    ].join('\n')],
    [path.normalize('/workspace/src/pages/about/index.vue'), '<template><view /></template>'],
    [path.normalize('/workspace/src/components/card/user/index.vue'), [
      '<script setup lang="ts">',
      'defineProps<{',
      '  titleText?: string',
      '  count: number',
      '}>()',
      'defineEmits<{',
      '  (e: \'confirm\', value: number): void',
      '}>()',
      'const active = defineModel<boolean>(\'active\')',
      '</script>',
      '<template><view /></template>',
    ].join('\n')],
    [path.normalize('/workspace/src/assets/banner.png'), 'binary'],
    [path.normalize('/workspace/src/templates/header.wxml'), '<view>header</view>'],
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
        Event: 4,
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
      Hover: class {
        contents

        constructor(contents: any) {
          this.contents = contents
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
      DocumentHighlight: class {
        range

        constructor(range: any) {
          this.range = range
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
    WeappTemplateHoverProvider,
  } = await import('./templateProviders')

  const completionProvider = new WeappTemplateCompletionProvider()
  const definitionProvider = new WeappTemplateDefinitionProvider()
  const linkProvider = new WeappTemplateDocumentLinkProvider()
  const hoverProvider = new WeappTemplateHoverProvider()
  const document = createTextDocument(
    'wxml',
    '<import src="/templates/header.wxml" /><navigator url="/pages/about/index?from=home" /><card-user class="hero hero-title" style="height: {{ bottom }}rpx" bindtap="handlers.onTap" src="/assets/banner.png">{{ pageTitle }}</card-user>',
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const hoverDocument = createTextDocument(
    'wxml',
    '<card-user title-text="{{ pageTitle }}" bind:confirm="handleTap"></card-user>',
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const documentText = document.getText()
  const hoverDocumentText = hoverDocument.getText()
  const tagPosition = document.positionAt(documentText.indexOf('card-user') + 2)
  const attributePosition = document.positionAt(documentText.indexOf('bindtap') - 1)
  const hoverTagPosition = hoverDocument.positionAt(hoverDocumentText.indexOf('card-user') + 2)
  const propHoverPosition = hoverDocument.positionAt(hoverDocumentText.indexOf('title-text') + 2)
  const eventHoverPosition = hoverDocument.positionAt(hoverDocumentText.indexOf('bind:confirm') + 2)
  const propNamePosition = hoverDocument.positionAt(hoverDocumentText.indexOf('title-text') + 2)
  const eventNamePosition = hoverDocument.positionAt(hoverDocumentText.indexOf('bind:confirm') + 2)
  const routePosition = document.positionAt(documentText.indexOf('/pages/about/index') + 2)
  const classValuePosition = document.positionAt(documentText.indexOf('hero-title') + 2)
  const methodPosition = document.positionAt(documentText.indexOf('onTap') + 2)
  const interpolationPosition = document.positionAt(documentText.indexOf('pageTitle') + 2)
  const attrInterpolationPosition = document.positionAt(documentText.indexOf('bottom') + 2)

  const completionItems = await completionProvider.provideCompletionItems(document as any, tagPosition as any)
  const attributeCompletionItems = await completionProvider.provideCompletionItems(document as any, attributePosition as any)
  const classCompletionItems = await completionProvider.provideCompletionItems(document as any, classValuePosition as any)
  const tagDefinition = await definitionProvider.provideDefinition(document as any, tagPosition as any)
  const classDefinition = await definitionProvider.provideDefinition(document as any, classValuePosition as any)
  const methodDefinition = await definitionProvider.provideDefinition(document as any, methodPosition as any)
  const interpolationDefinition = await definitionProvider.provideDefinition(document as any, interpolationPosition as any)
  const attrInterpolationDefinition = await definitionProvider.provideDefinition(document as any, attrInterpolationPosition as any)
  const routeDefinition = await definitionProvider.provideDefinition(document as any, routePosition as any)
  const propNameDefinition = await definitionProvider.provideDefinition(hoverDocument as any, propNamePosition as any)
  const eventNameDefinition = await definitionProvider.provideDefinition(hoverDocument as any, eventNamePosition as any)
  const links = await linkProvider.provideDocumentLinks(document as any)
  const tagHover = await hoverProvider.provideHover(hoverDocument as any, hoverTagPosition as any)
  const propHover = await hoverProvider.provideHover(hoverDocument as any, propHoverPosition as any)
  const eventHover = await hoverProvider.provideHover(hoverDocument as any, eventHoverPosition as any)

  assert.equal(completionItems[0].label, 'card-user')
  assert.equal(completionItems[0].documentation.value.includes('项目组件'), true)
  assert.equal(completionItems[0].documentation.value.includes('### 属性'), true)
  assert.equal(completionItems[0].documentation.value.includes('`title-text`'), true)
  assert.equal(completionItems[0].documentation.value.includes('### 事件'), true)
  assert.equal(completionItems[0].documentation.value.includes('`bind:confirm`'), true)
  assert.equal(completionItems.find((item: any) => item.label === 'view')?.detail, 'native component')
  assert.equal(attributeCompletionItems.some((item: any) => item.label === 'title-text'), true)
  assert.equal(attributeCompletionItems.some((item: any) => item.label === 'active'), true)
  assert.equal(attributeCompletionItems.some((item: any) => item.label === 'bind:confirm'), true)
  assert.equal(
    attributeCompletionItems.find((item: any) => item.label === 'title-text')?.documentation.value.includes('类型: `string`'),
    true,
  )
  assert.equal(
    attributeCompletionItems.find((item: any) => item.label === 'bind:confirm')?.documentation.value.includes('参数: `value: number`'),
    true,
  )
  assert.equal(classCompletionItems.some((item: any) => item.label === 'hero-title'), true)
  assert.equal(tagDefinition?.uri.fsPath, path.normalize('/workspace/src/components/card/user/index.vue'))
  assert.equal(classDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.wxss'))
  assert.equal(methodDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.ts'))
  assert.equal(methodDefinition?.range.line, 3)
  assert.equal(interpolationDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.ts'))
  assert.equal(attrInterpolationDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.ts'))
  assert.equal(attrInterpolationDefinition?.range.line, 1)
  assert.equal(routeDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/about/index.vue'))
  assert.equal(propNameDefinition?.uri.fsPath, path.normalize('/workspace/src/components/card/user/index.vue'))
  assert.equal(propNameDefinition?.range.line, 2)
  assert.equal(eventNameDefinition?.uri.fsPath, path.normalize('/workspace/src/components/card/user/index.vue'))
  assert.equal(eventNameDefinition?.range.line, 6)
  assert.equal(links.length, 3)
  assert.deepEqual(
    links.map((link: any) => link.target.fsPath).sort(),
    [
      path.normalize('/workspace/src/assets/banner.png'),
      path.normalize('/workspace/src/pages/about/index.vue'),
      path.normalize('/workspace/src/templates/header.wxml'),
    ].sort(),
  )
  assert.equal(tagHover?.contents.value.includes('项目组件'), true)
  assert.equal(tagHover?.contents.value.includes('### 属性'), true)
  assert.equal(tagHover?.contents.value.includes('`title-text`'), true)
  assert.equal(tagHover?.contents.value.includes('### 事件'), true)
  assert.equal(tagHover?.contents.value.includes('`bind:confirm`'), true)
  assert.equal(propHover?.contents.value.includes('组件属性'), true)
  assert.equal(propHover?.contents.value.includes('类型: `string`'), true)
  assert.equal(eventHover?.contents.value.includes('组件事件'), true)
  assert.equal(eventHover?.contents.value.includes('参数: `value: number`'), true)
})

it('provides route links inside recognized vue template documents', async () => {
  const files = new Map<string, string>([
    [path.normalize('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [path.normalize('/workspace/src/app.json'), JSON.stringify({
      pages: ['pages/home/index', 'pages/about/index'],
    })],
    [path.normalize('/workspace/src/pages/about/index.vue'), '<template><view /></template>'],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      window: {
        activeTextEditor: undefined,
      },
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
    WeappTemplateDefinitionProvider,
    WeappTemplateDocumentLinkProvider,
  } = await import('./templateProviders')

  const definitionProvider = new WeappTemplateDefinitionProvider()
  const linkProvider = new WeappTemplateDocumentLinkProvider()
  const document = createTextDocument(
    'vue',
    [
      '<template>',
      '  <navigator url="/pages/about/index?tab=detail" />',
      '</template>',
      '<script setup lang="ts">',
      'const ok = true',
      '</script>',
    ].join('\n'),
    path.normalize('/workspace/src/pages/home/index.vue'),
  )
  const documentText = document.getText()
  const routePosition = document.positionAt(documentText.indexOf('/pages/about/index') + 2)

  const definition = await definitionProvider.provideDefinition(document as any, routePosition as any)
  const links = await linkProvider.provideDocumentLinks(document as any)

  assert.equal(definition?.uri.fsPath, path.normalize('/workspace/src/pages/about/index.vue'))
  assert.equal(links.length, 1)
  assert.equal(links[0].target.fsPath, path.normalize('/workspace/src/pages/about/index.vue'))
})

it('supports token-level script definitions inside recognized vue templates', async () => {
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
      window: {
        activeTextEditor: undefined,
      },
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
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateDefinitionProvider,
  } = await import('./templateProviders')

  const definitionProvider = new WeappTemplateDefinitionProvider()
  const document = createTextDocument(
    'vue',
    [
      '<template>',
      '  <view bindtap="handlers.onTap">{{ pageTitle }}</view>',
      '  <view style="height: {{ bottom }}rpx" />',
      '</template>',
      '<script setup lang="ts">',
      'const pageTitle = \'demo\'',
      'const bottom = 24',
      'const handlers = {',
      '  onTap() {},',
      '}',
      '</script>',
    ].join('\n'),
    path.normalize('/workspace/src/pages/home/index.vue'),
  )
  const documentText = document.getText()
  const methodPosition = document.positionAt(documentText.indexOf('onTap') + 2)
  const interpolationPosition = document.positionAt(documentText.indexOf('pageTitle') + 2)
  const attrInterpolationPosition = document.positionAt(documentText.indexOf('bottom') + 2)

  const methodDefinition = await definitionProvider.provideDefinition(document as any, methodPosition as any)
  const interpolationDefinition = await definitionProvider.provideDefinition(document as any, interpolationPosition as any)
  const attrInterpolationDefinition = await definitionProvider.provideDefinition(document as any, attrInterpolationPosition as any)

  assert.equal(methodDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.vue'))
  assert.equal(methodDefinition?.range.line, 8)
  assert.equal(interpolationDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.vue'))
  assert.equal(interpolationDefinition?.range.line, 5)
  assert.equal(attrInterpolationDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.vue'))
  assert.equal(attrInterpolationDefinition?.range.line, 6)
})

it('resolves wx:for locals and event expression tokens precisely in wxml documents', async () => {
  const files = new Map<string, string>([
    [path.normalize('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [path.normalize('/workspace/src/app.json'), '{}'],
    [path.normalize('/workspace/src/pages/home/index.ts'), [
      'const list = []',
      'const pageTitle = \'demo\'',
      'const handlers = {',
      '  onTap() {},',
      '}',
    ].join('\n')],
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
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateDefinitionProvider,
  } = await import('./templateProviders')

  const definitionProvider = new WeappTemplateDefinitionProvider()
  const document = createTextDocument(
    'wxml',
    [
      '<view wx:for="{{ list }}" wx:for-item="product" wx:for-index="idx">',
      '  <view bindtap="handlers.onTap(product, idx)">{{ product.name }} {{ idx }} {{ pageTitle }}</view>',
      '</view>',
    ].join('\n'),
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const documentText = document.getText()
  const handlersPosition = document.positionAt(documentText.indexOf('handlers') + 2)
  const onTapPosition = document.positionAt(documentText.indexOf('onTap') + 2)
  const productArgPosition = document.positionAt(documentText.indexOf('product, idx') + 2)
  const idxArgPosition = document.positionAt(documentText.indexOf('idx)') + 1)
  const productInterpolationPosition = document.positionAt(documentText.lastIndexOf('product.name') + 2)
  const idxInterpolationPosition = document.positionAt(documentText.lastIndexOf('{{ idx }}') + 3)
  const pageTitlePosition = document.positionAt(documentText.indexOf('pageTitle') + 2)

  const handlersDefinition = await definitionProvider.provideDefinition(document as any, handlersPosition as any)
  const onTapDefinition = await definitionProvider.provideDefinition(document as any, onTapPosition as any)
  const productArgDefinition = await definitionProvider.provideDefinition(document as any, productArgPosition as any)
  const idxArgDefinition = await definitionProvider.provideDefinition(document as any, idxArgPosition as any)
  const productInterpolationDefinition = await definitionProvider.provideDefinition(document as any, productInterpolationPosition as any)
  const idxInterpolationDefinition = await definitionProvider.provideDefinition(document as any, idxInterpolationPosition as any)
  const pageTitleDefinition = await definitionProvider.provideDefinition(document as any, pageTitlePosition as any)

  assert.equal(handlersDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.ts'))
  assert.equal(handlersDefinition?.range.line, 2)
  assert.equal(onTapDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.ts'))
  assert.equal(onTapDefinition?.range.line, 3)
  assert.equal(productArgDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.wxml'))
  assert.equal(productArgDefinition?.range.line, 0)
  assert.equal(idxArgDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.wxml'))
  assert.equal(idxArgDefinition?.range.line, 0)
  assert.equal(productInterpolationDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.wxml'))
  assert.equal(productInterpolationDefinition?.range.line, 0)
  assert.equal(idxInterpolationDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.wxml'))
  assert.equal(idxInterpolationDefinition?.range.line, 0)
  assert.equal(pageTitleDefinition?.uri.fsPath, path.normalize('/workspace/src/pages/home/index.ts'))
  assert.equal(pageTitleDefinition?.range.line, 1)
})

it('supports native custom component props and events in wxml documents', async () => {
  const files = new Map<string, string>([
    [path.normalize('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [path.normalize('/workspace/src/app.json'), '{}'],
    [path.normalize('/workspace/src/pages/home/index.json'), JSON.stringify({
      usingComponents: {
        'card-native': '/components/card/native/index',
      },
    })],
    [path.normalize('/workspace/src/pages/home/index.ts'), [
      'const pageTitle = \'demo\'',
      'function handleTap() {}',
    ].join('\n')],
    [path.normalize('/workspace/src/components/card/native/index.wxml'), '<view />'],
    [path.normalize('/workspace/src/components/card/native/index.ts'), [
      'Component({',
      '  properties: {',
      '    titleText: String,',
      '    active: { type: Boolean },',
      '  },',
      '  methods: {',
      '    handleConfirm() {',
      '      this.triggerEvent(\'confirm\')',
      '    },',
      '  },',
      '})',
    ].join('\n')],
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
        Event: 4,
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
      Hover: class {
        contents

        constructor(contents: any) {
          this.contents = contents
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateCompletionProvider,
    WeappTemplateDefinitionProvider,
    WeappTemplateHoverProvider,
  } = await import('./templateProviders')

  const completionProvider = new WeappTemplateCompletionProvider()
  const definitionProvider = new WeappTemplateDefinitionProvider()
  const hoverProvider = new WeappTemplateHoverProvider()
  const attrDocument = createTextDocument(
    'wxml',
    '<card-native dummy="" foo=""></card-native>',
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const usageDocument = createTextDocument(
    'wxml',
    '<card-native title-text="{{ pageTitle }}" bind:confirm="handleTap"></card-native>',
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const attrText = attrDocument.getText()
  const usageText = usageDocument.getText()
  const attrPosition = attrDocument.positionAt(attrText.indexOf('foo') - 1)
  const tagPosition = usageDocument.positionAt(usageText.indexOf('card-native') + 2)
  const propPosition = usageDocument.positionAt(usageText.indexOf('title-text') + 2)
  const eventPosition = usageDocument.positionAt(usageText.indexOf('bind:confirm') + 2)

  const attrItems = await completionProvider.provideCompletionItems(attrDocument as any, attrPosition as any)
  const tagItems = await completionProvider.provideCompletionItems(usageDocument as any, tagPosition as any)
  const tagDefinition = await definitionProvider.provideDefinition(usageDocument as any, tagPosition as any)
  const propDefinition = await definitionProvider.provideDefinition(usageDocument as any, propPosition as any)
  const eventDefinition = await definitionProvider.provideDefinition(usageDocument as any, eventPosition as any)
  const tagHover = await hoverProvider.provideHover(usageDocument as any, tagPosition as any)
  const propHover = await hoverProvider.provideHover(usageDocument as any, propPosition as any)
  const eventHover = await hoverProvider.provideHover(usageDocument as any, eventPosition as any)

  assert.equal(attrItems.some((item: any) => item.label === 'title-text'), true)
  assert.equal(attrItems.some((item: any) => item.label === 'bind:confirm'), true)
  assert.equal(tagItems.find((item: any) => item.label === 'card-native')?.documentation.value.includes('### 属性'), true)
  assert.equal(tagItems.find((item: any) => item.label === 'card-native')?.documentation.value.includes('`title-text`'), true)
  assert.equal(tagItems.find((item: any) => item.label === 'card-native')?.documentation.value.includes('### 事件'), true)
  assert.equal(tagItems.find((item: any) => item.label === 'card-native')?.documentation.value.includes('`bind:confirm`'), true)
  assert.equal(tagDefinition?.uri.fsPath, path.normalize('/workspace/src/components/card/native/index.wxml'))
  assert.equal(tagHover?.contents.value.includes('### 属性'), true)
  assert.equal(tagHover?.contents.value.includes('`title-text`'), true)
  assert.equal(tagHover?.contents.value.includes('### 事件'), true)
  assert.equal(tagHover?.contents.value.includes('`bind:confirm`'), true)
  assert.equal(propDefinition?.uri.fsPath, path.normalize('/workspace/src/components/card/native/index.ts'))
  assert.equal(propDefinition?.range.line, 2)
  assert.equal(eventDefinition?.uri.fsPath, path.normalize('/workspace/src/components/card/native/index.ts'))
  assert.equal(eventDefinition?.range.line, 7)
  assert.equal(propHover?.contents.value.includes('/workspace/src/components/card/native/index.ts'), true)
  assert.equal(eventHover?.contents.value.includes('/workspace/src/components/card/native/index.ts'), true)
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
        Event: 4,
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
      DocumentHighlight: class {
        range

        constructor(range: any) {
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

it('filters native component attributes by current mode and completes conditional values', async () => {
  const files = new Map<string, string>([
    [path.normalize('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [path.normalize('/workspace/src/app.json'), '{}'],
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
        Event: 4,
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
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateCompletionProvider,
  } = await import('./templateProviders')

  const completionProvider = new WeappTemplateCompletionProvider()
  const modeValueDocument = createTextDocument(
    'wxml',
    '<picker mode=""></picker>',
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const modeValueText = modeValueDocument.getText()
  const modeValuePosition = modeValueDocument.positionAt(modeValueText.indexOf('""') + 1)
  const attrDocument = createTextDocument(
    'wxml',
    '<picker mode="time" ></picker>',
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const attrText = attrDocument.getText()
  const attrPosition = attrDocument.positionAt(attrText.indexOf('></picker>') - 1)

  const modeValueItems = await completionProvider.provideCompletionItems(modeValueDocument as any, modeValuePosition as any)
  const attrItems = await completionProvider.provideCompletionItems(attrDocument as any, attrPosition as any)

  assert.equal(modeValueItems.some((item: any) => item.label === 'time'), true)
  assert.equal(modeValueItems.some((item: any) => item.label === 'region'), true)
  assert.equal(
    modeValueItems.find((item: any) => item.label === 'time')?.documentation.value.includes('可用属性：'),
    true,
  )
  assert.equal(
    modeValueItems.find((item: any) => item.label === 'time')?.documentation.value.includes('`start`'),
    true,
  )
  assert.equal(modeValueItems.find((item: any) => item.label === 'time')?.detail, '可用: value, start, end 等4项')
  assert.equal(attrItems.some((item: any) => item.label === 'start'), true)
  assert.equal(attrItems.some((item: any) => item.label === 'end'), true)
  assert.equal(attrItems.some((item: any) => item.label === 'range-key'), false)
  assert.equal(attrItems.find((item: any) => item.label === 'start')?.detail, 'mode=time')
  assert.equal(
    attrItems.find((item: any) => item.label === 'start')?.documentation.value.includes('条件：`mode="time"`'),
    true,
  )
})

it('renders native conditional hover details for root and nested attrs', async () => {
  const files = new Map<string, string>([
    [path.normalize('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [path.normalize('/workspace/src/app.json'), '{}'],
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
      MarkdownString: class {
        value

        constructor(value: string) {
          this.value = value
        }
      },
      Hover: class {
        contents

        constructor(contents: any) {
          this.contents = contents
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateHoverProvider,
  } = await import('./templateProviders')

  const hoverProvider = new WeappTemplateHoverProvider()
  const modeDocument = createTextDocument(
    'wxml',
    '<picker mode="time"></picker>',
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const startDocument = createTextDocument(
    'wxml',
    '<picker mode="time" start="09:00"></picker>',
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const modeText = modeDocument.getText()
  const startText = startDocument.getText()
  const modePosition = modeDocument.positionAt(modeText.indexOf('mode') + 2)
  const startPosition = startDocument.positionAt(startText.indexOf('start') + 2)

  const modeHover = await hoverProvider.provideHover(modeDocument as any, modePosition as any)
  const startHover = await hoverProvider.provideHover(startDocument as any, startPosition as any)

  assert.equal(modeHover?.contents.value.includes('### 条件分支'), true)
  assert.equal(modeHover?.contents.value.includes('`time`'), true)
  assert.equal(startHover?.contents.value.includes('条件：`mode="time"`'), true)
})

it('highlights matching tags inside wxml documents', async () => {
  const files = new Map<string, string>([
    [path.normalize('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [path.normalize('/workspace/src/app.json'), '{}'],
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
      Range: class {
        start
        end

        constructor(start: any, end: any) {
          this.start = start
          this.end = end
        }
      },
      DocumentHighlight: class {
        range

        constructor(range: any) {
          this.range = range
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateDocumentHighlightProvider,
  } = await import('./templateProviders')

  const document = createTextDocument(
    'wxml',
    '<view><card-user><view /></card-user></view>',
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const documentText = document.getText()
  const tagPosition = document.positionAt(documentText.indexOf('card-user') + 2)
  const provider = new WeappTemplateDocumentHighlightProvider()
  const highlights = await provider.provideDocumentHighlights(document as any, tagPosition as any)

  assert.equal(highlights.length, 2)
  assert.deepEqual(highlights.map((item: any) => item.range.start.character), [7, 27])
})

it('highlights matching tags inside recognized vue templates', async () => {
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
      Range: class {
        start
        end

        constructor(start: any, end: any) {
          this.start = start
          this.end = end
        }
      },
      DocumentHighlight: class {
        range

        constructor(range: any) {
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
    WeappTemplateDocumentHighlightProvider,
  } = await import('./templateProviders')

  const document = createTextDocument(
    'vue',
    [
      '<template>',
      '  <card-user><view /></card-user>',
      '</template>',
    ].join('\n'),
    path.normalize('/workspace/src/pages/home/index.vue'),
  )
  const documentText = document.getText()
  const tagPosition = document.positionAt(documentText.indexOf('card-user') + 2)
  const provider = new WeappTemplateDocumentHighlightProvider()
  const highlights = await provider.provideDocumentHighlights(document as any, tagPosition as any)

  assert.equal(highlights.length, 2)
  assert.deepEqual(highlights.map((item: any) => item.range.start.line), [1, 1])
})

it('can disable vue template enhancements while keeping standalone wxml enhancements', async () => {
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
          get(key: string, defaultValue: unknown) {
            if (key === 'enableVueTemplateWxmlEnhancements') {
              return false
            }

            if (key === 'enableStandaloneWxmlEnhancements') {
              return true
            }

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
        Event: 4,
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
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateCompletionProvider,
  } = await import('./templateProviders')

  const provider = new WeappTemplateCompletionProvider()
  const vueDocument = createTextDocument(
    'vue',
    [
      '<template>',
      '  <view />',
      '</template>',
      '<script setup lang="ts">',
      '</script>',
    ].join('\n'),
    path.normalize('/workspace/src/pages/home/index.vue'),
  )
  const wxmlDocument = createTextDocument(
    'wxml',
    '<view />',
    path.normalize('/workspace/src/pages/home/index.wxml'),
  )
  const vueText = vueDocument.getText()
  const wxmlText = wxmlDocument.getText()

  const vueItems = await provider.provideCompletionItems(
    vueDocument as any,
    vueDocument.positionAt(vueText.indexOf('view') + 2) as any,
  )
  const wxmlItems = await provider.provideCompletionItems(
    wxmlDocument as any,
    wxmlDocument.positionAt(wxmlText.indexOf('view') + 2) as any,
  )

  assert.equal(vueItems.length, 0)
  assert.equal(wxmlItems.some((item: any) => item.label === 'view'), true)
})
