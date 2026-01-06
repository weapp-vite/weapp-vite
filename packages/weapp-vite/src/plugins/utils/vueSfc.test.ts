import { describe, expect, it } from 'vitest'
import { readAndParseSfc } from './vueSfc'

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
})
