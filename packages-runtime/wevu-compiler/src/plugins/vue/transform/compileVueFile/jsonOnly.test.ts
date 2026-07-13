import { describe, expect, it, vi } from 'vitest'
import { compileVueFile } from './index'
import { refreshVueFileJsonConfig } from './jsonOnly'

const filename = '/project/src/pages/home/index.vue'

function cachedResult(overrides: Record<string, any> = {}) {
  return {
    script: 'Component({ cached: true })',
    template: '<view />',
    style: '.page{}',
    meta: {
      jsonConfigCache: {
        autoImportTagsMap: {
          't-button': 'tdesign/button/button',
        },
        autoUsingComponentsMap: {
          AutoCard: '/components/auto-card/index',
        },
      },
      jsonMacroHash: 'old-hash',
      styleBlocks: [],
    },
    componentGenerics: {
      selectable: true,
    },
    ...overrides,
  }
}

describe('refreshVueFileJsonConfig', () => {
  it('returns undefined when the cached compilation predates json config caching', async () => {
    await expect(refreshVueFileJsonConfig(
      '<template><view /></template>',
      filename,
      { script: 'Component({})', template: '<view />' },
      { isPage: true },
    )).resolves.toBeUndefined()
  })

  it('rebuilds json blocks and macros while preserving generated config inputs', async () => {
    const source = `<script setup lang="ts">
definePageJson({
  navigationBarTitleText: '新标题',
  usingComponents: { macroCard: '/components/macro-card/index' },
})
</script>
<template><view /></template>
<json>
{
  "navigationStyle": "custom",
  "usingComponents": {
    "legacy-card": "/components/legacy-card/index"
  }
}
</json>`
    const result = await refreshVueFileJsonConfig(
      source,
      filename,
      cachedResult(),
      {
        isPage: true,
        json: {
          defaults: {
            page: {
              enablePullDownRefresh: true,
            },
          },
        },
      },
    )

    expect(result?.script).toBe('Component({ cached: true })')
    expect(result?.template).toBe('<view />')
    expect(result?.style).toBe('.page{}')
    expect(JSON.parse(result!.config!)).toEqual({
      navigationStyle: 'custom',
      usingComponents: {
        'legacy-card': '/components/legacy-card/index',
        't-button': 'tdesign/button/button',
        'AutoCard': '/components/auto-card/index',
        'macroCard': '/components/macro-card/index',
      },
      componentGenerics: {
        selectable: true,
      },
      enablePullDownRefresh: true,
      navigationBarTitleText: '新标题',
    })
    expect(result?.meta?.jsonMacroHash).not.toBe('old-hash')
  })

  it('removes stale config and macro hash when json sources are deleted', async () => {
    const result = await refreshVueFileJsonConfig(
      '<template><view /></template>',
      filename,
      cachedResult({
        componentGenerics: undefined,
        config: '{"navigationBarTitleText":"旧标题"}',
        meta: {
          jsonConfigCache: {
            autoUsingComponentsMap: {},
          },
          jsonMacroHash: 'old-hash',
          styleBlocks: [],
        },
      }),
      { isPage: true },
    )

    expect(result?.config).toBeUndefined()
    expect(result?.meta?.jsonMacroHash).toBeUndefined()
    expect(result?.script).toBe('Component({ cached: true })')
  })

  it('uses the configured merge strategy for every json stage', async () => {
    const stages: string[] = []
    const mergeStrategy = vi.fn((target, source, context) => {
      stages.push(context.stage)
      return { ...target, ...source, lastStage: context.stage }
    })
    const source = `<script setup>
definePageJson({ navigationBarTitleText: '宏标题' })
</script>
<template><view /></template>
<json>{ "navigationStyle": "custom" }</json>`

    const result = await refreshVueFileJsonConfig(
      source,
      filename,
      cachedResult(),
      {
        isPage: true,
        json: {
          defaults: {
            page: { enablePullDownRefresh: true },
          },
          mergeStrategy,
        },
      },
    )

    expect(stages).toEqual([
      'macro',
      'json-block',
      'auto-using-components',
      'component-generics',
      'defaults',
      'macro',
    ])
    expect(JSON.parse(result!.config!)).toMatchObject({
      lastStage: 'macro',
      navigationBarTitleText: '宏标题',
    })
  })

  it('records reusable json config inputs during a full compilation', async () => {
    const result = await compileVueFile(
      `<script setup>definePageJson({ navigationBarTitleText: '首页' })</script>
<template><view /></template>`,
      filename,
      { isPage: true, sourceMap: false },
    )

    expect(result.meta?.jsonConfigCache).toEqual({
      autoImportTagsMap: {},
      autoUsingComponentsMap: {},
    })
    expect(JSON.parse(result.config!)).toEqual({
      navigationBarTitleText: '首页',
    })
  })

  it('reapplies defaults for the resolved json kind', async () => {
    const result = await refreshVueFileJsonConfig(
      '<template><view /></template>',
      '/project/src/components/card/index.vue',
      cachedResult({
        componentGenerics: undefined,
        meta: {
          jsonConfigCache: {
            autoUsingComponentsMap: {},
          },
          styleBlocks: [],
        },
      }),
      {
        json: {
          defaults: {
            component: {
              component: true,
              styleIsolation: 'apply-shared',
            },
          },
        },
      },
    )

    expect(JSON.parse(result!.config!)).toEqual({
      component: true,
      styleIsolation: 'apply-shared',
    })
  })
})
