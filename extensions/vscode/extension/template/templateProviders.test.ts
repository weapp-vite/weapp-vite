/// <reference types="node" />

import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { afterEach, it, vi } from 'vitest'

interface MockUri {
  fsPath: string
  path: string
}

interface MockPosition {
  line: number
  character: number
}

interface MockRange {
  start: MockPosition
  end: MockPosition
}

interface _MockLocation {
  uri: MockUri
  range: MockRange | { line?: number, start?: { line: number } }
}

interface _MockHover {
  contents: unknown
}

interface _MockDocumentLink {
  range: MockRange
  target: MockUri
  tooltip?: string
}

interface _MockDocumentHighlight {
  range: MockRange
}

interface MockWorkspaceEditEntry {
  uri: MockUri
  range: MockRange
  newText: string
}

interface CompletionLikeItem {
  label: string
  detail?: string
  documentation?: unknown
}

function toUriPath(fsPath: string) {
  return fsPath.replace(/\\/gu, '/')
}

function mockWorkspacePath(filePath: string) {
  const workspaceRoot = path.resolve('/workspace')
  const relativePath = filePath.replace(/^\/workspace(?:\/|$)/u, '')

  return relativePath ? path.join(workspaceRoot, relativePath) : workspaceRoot
}

function normalizeFsPath(fsPath: string) {
  return toUriPath(path.normalize(fsPath))
}

function hasFsPathSuffix(fsPath: string, suffix: string) {
  return normalizeFsPath(fsPath).endsWith(suffix)
}

function normalizeMockUri<T extends MockUri>(uri: T): T {
  const fsPath = path.normalize(uri.fsPath)

  return {
    ...uri,
    fsPath,
    path: toUriPath(fsPath),
  }
}

function normalizeWorkspaceFolder<T extends { uri: MockUri }>(workspaceFolder: T): T {
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

function createTextDocument(languageId: string, text: string, fsPath: string) {
  return {
    languageId,
    uri: {
      fsPath,
      path: toUriPath(fsPath),
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

function getMarkdownValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => getMarkdownValue(item)).join('\n')
  }

  if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') {
    return value.value
  }

  return ''
}

function getLocationLine(location: { range?: { line?: number, start?: { line: number } } } | null | undefined) {
  return location?.range?.line ?? location?.range?.start?.line
}

function getWorkspaceEditEntries(edit: unknown): MockWorkspaceEditEntry[] {
  return ((edit as { edits?: MockWorkspaceEditEntry[] } | null | undefined)?.edits) ?? []
}

function hasLabel(items: CompletionLikeItem[], label: string) {
  return items.some(item => item.label === label)
}

function findByLabel(items: CompletionLikeItem[], label: string) {
  return items.find(item => item.label === label)
}

function getTargetPaths(links: _MockDocumentLink[]) {
  return links.map(link => normalizeFsPath(link.target.fsPath))
}

function getHighlightStartLines(highlights: _MockDocumentHighlight[]) {
  return highlights.map(item => item.range.start.line)
}

function getHighlightStartCharacters(highlights: _MockDocumentHighlight[]) {
  return highlights.map(item => item.range.start.character)
}

afterEach(() => {
  vi.clearAllMocks()
  vi.doUnmock('vscode')
  vi.resetModules()
})

