import assert from 'node:assert/strict'
import { it } from 'vitest'

import {
  getScriptIdentifierAtOffset,
  getVueTemplateBlockRange,
  getWxmlSourceText,
  parseWxmlTagContext,
  toDocumentOffsetFromWxmlSource,
  toWxmlSourceOffset,
} from './templateContext'

function createDocument(languageId: string, text: string, fsPath: string) {
  return {
    languageId,
    uri: {
      fsPath,
      path: fsPath,
    },
    getText() {
      return text
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

it('extracts vue template content and offset mapping', () => {
  const source = [
    '<script setup lang="ts">',
    'const title = \'demo\'',
    '</script>',
    '<template>',
    '  <view class="page">demo</view>',
    '</template>',
  ].join('\n')
  const document = createDocument('vue', source, '/workspace/src/pages/home/index.vue')
  const templateRange = getVueTemplateBlockRange(source)

  assert.deepEqual(templateRange, {
    contentStart: source.indexOf('<template>') + '<template>'.length,
    contentEnd: source.indexOf('</template>'),
  })
  assert.equal(getWxmlSourceText(document as any)?.includes('<view class="page">'), true)

  const sourceOffset = toWxmlSourceOffset(document as any, { line: 4, character: 8 })

  assert.equal(typeof sourceOffset, 'number')
  assert.equal(toDocumentOffsetFromWxmlSource(document as any, sourceOffset!), document.offsetAt({ line: 4, character: 8 }))
})

it('parses wxml tag context around tag names and attributes', () => {
  const source = '<view class="page" src="./banner.png">demo</view>'
  const classOffset = source.indexOf('class') + 2
  const srcOffset = source.indexOf('./banner.png') + 4

  const classContext = parseWxmlTagContext(source, classOffset)
  const srcContext = parseWxmlTagContext(source, srcOffset)

  assert.equal(classContext.tagName, 'view')
  assert.equal(classContext.attribute?.name, 'class')
  assert.equal(srcContext.attribute?.name, 'src')
  assert.equal(srcContext.attribute?.value, './banner.png')
})

it('extracts the script identifier under the current cursor offset', () => {
  const interpolation = 'foo.bar + baz'

  assert.equal(getScriptIdentifierAtOffset(interpolation, 100, 101), 'foo')
  assert.equal(getScriptIdentifierAtOffset(interpolation, 100, 105), 'bar')
  assert.equal(getScriptIdentifierAtOffset(interpolation, 100, 111), 'baz')
  assert.equal(getScriptIdentifierAtOffset(interpolation, 100, 108), null)
})
