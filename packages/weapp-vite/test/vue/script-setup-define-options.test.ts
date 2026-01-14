import { describe, expect, it } from 'vitest'
import { compileVueFile } from '../../src/plugins/vue/transform'

describe('<script setup> defineOptions', () => {
  it('merges defineOptions with other macros', async () => {
    const source = `
<template>
  <view>{{ count }}</view>
</template>

<script setup lang="ts">
defineOptions({
  name: 'Demo',
  inheritAttrs: false,
  options: {
    multipleSlots: true,
  },
})
const props = defineProps<{ count?: number }>()
defineEmits(['change'])
defineExpose({ foo: 1 })
const model = defineModel<number>('count')
const slots = defineSlots<{ default?: (props: { label: string }) => any }>()
</script>
`
    const result = await compileVueFile(source, 'test.vue')

    expect(result.script).toContain('createWevuComponent')
    expect(result.script).toMatch(/\.\.\.\{\s*name:\s*['"]Demo['"]/)
    expect(result.script).toContain('inheritAttrs: false')
    expect(result.script).toContain('multipleSlots')
    expect(result.script).toContain('mergeModels')
    expect(result.script).toContain('useModel')
    expect(result.script).toContain('useSlots')
    expect(result.script).toContain('props:')
    expect(result.script).toContain('emits:')
    expect(result.script).toContain('expose')
  })

  it('supports type assertions in defineOptions', async () => {
    const source = `
<template>
  <view />
</template>

<script setup lang="ts">
defineOptions({ name: 'Typed', inheritAttrs: false } as const)
</script>
`
    const result = await compileVueFile(source, 'test.vue')

    expect(result.script).toMatch(/\.\.\.\{\s*name:\s*['"]Typed['"]/)
    expect(result.script).toContain('inheritAttrs: false')
    expect(result.script).not.toContain('defineOptions(')
  })

  it('tracks defineOptions hash changes', async () => {
    const base = `
<template>
  <view />
</template>

<script setup lang="ts">
defineOptions({ name: 'Alpha' })
</script>
`
    const changed = `
<template>
  <view />
</template>

<script setup lang="ts">
defineOptions({ name: 'Beta' })
</script>
`
    const noMacro = `
<template>
  <view />
</template>

<script setup lang="ts">
const count = 1
</script>
`
    const baseResult = await compileVueFile(base, 'test.vue')
    const changedResult = await compileVueFile(changed, 'test.vue')
    const noMacroResult = await compileVueFile(noMacro, 'test.vue')

    expect(baseResult.meta?.defineOptionsHash).toBeDefined()
    expect(changedResult.meta?.defineOptionsHash).toBeDefined()
    expect(noMacroResult.meta?.defineOptionsHash).toBeUndefined()
    expect(baseResult.meta?.defineOptionsHash).not.toBe(changedResult.meta?.defineOptionsHash)
  })
})
