import assert from 'node:assert/strict'
import { it } from 'vitest'

import {
  extractTemplateComponentMeta,
} from './templateComponentMeta'

it('extracts props, emits, and models from script setup generics', () => {
  const meta = extractTemplateComponentMeta([
    '<script setup lang="ts">',
    'interface Props {',
    '  titleText?: string',
    '  count: number',
    '}',
    'defineProps<Props>()',
    'defineEmits<{',
    '  (e: \'confirm\', value: number): void',
    '  cancel: []',
    '}>()',
    'const checked = defineModel<boolean>(\'checked\')',
    '</script>',
  ].join('\n'))

  assert.deepEqual([...meta.props].sort(), ['count', 'titleText'])
  assert.deepEqual([...meta.emits].sort(), ['cancel', 'confirm'])
  assert.deepEqual([...meta.models].sort(), ['checked'])
  assert.equal(meta.propDetails.get('titleText'), 'string')
  assert.equal(meta.propDetails.get('count'), 'number')
  assert.equal(meta.emitDetails.get('confirm'), 'value: number')
  assert.equal(meta.emitDetails.get('cancel'), '[]')
  assert.equal(meta.modelDetails.get('checked'), 'boolean')
  assert.equal(typeof meta.propOffsets.get('titleText'), 'number')
  assert.equal(typeof meta.emitOffsets.get('confirm'), 'number')
  assert.equal(typeof meta.modelOffsets.get('checked'), 'number')
})

it('extracts props and emits from runtime object and array forms', () => {
  const meta = extractTemplateComponentMeta([
    '<script setup lang="ts">',
    'defineProps({',
    '  titleText: String,',
    '  active: { type: Boolean },',
    '})',
    'defineEmits([\'confirm\', \'cancel\'])',
    '</script>',
  ].join('\n'))

  assert.deepEqual([...meta.props].sort(), ['active', 'titleText'])
  assert.deepEqual([...meta.emits].sort(), ['cancel', 'confirm'])
  assert.equal(meta.propDetails.get('titleText'), 'string')
  assert.equal(meta.propDetails.get('active'), 'boolean')
  assert.equal(meta.emitDetails.get('confirm'), null)
})

it('prefers script setup content inside vue sfc source', () => {
  const meta = extractTemplateComponentMeta([
    '<template>',
    '  <view>{{ titleText }}</view>',
    '</template>',
    '<script lang="ts">',
    'export default {',
    '  name: \'DemoCard\'',
    '}',
    '</script>',
    '<script setup lang="ts">',
    'defineProps<{',
    '  titleText: string',
    '}>()',
    '</script>',
    '<style scoped>',
    '.root {}',
    '</style>',
  ].join('\n'))

  assert.deepEqual([...meta.props].sort(), ['titleText'])
})
