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

  it('infers native constructor arrays from defineProps generic unions', async () => {
    const source = `
<template>
  <view>{{ mixed }} {{ literalUnion }} {{ multiNative }}</view>
</template>

<script setup lang="ts">
const props = defineProps<{
  mixed: number | string
  literalUnion: 'on' | 'off' | number
  multiNative: string | number | boolean | Record<string, any> | unknown[]
}>()
</script>
`
    const result = await compileVueFile(source, 'test.vue')

    expect(result.script).toMatch(/mixed:\s*\{\s*type:\s*\[\s*Number,\s*String\s*\]/)
    expect(result.script).toMatch(/literalUnion:\s*\{\s*type:\s*\[\s*String,\s*Number\s*\]/)
    expect(result.script).toMatch(/multiNative:\s*\{\s*type:\s*\[\s*String,\s*Number,\s*Boolean,\s*Object,\s*Array\s*\]/)
  })

  it('expands optional literal and non-native unions from defineProps generic', async () => {
    const source = `
<template>
  <view>{{ optLiteral }} {{ optDateOrString }} {{ optDateOnly }} {{ optLiteralOrNumber }}</view>
</template>

<script setup lang="ts">
const props = defineProps<{
  optLiteral?: 'a' | 'b'
  optDateOrString?: Date | string
  optDateOnly?: Date
  optLiteralOrNumber?: 'a' | 'b' | number
}>()
</script>
`
    const result = await compileVueFile(source, 'test.vue')

    expect(result.script).toMatch(/optLiteral:\s*\{\s*type:\s*String,\s*required:\s*false\s*\}/)
    expect(result.script).toMatch(/optDateOrString:\s*\{\s*type:\s*\[\s*(?:String,\s*Date|Date,\s*String)\s*\],\s*required:\s*false\s*\}/)
    expect(result.script).toMatch(/optDateOnly:\s*\{\s*type:\s*Date,\s*required:\s*false\s*\}/)
    expect(result.script).toMatch(/optLiteralOrNumber:\s*\{\s*type:\s*\[\s*String,\s*Number\s*\],\s*required:\s*false\s*\}/)
  })
})
