import { describe, expect, it } from 'vitest'
import { compileVueFile } from '../../src/plugins/vue/transform'

describe('<script setup> defineModel', () => {
  it('supports tuple destructuring with modifiers generics', async () => {
    const source = `
<template>
  <view>{{ modelValue }}</view>
</template>

<script setup lang="ts">
const [modelValue, modelModifiers] = defineModel<string, 'trim' | 'uppercase'>()
const current = modelModifiers.trim ? 'trim' : 'plain'
</script>
`
    const result = await compileVueFile(source, 'test.vue')

    expect(result.script).toContain('createWevuComponent')
    expect(result.script).toContain('modelModifiers')
    expect(result.script).toContain('update:modelValue')
    expect(result.script).toContain('useModel')
  })

  it('supports named model while generating modifiers prop and update event', async () => {
    const source = `
<template>
  <view>{{ title }}</view>
</template>

<script setup lang="ts">
const [title, titleModifiers] = defineModel<string, 'trim'>('title')
const count = defineModel<number>('count', { default: 0 })
const mode = titleModifiers.trim ? 'trim' : 'raw'
</script>
`
    const result = await compileVueFile(source, 'test.vue')

    expect(result.script).toContain('createWevuComponent')
    expect(result.script).toContain('titleModifiers')
    expect(result.script).toContain('update:title')
    expect(result.script).toContain('update:count')
    expect(result.script).toContain('useModel')
  })
})