it('provides local component definitions and resource links for wxml documents', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), '{}'],
    [mockWorkspacePath('/workspace/src/pages/home/index.json'), JSON.stringify({
      usingComponents: {
        'card-user': '/components/card/user/index',
      },
    })],
    [mockWorkspacePath('/workspace/src/pages/home/index.ts'), [
      'const pageTitle = \'demo\'',
      'const bottom = 24',
      'const handlers = {',
      '  onTap() {},',
      '}',
      'function handleTap() {}',
    ].join('\n')],
    [mockWorkspacePath('/workspace/src/pages/home/index.wxss'), [
      '.hero { color: red; }',
      '.hero-title { color: blue; }',
    ].join('\n')],
    [mockWorkspacePath('/workspace/src/pages/about/index.vue'), '<template><view /></template>'],
    [mockWorkspacePath('/workspace/src/components/card/user/index.vue'), [
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
    [mockWorkspacePath('/workspace/src/assets/banner.png'), 'binary'],
    [mockWorkspacePath('/workspace/src/templates/header.wxml'), '<view>header</view>'],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        workspaceFolders: [
          {
            name: 'demo',
            uri: {
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(uri: MockUri, range: MockRange) {
          this.uri = uri
          this.range = range
        }
      },
      Range: class {
        start
        end

        constructor(start: MockPosition, end: MockPosition) {
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

        constructor(contents: unknown) {
          this.contents = contents
        }
      },
      DocumentLink: class {
        range
        target
        tooltip

        constructor(range: MockRange, target: MockUri) {
          this.range = range
          this.target = target
        }
      },
      DocumentHighlight: class {
        range

        constructor(range: MockRange) {
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
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
  )
  const hoverDocument = createTextDocument(
    'wxml',
    '<card-user title-text="{{ pageTitle }}" bind:confirm="handleTap"></card-user>',
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
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

  const completionItems = await completionProvider.provideCompletionItems(document as any, tagPosition as any) as CompletionLikeItem[]
  const attributeCompletionItems = await completionProvider.provideCompletionItems(document as any, attributePosition as any) as CompletionLikeItem[]
  const classCompletionItems = await completionProvider.provideCompletionItems(document as any, classValuePosition as any) as CompletionLikeItem[]
  const tagDefinition = await definitionProvider.provideDefinition(document as any, tagPosition as any)
  const classDefinition = await definitionProvider.provideDefinition(document as any, classValuePosition as any)
  const methodDefinition = await definitionProvider.provideDefinition(document as any, methodPosition as any)
  const interpolationDefinition = await definitionProvider.provideDefinition(document as any, interpolationPosition as any)
  const attrInterpolationDefinition = await definitionProvider.provideDefinition(document as any, attrInterpolationPosition as any)
  const routeDefinition = await definitionProvider.provideDefinition(document as any, routePosition as any)
  const propNameDefinition = await definitionProvider.provideDefinition(hoverDocument as any, propNamePosition as any)
  const eventNameDefinition = await definitionProvider.provideDefinition(hoverDocument as any, eventNamePosition as any)
  const links = await linkProvider.provideDocumentLinks(document as any) as _MockDocumentLink[]
  const tagHover = await hoverProvider.provideHover(hoverDocument as any, hoverTagPosition as any) as _MockHover | null | undefined
  const propHover = await hoverProvider.provideHover(hoverDocument as any, propHoverPosition as any) as _MockHover | null | undefined
  const eventHover = await hoverProvider.provideHover(hoverDocument as any, eventHoverPosition as any) as _MockHover | null | undefined

  assert.equal(completionItems[0].label, 'card-user')
  assert.equal(getMarkdownValue(completionItems[0].documentation).includes('项目组件'), true)
  assert.equal(getMarkdownValue(completionItems[0].documentation).includes('### 属性'), true)
  assert.equal(getMarkdownValue(completionItems[0].documentation).includes('`title-text`'), true)
  assert.equal(getMarkdownValue(completionItems[0].documentation).includes('### 事件'), true)
  assert.equal(getMarkdownValue(completionItems[0].documentation).includes('`bind:confirm`'), true)
  assert.equal(findByLabel(completionItems, 'view')?.detail, 'native component')
  assert.equal(hasLabel(attributeCompletionItems, 'title-text'), true)
  assert.equal(hasLabel(attributeCompletionItems, 'active'), true)
  assert.equal(hasLabel(attributeCompletionItems, 'bind:confirm'), true)
  assert.equal(
    getMarkdownValue(findByLabel(attributeCompletionItems, 'title-text')?.documentation).includes('类型: `string`'),
    true,
  )
  assert.equal(
    getMarkdownValue(findByLabel(attributeCompletionItems, 'bind:confirm')?.documentation).includes('参数: `value: number`'),
    true,
  )
  assert.equal(hasLabel(classCompletionItems, 'hero-title'), true)
  assert.equal(tagDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/components/card/user/index.vue'))
  assert.equal(classDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.wxss'))
  assert.equal(methodDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.ts'))
  assert.equal(getLocationLine(methodDefinition), 3)
  assert.equal(interpolationDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.ts'))
  assert.equal(attrInterpolationDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.ts'))
  assert.equal(getLocationLine(attrInterpolationDefinition), 1)
  assert.equal(routeDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/about/index.vue'))
  assert.equal(propNameDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/components/card/user/index.vue'))
  assert.equal(getLocationLine(propNameDefinition), 2)
  assert.equal(eventNameDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/components/card/user/index.vue'))
  assert.equal(getLocationLine(eventNameDefinition), 6)
  assert.equal(links.length, 3)
  assert.deepEqual(
    getTargetPaths(links).sort(),
    [
      normalizeFsPath(mockWorkspacePath('/workspace/src/assets/banner.png')),
      normalizeFsPath(mockWorkspacePath('/workspace/src/pages/about/index.vue')),
      normalizeFsPath(mockWorkspacePath('/workspace/src/templates/header.wxml')),
    ].sort(),
  )
  assert.equal(getMarkdownValue(tagHover?.contents).includes('项目组件'), true)
  assert.equal(getMarkdownValue(tagHover?.contents).includes('### 属性'), true)
  assert.equal(getMarkdownValue(tagHover?.contents).includes('`title-text`'), true)
  assert.equal(getMarkdownValue(tagHover?.contents).includes('### 事件'), true)
  assert.equal(getMarkdownValue(tagHover?.contents).includes('`bind:confirm`'), true)
  assert.equal(getMarkdownValue(propHover?.contents).includes('组件属性'), true)
  assert.equal(getMarkdownValue(propHover?.contents).includes('类型: `string`'), true)
  assert.equal(getMarkdownValue(eventHover?.contents).includes('组件事件'), true)
  assert.equal(getMarkdownValue(eventHover?.contents).includes('参数: `value: number`'), true)
})

it('provides route links inside recognized vue template documents', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), JSON.stringify({
      pages: ['pages/home/index', 'pages/about/index'],
    })],
    [mockWorkspacePath('/workspace/src/pages/about/index.vue'), '<template><view /></template>'],
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
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(uri: MockUri, range: MockRange) {
          this.uri = uri
          this.range = range
        }
      },
      Range: class {
        start
        end

        constructor(start: MockPosition, end: MockPosition) {
          this.start = start
          this.end = end
        }
      },
      DocumentLink: class {
        range
        target
        tooltip

        constructor(range: MockRange, target: MockUri) {
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
    mockWorkspacePath('/workspace/src/pages/home/index.vue'),
  )
  const documentText = document.getText()
  const routePosition = document.positionAt(documentText.indexOf('/pages/about/index') + 2)

  const definition = await definitionProvider.provideDefinition(document as any, routePosition as any)
  const links = await linkProvider.provideDocumentLinks(document as any)

  assert.equal(definition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/about/index.vue'))
  assert.equal(links.length, 1)
  assert.equal(links[0].target.fsPath, mockWorkspacePath('/workspace/src/pages/about/index.vue'))
})

it('supports token-level script definitions inside recognized vue templates', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), JSON.stringify({
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
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(uri: MockUri, range: MockRange) {
          this.uri = uri
          this.range = range
        }
      },
      Range: class {
        start
        end

        constructor(start: MockPosition, end: MockPosition) {
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
    mockWorkspacePath('/workspace/src/pages/home/index.vue'),
  )
  const documentText = document.getText()
  const methodPosition = document.positionAt(documentText.indexOf('onTap') + 2)
  const interpolationPosition = document.positionAt(documentText.indexOf('pageTitle') + 2)
  const attrInterpolationPosition = document.positionAt(documentText.indexOf('bottom') + 2)

  const methodDefinition = await definitionProvider.provideDefinition(document as any, methodPosition as any)
  const interpolationDefinition = await definitionProvider.provideDefinition(document as any, interpolationPosition as any)
  const attrInterpolationDefinition = await definitionProvider.provideDefinition(document as any, attrInterpolationPosition as any)

  assert.equal(methodDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.vue'))
  assert.equal(getLocationLine(methodDefinition), 8)
  assert.equal(interpolationDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.vue'))
  assert.equal(getLocationLine(interpolationDefinition), 5)
  assert.equal(attrInterpolationDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.vue'))
  assert.equal(getLocationLine(attrInterpolationDefinition), 6)
})

it('resolves wx:for locals and event expression tokens precisely in wxml documents', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), '{}'],
    [mockWorkspacePath('/workspace/src/pages/home/index.ts'), [
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
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(uri: MockUri, range: MockRange) {
          this.uri = uri
          this.range = range
        }
      },
      Range: class {
        start
        end

        constructor(start: MockPosition, end: MockPosition) {
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
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
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

  assert.equal(handlersDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.ts'))
  assert.equal(getLocationLine(handlersDefinition), 2)
  assert.equal(onTapDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.ts'))
  assert.equal(getLocationLine(onTapDefinition), 3)
  assert.equal(productArgDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.wxml'))
  assert.equal(getLocationLine(productArgDefinition), 0)
  assert.equal(idxArgDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.wxml'))
  assert.equal(getLocationLine(idxArgDefinition), 0)
  assert.equal(productInterpolationDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.wxml'))
  assert.equal(getLocationLine(productInterpolationDefinition), 0)
  assert.equal(idxInterpolationDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.wxml'))
  assert.equal(getLocationLine(idxInterpolationDefinition), 0)
  assert.equal(pageTitleDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.ts'))
  assert.equal(getLocationLine(pageTitleDefinition), 1)
})

it('provides references and rename edits across template and companion script files', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), '{}'],
    [mockWorkspacePath('/workspace/src/pages/home/index.ts'), [
      'const list = []',
      'const pageTitle = \'demo\'',
      'console.log(pageTitle)',
      'const handlers = {',
      '  onTap(product, idx) {',
      '    return pageTitle + \'-\' + product.id + \'-\' + idx',
      '  },',
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
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(uri: MockUri, range: MockRange) {
          this.uri = uri
          this.range = range
        }
      },
      Range: class {
        start
        end

        constructor(start: MockPosition, end: MockPosition) {
          this.start = start
          this.end = end
        }
      },
      WorkspaceEdit: class {
        edits

        constructor() {
          this.edits = []
        }

        replace(uri: MockUri, range: MockRange, newText: string) {
          this.edits.push({ newText, range, uri })
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateReferenceProvider,
    WeappTemplateRenameProvider,
  } = await import('./templateProviders')

  const referenceProvider = new WeappTemplateReferenceProvider()
  const renameProvider = new WeappTemplateRenameProvider()
  const document = createTextDocument(
    'wxml',
    [
      '<view wx:for="{{ list }}" wx:for-item="product" wx:for-index="idx">',
      '  <view bindtap="handlers.onTap(product, idx)">{{ product.name }} {{ idx }} {{ pageTitle }}</view>',
      '</view>',
    ].join('\n'),
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
  )
  const documentText = document.getText()
  const pageTitlePosition = document.positionAt(documentText.indexOf('pageTitle') + 2)
  const onTapPosition = document.positionAt(documentText.indexOf('onTap') + 2)
  const productPosition = document.positionAt(documentText.indexOf('product.name') + 2)

  const pageTitleReferences = await referenceProvider.provideReferences(document as any, pageTitlePosition as any, { includeDeclaration: true } as any)
  const onTapReferences = await referenceProvider.provideReferences(document as any, onTapPosition as any, { includeDeclaration: true } as any)
  const productReferences = await referenceProvider.provideReferences(document as any, productPosition as any, { includeDeclaration: true } as any)
  const pageTitleRename = await renameProvider.provideRenameEdits(document as any, pageTitlePosition as any, 'pageHeading')
  const productRename = await renameProvider.provideRenameEdits(document as any, productPosition as any, 'goods')
  const onTapPrepare = await renameProvider.prepareRename(document as any, onTapPosition as any)

  assert.equal(pageTitleReferences.length, 4)
  assert.equal(pageTitleReferences.filter((item: any) => item.uri.fsPath.endsWith('index.ts')).length, 3)
  assert.equal(pageTitleReferences.filter((item: any) => item.uri.fsPath.endsWith('index.wxml')).length, 1)
  assert.equal(onTapReferences.length, 2)
  assert.equal(onTapReferences.every((item: any) => /index\.(?:ts|wxml)$/u.test(item.uri.fsPath)), true)
  assert.equal(productReferences.length, 3)
  assert.equal(productReferences.every((item: any) => item.uri.fsPath.endsWith('index.wxml')), true)
  assert.equal(getWorkspaceEditEntries(pageTitleRename).length, 4)
  assert.equal(getWorkspaceEditEntries(pageTitleRename).every((item: any) => item.newText === 'pageHeading'), true)
  assert.equal(getWorkspaceEditEntries(productRename).length, 3)
  assert.equal(getWorkspaceEditEntries(productRename).every((item: any) => item.newText === 'goods'), true)
  assert.equal(onTapPrepare?.placeholder, 'onTap')
})

it('provides references and rename edits across recognized vue template and script blocks', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), JSON.stringify({
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
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(uri: MockUri, range: MockRange) {
          this.uri = uri
          this.range = range
        }
      },
      Range: class {
        start
        end

        constructor(start: MockPosition, end: MockPosition) {
          this.start = start
          this.end = end
        }
      },
      WorkspaceEdit: class {
        edits

        constructor() {
          this.edits = []
        }

        replace(uri: MockUri, range: MockRange, newText: string) {
          this.edits.push({ newText, range, uri })
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateReferenceProvider,
    WeappTemplateRenameProvider,
  } = await import('./templateProviders')

  const referenceProvider = new WeappTemplateReferenceProvider()
  const renameProvider = new WeappTemplateRenameProvider()
  const document = createTextDocument(
    'vue',
    [
      '<template>',
      '  <view>{{ pageTitle }}</view>',
      '  <button @tap="handlers.onTap(pageTitle)">ok</button>',
      '</template>',
      '<script setup lang="ts">',
      'const pageTitle = \'demo\'',
      'const handlers = {',
      '  onTap(value) {',
      '    return pageTitle + value',
      '  },',
      '}',
      '</script>',
    ].join('\n'),
    mockWorkspacePath('/workspace/src/pages/home/index.vue'),
  )
  const documentText = document.getText()
  const pageTitlePosition = document.positionAt(documentText.indexOf('pageTitle') + 2)
  const handlerObjectPosition = document.positionAt(documentText.indexOf('handlers.onTap') + 2)

  const pageTitleReferences = await referenceProvider.provideReferences(document as any, pageTitlePosition as any, { includeDeclaration: true } as any)
  const pageTitleRename = await renameProvider.provideRenameEdits(document as any, pageTitlePosition as any, 'pageHeading')
  const handlersRename = await renameProvider.provideRenameEdits(document as any, handlerObjectPosition as any, 'actions')

  assert.equal(pageTitleReferences.length, 4)
  assert.equal(pageTitleReferences.every((item: any) => item.uri.fsPath.endsWith('index.vue')), true)
  assert.equal(getWorkspaceEditEntries(pageTitleRename).length, 4)
  assert.equal(getWorkspaceEditEntries(pageTitleRename).every((item: any) => item.newText === 'pageHeading'), true)
  assert.equal(getWorkspaceEditEntries(handlersRename).length, 2)
  assert.equal(getWorkspaceEditEntries(handlersRename).every((item: any) => item.newText === 'actions'), true)
})

it('provides component tag and member references and rename edits for standalone wxml documents', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), '{}'],
    [mockWorkspacePath('/workspace/src/pages/home/index.json'), JSON.stringify({
      usingComponents: {
        'card-user': '/components/card/user/index',
      },
    })],
    [mockWorkspacePath('/workspace/src/components/card/user/index.vue'), [
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
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        workspaceFolders: [
          {
            name: 'demo',
            uri: {
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(uri: MockUri, range: MockRange) {
          this.uri = uri
          this.range = range
        }
      },
      Range: class {
        start
        end

        constructor(start: MockPosition, end: MockPosition) {
          this.start = start
          this.end = end
        }
      },
      WorkspaceEdit: class {
        edits

        constructor() {
          this.edits = []
        }

        replace(uri: MockUri, range: MockRange, newText: string) {
          this.edits.push({ newText, range, uri })
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateReferenceProvider,
    WeappTemplateRenameProvider,
  } = await import('./templateProviders')

  const referenceProvider = new WeappTemplateReferenceProvider()
  const renameProvider = new WeappTemplateRenameProvider()
  const document = createTextDocument(
    'wxml',
    [
      '<card-user title-text="a" bind:confirm="handleTap"></card-user>',
      '<card-user title-text="b" bind:confirm="handleTap"></card-user>',
    ].join('\n'),
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
  )
  const documentText = document.getText()
  const tagPosition = document.positionAt(documentText.indexOf('card-user') + 2)
  const propPosition = document.positionAt(documentText.indexOf('title-text') + 2)
  const eventPosition = document.positionAt(documentText.indexOf('bind:confirm') + 2)

  const tagReferences = await referenceProvider.provideReferences(document as any, tagPosition as any, { includeDeclaration: true } as any)
  const propReferences = await referenceProvider.provideReferences(document as any, propPosition as any, { includeDeclaration: true } as any)
  const eventReferences = await referenceProvider.provideReferences(document as any, eventPosition as any, { includeDeclaration: true } as any)
  const tagRename = await renameProvider.provideRenameEdits(document as any, tagPosition as any, 'profile-card')
  const propRename = await renameProvider.provideRenameEdits(document as any, propPosition as any, 'heading-text')
  const eventRename = await renameProvider.provideRenameEdits(document as any, eventPosition as any, 'bind:submit')

  assert.equal(tagReferences.length, 5)
  assert.equal(tagReferences.filter((item: any) => item.uri.fsPath.endsWith('index.wxml')).length, 4)
  assert.equal(tagReferences.filter((item: any) => item.uri.fsPath.endsWith('index.json')).length, 1)
  assert.equal(propReferences.length, 3)
  assert.equal(propReferences.filter((item: any) => item.uri.fsPath.endsWith('index.wxml')).length, 2)
  assert.equal(propReferences.filter((item: any) => hasFsPathSuffix(item.uri.fsPath, 'components/card/user/index.vue')).length, 1)
  assert.equal(eventReferences.length, 3)
  assert.equal(eventReferences.filter((item: any) => item.uri.fsPath.endsWith('index.wxml')).length, 2)
  assert.equal(eventReferences.filter((item: any) => hasFsPathSuffix(item.uri.fsPath, 'components/card/user/index.vue')).length, 1)
  assert.equal(getWorkspaceEditEntries(tagRename).length, 5)
  assert.equal(getWorkspaceEditEntries(tagRename).every((item: any) => item.newText === 'profile-card'), true)
  assert.equal(getWorkspaceEditEntries(propRename).length, 3)
  assert.equal(getWorkspaceEditEntries(propRename).filter((item: any) => item.newText === 'heading-text').length, 2)
  assert.equal(getWorkspaceEditEntries(propRename).find((item: any) => hasFsPathSuffix(item.uri.fsPath, 'components/card/user/index.vue'))?.newText, 'headingText')
  assert.equal(getWorkspaceEditEntries(eventRename).length, 3)
  assert.equal(getWorkspaceEditEntries(eventRename).filter((item: any) => item.newText === 'bind:submit').length, 2)
  assert.equal(getWorkspaceEditEntries(eventRename).find((item: any) => hasFsPathSuffix(item.uri.fsPath, 'components/card/user/index.vue'))?.newText, 'submit')
})

it('provides component tag and member references and rename edits for recognized vue template documents', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), JSON.stringify({
      pages: ['pages/home/index'],
    })],
    [mockWorkspacePath('/workspace/src/components/card/user/index.vue'), [
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
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(uri: MockUri, range: MockRange) {
          this.uri = uri
          this.range = range
        }
      },
      Range: class {
        start
        end

        constructor(start: MockPosition, end: MockPosition) {
          this.start = start
          this.end = end
        }
      },
      WorkspaceEdit: class {
        edits

        constructor() {
          this.edits = []
        }

        replace(uri: MockUri, range: MockRange, newText: string) {
          this.edits.push({ newText, range, uri })
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappTemplateReferenceProvider,
    WeappTemplateRenameProvider,
  } = await import('./templateProviders')

  const referenceProvider = new WeappTemplateReferenceProvider()
  const renameProvider = new WeappTemplateRenameProvider()
  const document = createTextDocument(
    'vue',
    [
      '<template>',
      '  <card-user title-text="a" bind:confirm="handleTap"></card-user>',
      '  <card-user title-text="b" bind:confirm="handleTap" />',
      '</template>',
      '<json>',
      '{',
      '  "usingComponents": {',
      '    "card-user": "../../components/card/user/index"',
      '  }',
      '}',
      '</json>',
      '<script setup lang="ts">',
      'function handleTap() {}',
      '</script>',
    ].join('\n'),
    mockWorkspacePath('/workspace/src/pages/home/index.vue'),
  )
  const documentText = document.getText()
  const tagPosition = document.positionAt(documentText.indexOf('card-user') + 2)
  const propPosition = document.positionAt(documentText.indexOf('title-text') + 2)
  const eventPosition = document.positionAt(documentText.indexOf('bind:confirm') + 2)

  const tagReferences = await referenceProvider.provideReferences(document as any, tagPosition as any, { includeDeclaration: true } as any)
  const propReferences = await referenceProvider.provideReferences(document as any, propPosition as any, { includeDeclaration: true } as any)
  const eventReferences = await referenceProvider.provideReferences(document as any, eventPosition as any, { includeDeclaration: true } as any)
  const tagRename = await renameProvider.provideRenameEdits(document as any, tagPosition as any, 'profile-card')
  const propRename = await renameProvider.provideRenameEdits(document as any, propPosition as any, 'heading-text')
  const eventRename = await renameProvider.provideRenameEdits(document as any, eventPosition as any, 'bind:submit')

  assert.equal(tagReferences.length, 4)
  assert.equal(tagReferences.every((item: any) => item.uri.fsPath.endsWith('index.vue')), true)
  assert.equal(propReferences.length, 3)
  assert.equal(propReferences.filter((item: any) => item.uri.fsPath === mockWorkspacePath('/workspace/src/pages/home/index.vue')).length, 2)
  assert.equal(propReferences.filter((item: any) => item.uri.fsPath === mockWorkspacePath('/workspace/src/components/card/user/index.vue')).length, 1)
  assert.equal(eventReferences.length, 3)
  assert.equal(eventReferences.filter((item: any) => item.uri.fsPath === mockWorkspacePath('/workspace/src/pages/home/index.vue')).length, 2)
  assert.equal(eventReferences.filter((item: any) => item.uri.fsPath === mockWorkspacePath('/workspace/src/components/card/user/index.vue')).length, 1)
  assert.equal(getWorkspaceEditEntries(tagRename).length, 4)
  assert.equal(getWorkspaceEditEntries(tagRename).every((item: any) => item.newText === 'profile-card'), true)
  assert.equal(getWorkspaceEditEntries(propRename).length, 3)
  assert.equal(getWorkspaceEditEntries(propRename).filter((item: any) => item.newText === 'heading-text').length, 2)
  assert.equal(getWorkspaceEditEntries(propRename).find((item: any) => item.uri.fsPath === mockWorkspacePath('/workspace/src/components/card/user/index.vue'))?.newText, 'headingText')
  assert.equal(getWorkspaceEditEntries(eventRename).length, 3)
  assert.equal(getWorkspaceEditEntries(eventRename).filter((item: any) => item.newText === 'bind:submit').length, 2)
  assert.equal(getWorkspaceEditEntries(eventRename).find((item: any) => item.uri.fsPath === mockWorkspacePath('/workspace/src/components/card/user/index.vue'))?.newText, 'submit')
})

it('supports native custom component props and events in wxml documents', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), '{}'],
    [mockWorkspacePath('/workspace/src/pages/home/index.json'), JSON.stringify({
      usingComponents: {
        'card-native': '/components/card/native/index',
      },
    })],
    [mockWorkspacePath('/workspace/src/pages/home/index.ts'), [
      'const pageTitle = \'demo\'',
      'function handleTap() {}',
    ].join('\n')],
    [mockWorkspacePath('/workspace/src/components/card/native/index.wxml'), '<view />'],
    [mockWorkspacePath('/workspace/src/components/card/native/index.ts'), [
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
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(uri: MockUri, range: MockRange) {
          this.uri = uri
          this.range = range
        }
      },
      Range: class {
        start
        end

        constructor(start: MockPosition, end: MockPosition) {
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

        constructor(contents: unknown) {
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
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
  )
  const usageDocument = createTextDocument(
    'wxml',
    '<card-native title-text="{{ pageTitle }}" bind:confirm="handleTap"></card-native>',
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
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
  assert.equal(getMarkdownValue(tagItems.find((item: any) => item.label === 'card-native')?.documentation).includes('### 属性'), true)
  assert.equal(getMarkdownValue(tagItems.find((item: any) => item.label === 'card-native')?.documentation).includes('`title-text`'), true)
  assert.equal(getMarkdownValue(tagItems.find((item: any) => item.label === 'card-native')?.documentation).includes('### 事件'), true)
  assert.equal(getMarkdownValue(tagItems.find((item: any) => item.label === 'card-native')?.documentation).includes('`bind:confirm`'), true)
  assert.equal(tagDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/components/card/native/index.wxml'))
  assert.equal(getMarkdownValue(tagHover?.contents).includes('### 属性'), true)
  assert.equal(getMarkdownValue(tagHover?.contents).includes('`title-text`'), true)
  assert.equal(getMarkdownValue(tagHover?.contents).includes('### 事件'), true)
  assert.equal(getMarkdownValue(tagHover?.contents).includes('`bind:confirm`'), true)
  assert.equal(propDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/components/card/native/index.ts'))
  assert.equal(getLocationLine(propDefinition), 2)
  assert.equal(eventDefinition?.uri.fsPath, mockWorkspacePath('/workspace/src/components/card/native/index.ts'))
  assert.equal(getLocationLine(eventDefinition), 7)
  assert.equal(
    normalizeFsPath(getMarkdownValue(propHover?.contents)).includes(normalizeFsPath(mockWorkspacePath('/workspace/src/components/card/native/index.ts'))),
    true,
  )
  assert.equal(
    normalizeFsPath(getMarkdownValue(eventHover?.contents)).includes(normalizeFsPath(mockWorkspacePath('/workspace/src/components/card/native/index.ts'))),
    true,
  )
})

it('provides style class completions and definitions inside vue template values', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), JSON.stringify({
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
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(uri: MockUri, range: MockRange) {
          this.uri = uri
          this.range = range
        }
      },
      Range: class {
        start
        end

        constructor(start: MockPosition, end: MockPosition) {
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

        constructor(range: MockRange, target: MockUri) {
          this.range = range
          this.target = target
        }
      },
      DocumentHighlight: class {
        range

        constructor(range: MockRange) {
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
    mockWorkspacePath('/workspace/src/pages/home/index.vue'),
  )
  const documentText = document.getText()
  const classPosition = document.positionAt(documentText.indexOf('page-title') + 2)
  const completionProvider = new WeappTemplateCompletionProvider()
  const definitionProvider = new WeappTemplateDefinitionProvider()

  const completionItems = await completionProvider.provideCompletionItems(document as any, classPosition as any)
  const definition = await definitionProvider.provideDefinition(document as any, classPosition as any)

  assert.equal(completionItems.some((item: any) => item.label === 'page-desc'), true)
  assert.equal(definition?.uri.fsPath, mockWorkspacePath('/workspace/src/pages/home/index.vue'))
})

it('filters native component attributes by current mode and completes conditional values', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), '{}'],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        workspaceFolders: [
          {
            name: 'demo',
            uri: {
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
  )
  const modeValueText = modeValueDocument.getText()
  const modeValuePosition = modeValueDocument.positionAt(modeValueText.indexOf('""') + 1)
  const attrDocument = createTextDocument(
    'wxml',
    '<picker mode="time" ></picker>',
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
  )
  const attrText = attrDocument.getText()
  const attrPosition = attrDocument.positionAt(attrText.indexOf('></picker>') - 1)

  const modeValueItems = await completionProvider.provideCompletionItems(modeValueDocument as any, modeValuePosition as any)
  const attrItems = await completionProvider.provideCompletionItems(attrDocument as any, attrPosition as any)

  assert.equal(modeValueItems.some((item: any) => item.label === 'time'), true)
  assert.equal(modeValueItems.some((item: any) => item.label === 'region'), true)
  assert.equal(
    getMarkdownValue(modeValueItems.find((item: any) => item.label === 'time')?.documentation).includes('可用属性：'),
    true,
  )
  assert.equal(
    getMarkdownValue(modeValueItems.find((item: any) => item.label === 'time')?.documentation).includes('`start`'),
    true,
  )
  assert.equal(modeValueItems.find((item: any) => item.label === 'time')?.detail, '可用: value, start, end 等4项')
  assert.equal(attrItems.some((item: any) => item.label === 'start'), true)
  assert.equal(attrItems.some((item: any) => item.label === 'end'), true)
  assert.equal(attrItems.some((item: any) => item.label === 'range-key'), false)
  assert.equal(attrItems.find((item: any) => item.label === 'start')?.detail, 'mode=time')
  assert.equal(
    getMarkdownValue(attrItems.find((item: any) => item.label === 'start')?.documentation).includes('条件：`mode="time"`'),
    true,
  )
})

it('renders native conditional hover details for root and nested attrs', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), '{}'],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        workspaceFolders: [
          {
            name: 'demo',
            uri: {
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(contents: unknown) {
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
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
  )
  const startDocument = createTextDocument(
    'wxml',
    '<picker mode="time" start="09:00"></picker>',
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
  )
  const modeText = modeDocument.getText()
  const startText = startDocument.getText()
  const modePosition = modeDocument.positionAt(modeText.indexOf('mode') + 2)
  const startPosition = startDocument.positionAt(startText.indexOf('start') + 2)

  const modeHover = await hoverProvider.provideHover(modeDocument as any, modePosition as any)
  const startHover = await hoverProvider.provideHover(startDocument as any, startPosition as any)

  assert.equal(getMarkdownValue(modeHover?.contents).includes('### 条件分支'), true)
  assert.equal(getMarkdownValue(modeHover?.contents).includes('`time`'), true)
  assert.equal(getMarkdownValue(startHover?.contents).includes('条件：`mode="time"`'), true)
})

it('highlights matching tags inside wxml documents', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), '{}'],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        workspaceFolders: [
          {
            name: 'demo',
            uri: {
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(start: MockPosition, end: MockPosition) {
          this.start = start
          this.end = end
        }
      },
      DocumentHighlight: class {
        range

        constructor(range: MockRange) {
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
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
  )
  const documentText = document.getText()
  const tagPosition = document.positionAt(documentText.indexOf('card-user') + 2)
  const provider = new WeappTemplateDocumentHighlightProvider()
  const highlights = await provider.provideDocumentHighlights(document as any, tagPosition as any) as _MockDocumentHighlight[]

  assert.equal(highlights.length, 2)
  assert.deepEqual(getHighlightStartCharacters(highlights), [7, 27])
})

it('highlights matching tags inside recognized vue templates', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), JSON.stringify({
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
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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

        constructor(start: MockPosition, end: MockPosition) {
          this.start = start
          this.end = end
        }
      },
      DocumentHighlight: class {
        range

        constructor(range: MockRange) {
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
    mockWorkspacePath('/workspace/src/pages/home/index.vue'),
  )
  const documentText = document.getText()
  const tagPosition = document.positionAt(documentText.indexOf('card-user') + 2)
  const provider = new WeappTemplateDocumentHighlightProvider()
  const highlights = await provider.provideDocumentHighlights(document as any, tagPosition as any) as _MockDocumentHighlight[]

  assert.equal(highlights.length, 2)
  assert.deepEqual(getHighlightStartLines(highlights), [1, 1])
})

it('can disable vue template enhancements while keeping standalone wxml enhancements', async () => {
  const files = new Map<string, string>([
    [mockWorkspacePath('/workspace/package.json'), JSON.stringify({
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
    })],
    [mockWorkspacePath('/workspace/src/app.json'), JSON.stringify({
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
              fsPath: mockWorkspacePath('/workspace'),
              path: toUriPath(mockWorkspacePath('/workspace')),
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
            fsPath: mockWorkspacePath('/workspace'),
            path: toUriPath(mockWorkspacePath('/workspace')),
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
    mockWorkspacePath('/workspace/src/pages/home/index.vue'),
  )
  const wxmlDocument = createTextDocument(
    'wxml',
    '<view />',
    mockWorkspacePath('/workspace/src/pages/home/index.wxml'),
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
