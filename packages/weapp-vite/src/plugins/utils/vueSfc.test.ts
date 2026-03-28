import { describe, expect, it } from 'vitest'
import { createReadAndParseSfcOptions, createSfcResolveSrcOptions, readAndParseSfc } from './vueSfc'

describe('readAndParseSfc', () => {
  it('parses from provided source', async () => {
    const parsed = await readAndParseSfc('/project/src/a.vue', {
      source: `<template><view>ok</view></template>\n<script setup lang="ts">const a = 1</script>`,
      checkMtime: false,
    })
    expect(parsed.errors).toEqual([])
    expect(parsed.descriptor.template?.content).toContain('ok')
    expect(parsed.descriptor.scriptSetup?.content).toContain('const a = 1')
  })

  it('creates shared sfc parse options from plugin resolve context', async () => {
    const resolveSrc = createSfcResolveSrcOptions(
      {
        resolve: async (source, importer) => ({
          id: `${importer}:${source}`,
        }),
      },
      {
        isDev: true,
      } as any,
    )

    expect(resolveSrc.checkMtime).toBe(true)
    expect(await resolveSrc.resolveId?.('./child.vue', '/project/src/a.vue')).toBe('/project/src/a.vue:./child.vue')

    const options = createReadAndParseSfcOptions(
      {
        resolve: async (source, importer) => ({
          id: `${importer}:${source}`,
        }),
      },
      {
        isDev: true,
      } as any,
      {
        source: '<template />',
        checkMtime: false,
      },
    )

    expect(options.source).toBe('<template />')
    expect(options.checkMtime).toBe(false)
    expect(options.resolveSrc?.checkMtime).toBe(true)
    expect(await options.resolveSrc?.resolveId?.('./child.vue', '/project/src/a.vue')).toBe('/project/src/a.vue:./child.vue')
  })
})
