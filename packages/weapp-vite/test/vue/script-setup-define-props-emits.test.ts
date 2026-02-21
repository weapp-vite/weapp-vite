import { describe, expect, it } from 'vitest'
import { compileVueFile } from '../../src/plugins/vue/transform'

describe('<script setup> defineProps/defineEmits', () => {
  it('supports runtime array declarations', async () => {
    const source = `
<template>
  <view>{{ foo }}</view>
</template>

<script setup lang="ts">
const props = defineProps(['foo', 'bar'])
const emit = defineEmits(['change', 'update'])
emit('change')
</script>
`
    const result = await compileVueFile(source, 'test.vue')
    expect(result.script).toContain('createWevuComponent')
    expect(result.script).toContain('props:')
    expect(result.script).toContain('emits:')
  })

  it('supports runtime object declarations', async () => {
    const source = `
<template>
  <view>{{ count }}</view>
</template>

<script setup lang="ts">
const props = defineProps({
  count: {
    type: Number,
    required: true,
  },
})
const emit = defineEmits({
  change: (value: number) => value > 0,
  close: null,
})
emit('change', props.count)
</script>
`
    const result = await compileVueFile(source, 'test.vue')
    expect(result.script).toContain('createWevuComponent')
    expect(result.script).toContain('props:')
    expect(result.script).toContain('emits:')
  })

  it('supports type-only props with withDefaults and callable emits', async () => {
    const source = `
<template>
  <view>{{ title }}</view>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  count: number
}>(), {
  title: 'demo',
})
const emit = defineEmits<{
  (e: 'save'): void
  (e: 'update', value: number): void
}>()
emit('update', props.count)
</script>
`
    const result = await compileVueFile(source, 'test.vue')
    expect(result.script).toContain('createWevuComponent')
    expect(result.script).toContain('props:')
    expect(result.script).toContain('emits:')
  })

  it('supports type-only emits named tuple syntax', async () => {
    const source = `
<template>
  <view>{{ count }}</view>
</template>

<script setup lang="ts">
const props = defineProps<{ count: number }>()
const emit = defineEmits<{
  change: []
  update: [value: number]
  rename: [name: string, force?: boolean]
}>()
emit('update', props.count)
emit('rename', 'next', true)
</script>
`
    const result = await compileVueFile(source, 'test.vue')
    expect(result.script).toContain('createWevuComponent')
    expect(result.script).toContain('props:')
    expect(result.script).toContain('emits:')
  })
})
