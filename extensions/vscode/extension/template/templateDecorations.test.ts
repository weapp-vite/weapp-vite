/// <reference types="node" />

import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
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

afterEach(() => {
  vi.clearAllMocks()
  vi.doUnmock('vscode')
  vi.resetModules()
})

it('collects event handler and interpolation ranges while ignoring comments', async () => {
  vi.doMock('vscode', () => {
    return createVscodeModule({
      Range: class {},
    })
  })
  vi.resetModules()

  const {
    collectTemplateDecorationSourceRanges,
  } = await import('./templateDecorations')

  const sourceText = [
    '<view bindtap="handleTap">{{ titleText }}</view>',
    '<!-- <view bindtap="ignoreTap">{{ ignoredText }}</view> -->',
  ].join('\n')

  const ranges = collectTemplateDecorationSourceRanges(sourceText)
    .map(range => sourceText.slice(range.start, range.end))

  assert.deepEqual(ranges, ['handleTap', 'titleText'])
})

it('collects defined static class ranges while ignoring comments and dynamic expressions', async () => {
  vi.doMock('vscode', () => {
    return createVscodeModule({
      Range: class {},
    })
  })
  vi.resetModules()

  const {
    collectTemplateClassSourceRanges,
  } = await import('./templateDecorations')

  const sourceText = [
    '<view class="section-title missing {{ active ? \'dynamic-class\' : itemClass }}" hover-class="route-button"></view>',
    '<!-- <view class="section-title"></view> -->',
  ].join('\n')

  const ranges = collectTemplateClassSourceRanges(sourceText, new Set(['section-title', 'route-button', 'dynamic-class']))
    .map(range => sourceText.slice(range.start, range.end))

  assert.deepEqual(ranges, ['section-title', 'route-button'])
})

it('limits class decorations to standalone template documents', async () => {
  vi.doMock('vscode', () => {
    return createVscodeModule({
      Range: class {},
    })
  })
  vi.resetModules()

  const {
    isTemplateClassDecorationDocument,
  } = await import('./templateDecorations')

  const vueDocument = createTextDocument('vue', '<template><view class="page" /></template>', '/workspace/index.vue')
  const wxmlDocument = createTextDocument('wxml', '<view class="page" />', '/workspace/index.wxml')
  const htmlDocument = createTextDocument('html', '<view class="page" />', '/workspace/index.html')
  const multiPlatformDocument = createTextDocument('miniprogram-template', '<view class="page" />', '/workspace/index.axml')

  assert.equal(isTemplateClassDecorationDocument(vueDocument as any), false)
  assert.equal(isTemplateClassDecorationDocument(wxmlDocument as any), true)
  assert.equal(isTemplateClassDecorationDocument(htmlDocument as any), true)
  assert.equal(isTemplateClassDecorationDocument(multiPlatformDocument as any), true)
})

it('uses a dotted underline for classes that resolve to style definitions', async () => {
  const decorationOptions: Array<Record<string, unknown>> = []
  const disposable = { dispose() {} }
  const subscribe = () => disposable

  vi.doMock('vscode', () => {
    return createVscodeModule({
      ThemeColor: class {
        id: string

        constructor(id: string) {
          this.id = id
        }
      },
      Range: class {},
      window: {
        activeTextEditor: undefined,
        visibleTextEditors: [],
        createTextEditorDecorationType(options: Record<string, unknown>) {
          decorationOptions.push(options)
          return disposable
        },
        onDidChangeActiveTextEditor: subscribe,
        onDidChangeVisibleTextEditors: subscribe,
      },
      workspace: {
        onDidChangeConfiguration: subscribe,
        onDidChangeTextDocument: subscribe,
        onDidCloseTextDocument: subscribe,
      },
    })
  })
  vi.resetModules()

  const {
    TemplateDecorationController,
  } = await import('./templateDecorations')

  const controller = new TemplateDecorationController()
  const classDecoration = decorationOptions[1]

  assert.equal(decorationOptions.length, 2)
  assert.equal((classDecoration.borderColor as { id: string }).id, 'editorLink.activeForeground')
  assert.equal(classDecoration.borderStyle, 'dotted')
  assert.equal(classDecoration.borderWidth, '0 0 1px 0')

  controller.dispose()
})

it('maps template decoration ranges back to vue document positions', async () => {
  vi.doMock('vscode', () => {
    return createVscodeModule({
      Range: class {
        start
        end

        constructor(start: any, end: any) {
          this.start = start
          this.end = end
        }
      },
    })
  })
  vi.resetModules()

  const {
    collectTemplateDecorationRanges,
  } = await import('./templateDecorations')

  const document = createTextDocument(
    'vue',
    [
      '<template>',
      '  <view bindtap="handleTap">{{ titleText }}</view>',
      '</template>',
      '<script setup lang="ts">',
      'const titleText = \'demo\'',
      'function handleTap() {}',
      '</script>',
    ].join('\n'),
    '/workspace/src/pages/home/index.vue',
  )

  const ranges = collectTemplateDecorationRanges(document as any)

  assert.equal(ranges.length, 2)
  assert.deepEqual(ranges.map((range: any) => range.start.line), [1, 1])
  assert.deepEqual(ranges.map((range: any) => range.start.character), [17, 31])
})

it('can disable vue template decorations while keeping standalone template decorations enabled', async () => {
  vi.doMock('vscode', () => {
    return createVscodeModule({
      workspace: {
        workspaceFolders: [
          {
            uri: {
              fsPath: '/workspace',
              path: '/workspace',
            },
          },
        ],
        fs: {
          stat: async () => ({ type: 0 }),
          readFile: async () => Buffer.from(JSON.stringify({
            dependencies: {
              'weapp-vite': '^1.0.0',
            },
          })),
        },
        getWorkspaceFolder: () => ({
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
        findFiles: async () => [],
      },
      Range: class {},
      Uri: {
        file(targetPath: string) {
          return {
            fsPath: targetPath,
            path: targetPath,
          }
        },
      },
    })
  })
  vi.resetModules()

  const {
    isDecorationEnabledForDocument,
  } = await import('./templateDecorations')

  const vueDocument = createTextDocument(
    'vue',
    [
      '<template>',
      '  <view bindtap="handleTap">{{ titleText }}</view>',
      '</template>',
    ].join('\n'),
    '/workspace/src/pages/home/index.vue',
  )
  const wxmlDocument = createTextDocument(
    'wxml',
    '<view bindtap="handleTap">{{ titleText }}</view>',
    '/workspace/src/pages/home/index.wxml',
  )
  const htmlDocument = createTextDocument(
    'html',
    '<view bindtap="handleTap">{{ titleText }}</view>',
    '/workspace/src/pages/home/index.html',
  )
  const multiPlatformDocument = createTextDocument(
    'miniprogram-template',
    '<view bindtap="handleTap">{{ titleText }}</view>',
    '/workspace/src/pages/home/index.axml',
  )

  assert.equal(await isDecorationEnabledForDocument(vueDocument as any), false)
  assert.equal(await isDecorationEnabledForDocument(wxmlDocument as any), true)
  assert.equal(await isDecorationEnabledForDocument(htmlDocument as any), true)
  assert.equal(await isDecorationEnabledForDocument(multiPlatformDocument as any), true)
})
