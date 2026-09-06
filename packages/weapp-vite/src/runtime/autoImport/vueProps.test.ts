import { describe, expect, it } from 'vitest'
import { extractVueComponentProps } from './vueProps'

describe('extractVueComponentProps', () => {
  it('returns empty props for template-only components with sibling SFC blocks', () => {
    expect(extractVueComponentProps(`
<template>
  <view><slot /></view>
</template>
<style scoped>
view { display: block; }
</style>
    `.trim(), '/project/src/components/card/index.vue')).toEqual(new Map())
  })

  it('returns empty props for template-only components with Vue bindings', () => {
    expect(extractVueComponentProps(`
<template>
  <slot :value="1" />
</template>
    `.trim(), '/project/src/components/cell/index.vue')).toEqual(new Map())
  })

  it('extracts inline defineProps type members without full SFC compilation', () => {
    const props = extractVueComponentProps(`
<template><view /></template>
<script setup lang="ts">
defineProps<{
  title: string
  visible?: boolean
}>()
</script>
    `.trim(), '/project/src/components/card/index.vue')

    expect([...props.entries()]).toEqual([
      ['title', 'string'],
      ['visible', 'boolean'],
    ])
  })

  it('inlines local interface props from Vue script setup', () => {
    const props = extractVueComponentProps(`
<template><view /></template>
<script setup lang="ts">
defineProps<{
  filters?: FilterItem[]
}>()

interface FilterItem {
  value: string
  label: string
  count?: number
}
</script>
    `.trim(), '/project/src/components/filter-bar/index.vue')

    expect(props.get('filters')).not.toContain('FilterItem')
    expect(props.get('filters')).toContain('value: string')
    expect(props.get('filters')).toContain('label: string')
  })

  it('falls back to compiled script props metadata for runtime props', () => {
    const props = extractVueComponentProps(`
<template><view /></template>
<script setup lang="ts">
defineProps({
  title: String,
  count: Number,
})
</script>
    `.trim(), '/project/src/components/card/index.vue')

    expect([...props.entries()]).toEqual([
      ['title', 'string'],
      ['count', 'number'],
    ])
  })
})
