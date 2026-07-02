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
    expect(bundleRequireMock).toHaveBeenCalledTimes(1)
  })
})
