import { describe, expect, it, vi } from 'vitest'

import { compileVueFile } from 'wevu/compiler'

vi.mock('wevu/compiler', async () => {
  const actual = await vi.importActual<typeof import('wevu/compiler')>(
    'wevu/compiler',
  )
  return {
    ...actual,
    stripJsonMacroCallsFromCode: vi.fn(() => {
      throw new Error('stripJsonMacroCallsFromCode should not be called')
    }),
  }
})

describe('compileVueFile macro stripping', () => {
  it('skips stripping when no macro is present', async () => {
    const sfc = `
<template><view>ok</view></template>
<script setup lang="ts">
import { ref } from 'wevu'

const count = ref(0)
</script>
    `.trim()

    await expect(compileVueFile(sfc, '/virtual/src/components/foo.vue')).resolves.toBeDefined()
  })
})
