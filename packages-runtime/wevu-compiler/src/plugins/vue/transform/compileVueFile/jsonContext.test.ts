import type { JsonMergeContext } from '../../../../types/json'
import { describe, expect, it } from 'vitest'
import { compileVueFile } from './index'
import { refreshVueFileJsonConfig } from './jsonOnly'

const filename = '/project/src/pages/home/index.vue'
const source = `<script setup lang="ts">
import { definePage as route } from 'wevu/router'
import { definePageMeta as page } from 'wevu'
route({ name: 'home', meta: { access: 'public' } })
page({ layout: false, nested: { values: [1, null, true] } })
definePageJson({ navigationBarTitleText: 'macro' })
</script>
<template><view /></template>
<json>{ "navigationStyle": "custom" }</json>`

describe('page metadata JSON merge context', () => {
  it('shares route and page metadata across compiler merge stages and JSON-only refresh', async () => {
    const contexts: JsonMergeContext[] = []
    const options = { isPage: true, json: {
      defaults: { page: { backgroundColor: '#ffffff' } },
      mergeStrategy(target: Record<string, unknown>, input: Record<string, unknown>, context: JsonMergeContext) {
        contexts.push(context)
        return { ...target, ...input }
      },
    } }
    const compiled = await compileVueFile(source, filename, options)
    expect(contexts.length).toBeGreaterThan(0)
    for (const context of contexts) {
      expect(context).toMatchObject({ routeConfig: { name: 'home', meta: { access: 'public' } }, pageMeta: { layout: false, nested: { values: [1, null, true] } } })
    }
    contexts.length = 0
    await refreshVueFileJsonConfig(source.replace('name: \'home\'', 'name: \'updated\''), filename, compiled, options)
    expect(contexts.length).toBeGreaterThan(0)
    for (const context of contexts) {
      expect(context).toMatchObject({ routeConfig: { name: 'updated' }, pageMeta: { layout: false } })
    }
  })

  it.each([
    '{ layout: false, extra: loadMeta() }',
    '{ layout: false, ...unknown }',
    '{ [key]: false }',
    '{ get layout() { return false } }',
    '{ values: [1, , 3] }',
    'unknown',
  ])('omits the entire dynamic metadata object: %s', async (expression) => {
    const input = source.replace('page({ layout: false, nested: { values: [1, null, true] } })', `page(${expression})`)
    const result = await compileVueFile(input, filename, { isPage: true })
    expect(result.meta?.pageMeta).toBeUndefined()
    expect(result.meta?.routeConfig?.name).toBe('home')
  })

  it('does not extract a locally shadowed macro name', async () => {
    const input = source.replace('import { definePageMeta as page } from \'wevu\'', 'const page = (_value: unknown) => {}')
    const result = await compileVueFile(input, filename, { isPage: true })
    expect(result.meta?.pageMeta).toBeUndefined()
  })

  it('clears cached metadata when JSON-only refresh no longer has a static declaration', async () => {
    const compiled = await compileVueFile(source, filename, { isPage: true })
    const updated = source.replace('route({ name: \'home\', meta: { access: \'public\' } })', '')
      .replace('page({ layout: false, nested: { values: [1, null, true] } })', 'page({ layout: false, extra: unknown })')
    const refreshed = await refreshVueFileJsonConfig(updated, filename, compiled, { isPage: true })
    expect(refreshed?.meta?.pageMeta).toBeUndefined()
    expect(refreshed?.meta?.routeConfig).toBeUndefined()
  })

  it('preserves invalid route declaration diagnostics', async () => {
    await expect(compileVueFile(source.replace('name: \'home\'', 'name: dynamicName'), filename, { isPage: true }))
      .rejects
      .toThrow('name 必须是非空静态字符串')
  })
})
