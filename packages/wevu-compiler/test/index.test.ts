import { compileVueFile, WE_VU_MODULE_ID } from '@/index'

describe('tsdown template', () => {
  it('exports compiler entry', () => {
    expect(typeof compileVueFile).toBe('function')
  })

  it('exports wevu module id', () => {
    expect(WE_VU_MODULE_ID).toBe('wevu')
  })

  it('falls back runtime binding identifiers to __wevuProps for script setup props destructure', async () => {
    const source = `
<script setup lang="ts">
const { str, bool } = defineProps<{ str: string; bool: boolean }>()
</script>
<template>
  <view>{{ str }} {{ String(bool) }}</view>
</template>
    `.trim()

    const result = await compileVueFile(source, '/project/src/pages/index/index.vue')

    expect(result.template).toContain('{{__wv_bind_0}}')
    expect(result.script).toContain('this.__wevuProps != null && (this.__wevuProps.bool !== undefined || Object.prototype.hasOwnProperty.call(this.__wevuProps, "bool")) ? this.__wevuProps.bool : this.bool')
    expect(result.script).toContain('String(__wevuUnref(')
  })
})
