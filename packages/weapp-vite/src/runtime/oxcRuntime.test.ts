import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createOxcRuntimeSupport } from './oxcRuntime'

const getPackageInfoSyncMock = vi.hoisted(() => vi.fn())
const pathExistsMock = vi.hoisted(() => vi.fn())
const readFileMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())

vi.mock('local-pkg', () => ({
  getPackageInfoSync: getPackageInfoSyncMock,
}))

vi.mock('@weapp-core/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-core/shared')>()
  return {
    ...actual,
    fs: {
      ...actual.fs,
      pathExists: pathExistsMock,
      readFile: readFileMock,
    },
  }
})

vi.mock('../logger', () => ({
  default: {
    warn: loggerWarnMock,
  },
}))

describe('runtime oxc helper support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns alias-only support when @oxc-project/runtime is unavailable', () => {
    getPackageInfoSyncMock.mockReturnValue(undefined)

    const support = createOxcRuntimeSupport()
    expect(support.alias.replacement).toBe('@oxc-project/runtime/src/helpers/esm/$1.js')
    expect(support.alias.find.test('@oxc-project/runtime/helpers/objectSpread2.js')).toBe(true)
    expect(support.rolldownPlugin).toBeUndefined()
    expect(support.vitePlugin).toBeUndefined()
  })

  it('resolves and loads helpers via rolldown plugin with fs and fallback paths', async () => {
    getPackageInfoSyncMock.mockReturnValue({
      rootPath: '/runtime/pkg',
    })
    pathExistsMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    readFileMock.mockResolvedValue('export default 1')
    const support = createOxcRuntimeSupport()
    const plugin = support.rolldownPlugin

    expect(plugin).toBeDefined()
    expect(plugin?.resolveId?.('\0@oxc-project/runtime/helpers/objectSpread2.js')).toBeNull()
    expect(plugin?.resolveId?.('@oxc-project/runtime/helpers/objectSpread2.js')).toBe('/runtime/pkg/src/helpers/esm/objectSpread2.js')
    expect(plugin?.resolveId?.('virtual:noop')).toBeNull()

    const fromFallbackPrefix = await plugin?.load?.('\0weapp-vite:oxc-helper:objectWithoutProperties')
    expect(fromFallbackPrefix).toContain('_objectWithoutProperties')
    expect(await plugin?.load?.('\0weapp-vite:oxc-helper:unknown')).toBeNull()

    const fromFs = await plugin?.load?.('\0@oxc-project/runtime/helpers/objectSpread2.js')
    expect(fromFs).toBe('export default 1')
    expect(loggerWarnMock).toHaveBeenCalledWith('[weapp-vite] 通过 Rolldown 插件解析 oxc helper：objectSpread2')

    const fromFallback = await plugin?.load?.('\0@oxc-project/runtime/helpers/objectWithoutProperties.js')
    expect(fromFallback).toContain('_objectWithoutProperties')
    expect(await plugin?.load?.('\0@oxc-project/runtime/helpers/unknown.js')).toBeNull()
  })

  it('resolves and loads helpers via vite plugin', async () => {
    getPackageInfoSyncMock.mockReturnValue({
      rootPath: '/runtime/pkg',
    })
    readFileMock.mockResolvedValue('export default helper')
    const support = createOxcRuntimeSupport()
    const plugin = support.vitePlugin

    expect(plugin).toBeDefined()
    expect(plugin?.resolveId?.('\0@oxc-project/runtime/helpers/objectSpread2.js')).toBeNull()
    expect(plugin?.resolveId?.('@oxc-project/runtime/helpers/objectSpread2.js')).toBe('/runtime/pkg/src/helpers/esm/objectSpread2.js')
    expect(plugin?.resolveId?.('plain-id')).toBeNull()
    expect(loggerWarnMock).toHaveBeenCalledWith('[weapp-vite] resolveId 已拦截：@oxc-project/runtime/helpers/objectSpread2.js')

    expect(await plugin?.load?.('/runtime/pkg/src/helpers/esm/objectSpread2.js')).toBeNull()
    expect(await plugin?.load?.('\0not-helper.js')).toBeNull()
    expect(await plugin?.load?.('\0@oxc-project/runtime/helpers/objectSpread2.js')).toBe('export default helper')
    expect(loggerWarnMock).toHaveBeenCalledWith('[weapp-vite] 通过 Vite 插件解析 oxc helper：objectSpread2')
  })
})
