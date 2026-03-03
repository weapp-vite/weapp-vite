import { describe, expect, it } from 'vitest'
import {
  compileConfigBlocks,
  evaluateJsLikeConfig,
  isJsonLikeLang,
  normalizeConfigLang,
  resolveJsLikeLang,
} from './config'

describe('json config transform helpers', () => {
  it('normalizes language tags', () => {
    expect(normalizeConfigLang()).toBe('json')
    expect(normalizeConfigLang('TXT')).toBe('json')
    expect(normalizeConfigLang('JSON5')).toBe('json5')
  })

  it('checks json-like language and js-like resolve', () => {
    expect(isJsonLikeLang('json')).toBe(true)
    expect(isJsonLikeLang('jsonc')).toBe(true)
    expect(isJsonLikeLang('json5')).toBe(true)
    expect(isJsonLikeLang('ts')).toBe(false)

    expect(resolveJsLikeLang('ts')).toBe('ts')
    expect(resolveJsLikeLang('tsx')).toBe('ts')
    expect(resolveJsLikeLang('mts')).toBe('ts')
    expect(resolveJsLikeLang('js')).toBe('js')
  })

  it('returns undefined when no json blocks are present', async () => {
    const result = await compileConfigBlocks([], '/project/src/pages/index/index.vue')
    expect(result).toBeUndefined()
  })

  it('merges json blocks and strips $schema key', async () => {
    const blocks = [
      {
        type: 'json',
        lang: 'json',
        content: `{
  "$schema": "https://example.com/schema.json",
  "usingComponents": {
    "x-card": "./card"
  }
}`,
      },
      {
        type: 'json',
        lang: 'jsonc',
        content: `{
  // jsonc comment
  "navigationBarTitleText": "首页"
}`,
      },
    ] as any

    const output = await compileConfigBlocks(blocks, '/project/src/pages/index/index.vue')
    const parsed = JSON.parse(output!)

    expect(parsed).toEqual({
      usingComponents: {
        'x-card': './card',
      },
      navigationBarTitleText: '首页',
    })
  })

  it('supports custom merge strategy callback', async () => {
    const blocks = [
      {
        type: 'json',
        lang: 'json',
        content: `{"a":1}`,
      },
      {
        type: 'json',
        lang: 'txt',
        content: `{"b":2}`,
      },
    ] as any

    const output = await compileConfigBlocks(
      blocks,
      '/project/src/pages/index/index.vue',
      {
        merge: (target, source) => ({
          ...target,
          ...source,
          merged: true,
        }),
      },
    )

    expect(JSON.parse(output!)).toEqual({
      a: 1,
      b: 2,
      merged: true,
    })
  })

  it('wraps json parse error with block location hint', async () => {
    const blocks = [
      {
        type: 'json',
        lang: 'json',
        content: '{ bad json',
      },
    ] as any

    await expect(
      compileConfigBlocks(blocks, '/project/src/pages/index/index.vue'),
    ).rejects.toThrow('解析 <json> 块失败（json）：/project/src/pages/index/index.vue')
  })

  it('evaluates js/ts config block exports', async () => {
    const objectResult = await evaluateJsLikeConfig(
      `export default { navigationBarTitleText: 'JS 对象' }`,
      '/tmp/wevu-config-js.vue',
      'js',
    )
    expect(objectResult).toEqual({
      navigationBarTitleText: 'JS 对象',
    })

    const functionResult = await evaluateJsLikeConfig(
      `export default () => ({ enablePullDownRefresh: true })`,
      '/tmp/wevu-config-fn.vue',
      'ts',
    )
    expect(functionResult).toEqual({
      enablePullDownRefresh: true,
    })

    const asyncResult = await evaluateJsLikeConfig(
      `export default async () => ({ usingComponents: { 'x-card': './card' } })`,
      '/tmp/wevu-config-async.vue',
      'ts',
    )
    expect(asyncResult).toEqual({
      usingComponents: {
        'x-card': './card',
      },
    })
  })

  it('supports js-like blocks in compileConfigBlocks and merge callback returning void', async () => {
    const blocks = [
      {
        type: 'json',
        lang: 'json',
        content: `{"navigationBarTitleText":"json"}`,
      },
      {
        type: 'json',
        lang: 'js',
        content: `export default { usingComponents: { "x-card": "./card" } }`,
      },
    ] as any

    const stages: string[] = []
    const output = await compileConfigBlocks(
      blocks,
      '/tmp/wevu-config-compile.vue',
      {
        merge: (target, source) => {
          stages.push(Object.keys(source).join(','))
          Object.assign(target, source)
        },
      },
    )

    expect(stages.length).toBe(2)
    expect(JSON.parse(output!)).toEqual({
      navigationBarTitleText: 'json',
      usingComponents: {
        'x-card': './card',
      },
    })
  })

  it('wraps js-like config evaluation errors in compileConfigBlocks', async () => {
    const blocks = [
      {
        type: 'json',
        lang: 'js',
        content: `export default 1`,
      },
    ] as any

    await expect(
      compileConfigBlocks(blocks, '/tmp/wevu-config-error.vue'),
    ).rejects.toThrow('解析 <json> 块失败（js）：/tmp/wevu-config-error.vue')
  })
})
