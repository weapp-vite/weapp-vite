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
    '  (e: \'confirm\'): void',
    '  cancel: []',
    '}>()',
    'const checked = defineModel<boolean>(\'checked\')',
    '</script>',
  ].join('\n'))

  assert.deepEqual([...meta.props].sort(), ['count', 'titleText'])
  assert.deepEqual([...meta.emits].sort(), ['cancel', 'confirm'])
  assert.deepEqual([...meta.models].sort(), ['checked'])
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
