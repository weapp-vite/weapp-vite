import type { CorePluginState } from '../helpers'
import { describe, expect, it, vi } from 'vitest'
import { compileVueFile, resolveVueSfcHmrSignatures } from 'wevu/compiler'
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

function createProviderNeutralState(filename: string, source: string) {
  const signatures = resolveVueSfcHmrSignatures(source, filename)

  return {
    ctx: {
      runtimeState: {
        build: {
          hmr: {
            vueEntryHasTemplate: new Map([[filename, signatures.hasTemplate]]),
            vueEntrySfcSignatures: new Map([[filename, signatures.blockSignatures]]),
            vueEntryTemplateContentSignatures: new Map([[filename, signatures.templateContentSignatures]]),
            vueEntryScriptContentSignatures: new Map([[filename, signatures.scriptContentSignatures]]),
          },
        },
      },
    },
  } as unknown as CorePluginState
}

describe('createVueEntryUpdateInspector', () => {
  it.each([
    ['static node with stable CSS runtime', '<view class="new-node">new</view>', true],
    ['computed template expression', '<view>{{ count + 1 }}</view>', false],
    ['inline event', '<button @tap="count++">increment</button>', false],
  ] as const)('keeps generated JavaScript in the update path for %s', async (_name, inserted, stabilizeCssVarsRuntime) => {
    const filename = 'src/pages/index.vue'
    const source = '<script setup>let count = 1</script><template><view>{{ count }}</view></template>'
    const next = source.replace('</template>', `${inserted}</template>`)
    const options = { stabilizeCssVarsRuntime }
    const before = await compileVueFile(source, filename, options)
    const after = await compileVueFile(next, filename, options)
    expect(after.script).not.toBe(before.script)
    const inspector = createVueEntryUpdateInspector(createState(filename, source), filename, {
      readFile: async () => next,
    })
    await expect(inspector.getChangedBlocks()).resolves.toEqual(['template'])
    await expect(inspector.isLocalAssetOnlyUpdate()).resolves.toBe(false)
  })

  it('reads provider-neutral content signatures for compiler HMR', async () => {
    const filename = '/project/src/app.vue'
    const source = '<template><view class="page" /></template>'
    const inspector = createVueEntryUpdateInspector(createProviderNeutralState(filename, source), filename, {
      readFile: async () => source,
    })

    await expect(inspector.isCompilerContentUpdate()).resolves.toBe(false)
    await expect(inspector.isCompilerContentUpdate('missing-provider')).resolves.toBe(true)
  })

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
