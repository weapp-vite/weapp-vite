import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
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

  it('supports defineOptions referencing local and imported variables', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-define-options-'))
    try {
      const constantsPath = path.join(tempDir, 'constants.ts')
      const vuePath = path.join(tempDir, 'app.vue')
      await fs.writeFile(constantsPath, `export const pages = ['pages/home/index', 'pages/logs/index'] as const\n`, 'utf8')

      const source = `
<script setup lang="ts">
import { pages } from './constants'

const title = pages[0]

defineOptions({
  globalData: {
    title,
    pages,
  },
})
</script>
`
      const result = await compileVueFile(source, vuePath, {
        isApp: true,
      })

      expect(result.script).toContain('globalData')
      expect(result.script).toContain('pages/home/index')
      expect(result.script).toContain('pages/logs/index')
      expect(result.script).not.toContain('defineOptions(')
      expect(result.script).toContain('globalData: { title: "pages/home/index"')
    }
    finally {
      await fs.remove(tempDir)
    }
  })
})
