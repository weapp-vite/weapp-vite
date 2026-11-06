import { beforeEach, describe, expect, it, vi } from 'vitest'
import { extractJsonMacroFromScriptSetup } from './index'

const bundleRequireMock = vi.hoisted(() => vi.fn())

vi.mock('rolldown-require', () => ({
  bundleRequire: bundleRequireMock,
}))

describe('jsonMacros extraction', () => {
  beforeEach(() => {
    bundleRequireMock.mockReset()
  })

  it('extracts static object macro config without bundle evaluation', async () => {
    const result = await extractJsonMacroFromScriptSetup(
      `
definePageJson({
  navigationBarTitleText: '首页',
  enablePullDownRefresh: true,
  window: {
    level: 1,
  },
  list: ['a', -1, null],
  $schema: 'ignored',
})
      `.trim(),
      '/project/src/pages/static.vue',
    )

    expect(result.config).toEqual({
      navigationBarTitleText: '首页',
      enablePullDownRefresh: true,
      window: {
        level: 1,
      },
      list: ['a', -1, null],
    })
    expect(result.stripped).not.toContain('definePageJson')
    expect(result.macroHash).toBeTruthy()
    expect(result.dependencies).toEqual([])
    expect(result.isStatic).toBe(true)
    expect(bundleRequireMock).not.toHaveBeenCalled()
  })

  it('falls back to bundle evaluation for non-static macro config', async () => {
    bundleRequireMock.mockResolvedValue({
      mod: {
        default: [{ navigationBarTitleText: '变量标题' }],
      },
      dependencies: ['/project/src/pages/title.ts'],
    })

    const result = await extractJsonMacroFromScriptSetup(
      `
const title = '变量标题'
definePageJson({
  navigationBarTitleText: title,
})
      `.trim(),
      '/project/src/pages/dynamic.vue',
    )

    expect(result.config).toEqual({
      navigationBarTitleText: '变量标题',
    })
    expect(result.dependencies).toEqual(['/project/src/pages/title.ts'])
    expect(result.isStatic).toBeUndefined()
    expect(bundleRequireMock).toHaveBeenCalledTimes(1)
  })

  it('does not report dynamic macros as static when they have no file dependencies', async () => {
    const source = 'definePageJson({ navigationBarTitleText: process.env.TITLE })'
    for (const title of ['first', 'changed']) {
      bundleRequireMock.mockResolvedValueOnce({ mod: { default: [{ navigationBarTitleText: title }] }, dependencies: [] })
      const result = await extractJsonMacroFromScriptSetup(source, 'src/pages/environment.vue')
      expect(result.config?.navigationBarTitleText).toBe(title)
      expect(result.dependencies).toEqual([])
      expect(result.isStatic).toBeUndefined()
    }
    expect(bundleRequireMock).toHaveBeenCalledTimes(2)
  })

  it('does not report literal arguments as pure when a custom merge function executes', async () => {
    const merge = vi.fn(() => ({ navigationBarTitleText: 'derived' }))
    const result = await extractJsonMacroFromScriptSetup(
      'definePageJson({ navigationBarTitleText: "literal" })',
      'src/pages/custom-merge.vue',
      undefined,
      { merge },
    )
    expect(result.config).toEqual({ navigationBarTitleText: 'derived' })
    expect(result.isStatic).toBeUndefined()
    expect(merge).toHaveBeenCalledTimes(1)
    expect(bundleRequireMock).not.toHaveBeenCalled()
  })

  it('retains static proof for TypeScript literal assertions and unrelated imports', async () => {
    const result = await extractJsonMacroFromScriptSetup(
      'import Card from "./Card.vue"; definePageJson({ navigationBarTitleText: "literal" } as const)',
      'src/pages/literal.vue',
      'ts',
    )
    expect(result.config).toEqual({ navigationBarTitleText: 'literal' })
    expect(result.isStatic).toBe(true)
    expect(bundleRequireMock).not.toHaveBeenCalled()
  })

  it('rejects invalid macro source before producing static proof', async () => {
    await expect(extractJsonMacroFromScriptSetup('definePageJson({ title: })', 'src/pages/invalid.vue')).rejects.toThrow('解析')
    expect(bundleRequireMock).not.toHaveBeenCalled()
  })

  it('proves empty literal macros without changing the absent-config contract', async () => {
    const result = await extractJsonMacroFromScriptSetup('definePageJson({})', 'src/pages/empty.vue')
    expect(result.config).toBeUndefined()
    expect(result.isStatic).toBe(true)
    expect(result.dependencies).toEqual([])
    expect(result.stripped).not.toContain('definePageJson')
    expect(bundleRequireMock).not.toHaveBeenCalled()
  })
})
