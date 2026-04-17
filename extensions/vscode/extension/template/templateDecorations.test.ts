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

it('can disable vue template decorations while keeping standalone wxml decorations enabled', async () => {
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

  assert.equal(await isDecorationEnabledForDocument(vueDocument as any), false)
  assert.equal(await isDecorationEnabledForDocument(wxmlDocument as any), true)
})
