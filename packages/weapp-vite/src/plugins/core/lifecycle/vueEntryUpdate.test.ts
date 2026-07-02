import { describe, expect, it, vi } from 'vitest'
import { resolveVueSfcHasTemplate, resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature, resolveVueSfcStyleIndependentSignature } from '../../../utils/file/vueSfcSignature'
import { createVueEntryUpdateInspector } from './vueEntryUpdate'

function createState(filename: string, source: string) {
  return {
    ctx: {
      runtimeState: {
        build: {
          hmr: {
            vueEntryHasTemplate: new Map([
              [filename, resolveVueSfcHasTemplate(source, filename)],
            ]),
            vueEntryNonJsonSignatures: new Map([
              [filename, resolveVueSfcNonJsonSignature(source, filename)],
            ]),
            vueEntryScriptSignatures: new Map([
              [filename, resolveVueSfcScriptSignature(source, filename)],
            ]),
            vueEntryStyleIndependentSignatures: new Map([
              [filename, resolveVueSfcStyleIndependentSignature(source, filename)],
            ]),
          },
        },
      },
    },
  } as any
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

    await expect(inspector.isJsonOnlyUpdate()).resolves.toBe(true)
    await expect(inspector.isLocalAssetOnlyUpdate()).resolves.toBe(true)
    await expect(inspector.isStyleOnlyUpdate()).resolves.toBe(true)
    await expect(inspector.isAppShellTopologyUpdate()).resolves.toBe(false)
    await expect(inspector.isJsonOnlyUpdate()).resolves.toBe(true)

    expect(readFile).toHaveBeenCalledTimes(1)
    expect(readFile).toHaveBeenCalledWith(filename, 'utf-8')
  })
})
