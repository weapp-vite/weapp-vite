/// <reference types="node" />

import assert from 'node:assert/strict'
import { it } from 'vitest'

import {
  getEventHandlerReferenceAtOffset,
  getScriptIdentifierAtOffset,
  getVueTemplateBlockRange,
  getWxmlScopedIdentifierMatch,
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

  const sourceOffset = toWxmlSourceOffset(document as any, { line: 4, character: 8 } as any)

  assert.equal(typeof sourceOffset, 'number')
  assert.equal(toDocumentOffsetFromWxmlSource(document as any, sourceOffset!), document.offsetAt({ line: 4, character: 8 } as any))
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

it('resolves event handler token roles by cursor position', () => {
  const expression = 'handlers.onTap(product, idx)'

  assert.deepEqual(getEventHandlerReferenceAtOffset(expression, 50, 52), {
    definitionType: 'prop',
    identifier: 'handlers',
  })
  assert.deepEqual(getEventHandlerReferenceAtOffset(expression, 50, 61), {
    definitionType: 'method',
    identifier: 'onTap',
  })
  assert.deepEqual(getEventHandlerReferenceAtOffset(expression, 50, 68), {
    definitionType: 'prop',
    identifier: 'product',
  })
  assert.deepEqual(getEventHandlerReferenceAtOffset(expression, 50, 77), {
    definitionType: 'prop',
    identifier: 'idx',
  })
})

it('detects wx:for scoped identifiers from the nearest active loop', () => {
  const source = [
    '<view wx:for="{{ list }}" wx:for-item="product" wx:for-index="idx">',
    '  <text>{{ product.name }} {{ idx }}</text>',
    '</view>',
  ].join('\n')

  const productMatch = getWxmlScopedIdentifierMatch(source, source.indexOf('product.name') + 2, 'product')
  const idxMatch = getWxmlScopedIdentifierMatch(source, source.indexOf('{{ idx }}') + 3, 'idx')

  assert.deepEqual(productMatch, {
    definitionStart: source.indexOf('"product"') + 1,
    definitionEnd: source.indexOf('"product"') + 8,
    identifier: 'product',
  })
  assert.deepEqual(idxMatch, {
    definitionStart: source.indexOf('"idx"') + 1,
    definitionEnd: source.indexOf('"idx"') + 4,
    identifier: 'idx',
  })
})
