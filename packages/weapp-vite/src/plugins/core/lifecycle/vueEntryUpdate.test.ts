import type { CorePluginState } from '../helpers'
import { describe, expect, it, vi } from 'vitest'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { createVueEntryUpdateInspector } from './vueEntryUpdate'

function createState(filename: string, source: string) {
  const signatures = resolveVueSfcHmrSignatures(source, filename)

  return {
    ctx: {
      runtimeState: {
        build: {
          hmr: {
            vueEntryHasTemplate: new Map([
              [filename, signatures.hasTemplate],
            ]),
            vueEntrySfcSignatures: new Map([
              [filename, signatures.blockSignatures],
            ]),
            vueEntryTailwindTemplateContentSignatures: new Map([
              [filename, signatures.tailwindTemplateContentSignature],
            ]),
            vueEntryTailwindScriptContentSignatures: new Map([
              [filename, signatures.tailwindScriptContentSignature],
            ]),
          },
        },
      },
    },
  } as unknown as CorePluginState
}

describe('createVueEntryUpdateInspector', () => {
  it('reuses one source read across vue entry update checks', async () => {
    const filename = '/project/src/app.vue'
    const source = `
<template><view /></template>
<script setup lang="ts">
const title = 'same'
</script>
<style>.card { color: red; }</style>
<json>{"pages":["pages/index/index"]}</json>
    `.trim()
    const readFile = vi.fn(async () => source)
    const inspector = createVueEntryUpdateInspector(createState(filename, source), filename, {
      readFile,
    })

    await expect(inspector.getChangedBlocks()).resolves.toEqual([])
    await expect(inspector.isJsonOnlyUpdate()).resolves.toBe(false)
    await expect(inspector.isLocalAssetOnlyUpdate()).resolves.toBe(true)
    await expect(inspector.isStyleOnlyUpdate()).resolves.toBe(false)
    await expect(inspector.isTailwindContentUpdate()).resolves.toBe(false)
    await expect(inspector.isAppShellTopologyUpdate()).resolves.toBe(false)

    expect(readFile).toHaveBeenCalledTimes(1)
    expect(readFile).toHaveBeenCalledWith(filename, 'utf-8')
  })

  it.each([
    ['script', 'const count = 2'],
    ['template', '<view class="next">{{ count }}</view>'],
    ['style', '.card { color: blue; }'],
    ['config', '{"navigationBarTitleText":"新标题"}'],
  ] as const)('reports %s block changes', async (block, replacement) => {
    const filename = '/project/src/pages/index.vue'
    const source = `<script setup lang="ts">const count = 1</script>
<template><view>{{ count }}</view></template>
<style>.card { color: red; }</style>
<json>{"navigationBarTitleText":"首页"}</json>`
    const originalByBlock = {
      script: 'const count = 1',
      template: '<view>{{ count }}</view>',
      style: '.card { color: red; }',
      config: '{"navigationBarTitleText":"首页"}',
    }
    const inspector = createVueEntryUpdateInspector(createState(filename, source), filename, {
      readFile: async () => source.replace(originalByBlock[block], replacement),
    })

    await expect(inspector.getChangedBlocks()).resolves.toEqual([block])
  })
})
