import { WEVU_CSS_MODULES_KEY, WEVU_CSS_VARS_STYLE_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { compileVueFile } from './index'

describe('compileVueFile SFC styles', () => {
  it('connects scoped styles, modules and CSS variables across all SFC outputs', async () => {
    const result = await compileVueFile(`
<template>
  <view class="root" style="color: black">
    <view :class="$style.card" :style="extra">{{ theme.active }}</view>
    <slot />
  </view>
  <view class="second" />
</template>
<script setup lang="ts">
import { ref } from 'vue'
const color = ref('red')
const extra = { padding: '2px' }
</script>
<style scoped module>
.card { color: v-bind(color); }
:deep(.child) { color: red; }
:global(.global) { color: blue; }
:slotted(.projected) { color: green; }
</style>
<style module="theme">
.active { font-weight: bold; }
</style>
    `.trim(), '/project/src/pages/style/index.vue')

    const style = result.style ?? ''
    expect(style).not.toContain('v-bind(')
    expect(style).toContain('var(--')
    expect(style).toContain('.child')
    expect(style).toContain('.global')
    expect(style).toContain('.projected')

    expect(result.cssModules).toEqual({
      $style: expect.objectContaining({ card: expect.any(String) }),
      theme: expect.objectContaining({ active: expect.any(String) }),
    })
    expect(result.script).toContain(WEVU_CSS_MODULES_KEY)
    expect(result.script).toContain('useCssVars')
    expect(result.script).not.toContain('/project/src/pages/style/index.vue')

    const cssVarName = style.match(/var\(--([^)]+)\)/)?.[1]
    expect(cssVarName).toBeTruthy()
    expect(result.script).toContain(`"${cssVarName}"`)

    const scopeAttributes = result.template?.match(/data-v-[a-z0-9]+=""/g) ?? []
    expect(scopeAttributes.length).toBeGreaterThanOrEqual(3)
    expect(result.script).toContain(WEVU_CSS_VARS_STYLE_KEY)
    expect(result.script).toContain('color: black')
    expect(result.script).toContain('extra')
    expect(result.template?.match(/style="\{\{__wv_style_\d+\}\}"/g)).toHaveLength(3)
    expect(result.template).toMatch(/data-v-[a-z0-9]+-s=""/)
  })
})
