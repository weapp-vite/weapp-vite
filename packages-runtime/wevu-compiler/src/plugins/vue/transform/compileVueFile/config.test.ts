import { describe, expect, it, vi } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { compileConfigPhase } from './config'

describe('compileConfigPhase', () => {
  it('merges json blocks, auto components, defaults, macro config and component generics', async () => {
    const sfc = parse(`
<template>
  <view><t-card /><TButton /></view>
</template>
<json lang="json">
{
  "usingComponents": {
    "legacy": "./legacy"
  }
}
</json>
    `.trim(), { filename: '/project/src/pages/index/index.vue' })

    const autoImportWarn = vi.fn()
    const autoUsingWarn = vi.fn()
    const mergeStages: string[] = []
    const result: any = {
      componentGenerics: {
        genericA: true,
      },
    }

    await compileConfigPhase({
      descriptor: {
        template: sfc.descriptor.template,
        customBlocks: sfc.descriptor.customBlocks,
      } as any,
      filename: '/project/src/pages/index/index.vue',
      autoUsingComponentsMap: {
        TButton: 'tdesign/button/button',
      },
      autoUsingComponents: {
        warn: autoUsingWarn,
      },
      autoImportTags: {
        warn: autoImportWarn,
        resolveUsingComponent: async (tag) => {
          if (tag === 't-card') {
            return { name: 't-card', from: 'tdesign/card/card' }
          }
          if (tag === 'legacy') {
            return { name: 'legacy', from: 'override/legacy' }
          }
          return undefined
        },
      },
      jsonDefaults: {
        navigationBarTitleText: '首页',
      },
      mergeJson: (target, source, stage) => {
        mergeStages.push(stage)
        return { ...target, ...source }
      },
      scriptSetupMacroConfig: {
        enablePullDownRefresh: true,
      },
      result,
      warn: vi.fn(),
    })

    const parsed = JSON.parse(result.config)
    expect(parsed.usingComponents).toEqual({
      'legacy': './legacy',
      't-card': 'tdesign/card/card',
      'TButton': 'tdesign/button/button',
    })
    expect(parsed.componentGenerics).toEqual({
      genericA: true,
    })
    expect(parsed.navigationBarTitleText).toBe('首页')
    expect(parsed.enablePullDownRefresh).toBe(true)
    expect(mergeStages).toContain('json-block')
    expect(mergeStages).toContain('auto-using-components')
    expect(mergeStages).toContain('component-generics')
    expect(mergeStages).toContain('defaults')
    expect(mergeStages).toContain('macro')
    expect(autoImportWarn).not.toHaveBeenCalled()
    expect(autoUsingWarn).not.toHaveBeenCalled()
  })
})
