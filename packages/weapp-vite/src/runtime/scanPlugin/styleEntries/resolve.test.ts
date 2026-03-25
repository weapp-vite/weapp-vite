import { describe, expect, it } from 'vitest'
import { resolveStyleEntryAbsolutePath } from './resolve'

function createConfigService(absoluteSrcRoot: string) {
  return {
    absoluteSrcRoot,
  } as any
}

describe('styleEntries resolve', () => {
  it('成功示例：支持通过 ../../ 从分包根目录回退到 src/shared', () => {
    const resolved = resolveStyleEntryAbsolutePath(
      '../../shared/styles/components.scss',
      'packages/order',
      createConfigService('/project/src'),
    )

    expect(resolved).toBe('/project/src/shared/styles/components.scss')
  })

  it('失败示例：../ 只会回退到上一级分包目录而不是 src 根目录', () => {
    const resolved = resolveStyleEntryAbsolutePath(
      '../shared/styles/components.scss',
      'packages/order',
      createConfigService('/project/src'),
    )

    expect(resolved).toBe('/project/src/packages/shared/styles/components.scss')
  })
})
