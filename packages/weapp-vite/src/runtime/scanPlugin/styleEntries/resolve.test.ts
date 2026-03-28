import { describe, expect, it } from 'vitest'
import {
  getRelativePathWithinSubPackage,
  inferScopeFromRelativePath,
  isSubPackageRelativeStyleEntry,
  resolveStyleEntryAbsolutePath,
  resolveStyleEntryCandidates,
} from './resolve'

function createConfigService(absoluteSrcRoot: string) {
  return {
    absoluteSrcRoot,
  } as any
}

describe('styleEntries resolve', () => {
  it('detects subpackage-relative style entry paths', () => {
    expect(isSubPackageRelativeStyleEntry('packages/order/pages.scss', 'packages/order')).toBe(true)
    expect(isSubPackageRelativeStyleEntry('packages/order', 'packages/order')).toBe(true)
    expect(isSubPackageRelativeStyleEntry('shared/styles.scss', 'packages/order')).toBe(false)
  })

  it('resolves candidate absolute paths for absolute, subpackage and fallback inputs', () => {
    expect(resolveStyleEntryCandidates('/project/src/shared/index.scss', 'packages/order', '/project/src')).toEqual([
      '/project/src/shared/index.scss',
    ])

    expect(resolveStyleEntryCandidates('packages/order/pages.scss', 'packages/order', '/project/src')).toEqual([
      '/project/src/packages/order/pages.scss',
    ])

    expect(resolveStyleEntryCandidates('../shared/index.scss', 'packages/order', '/project/src')).toEqual([
      '/project/src/packages/shared/index.scss',
      '/project/shared/index.scss',
    ])
  })

  it('resolves relative paths within a subpackage root', () => {
    expect(getRelativePathWithinSubPackage('packages/order/pages.wxss', 'packages/order')).toBe('pages.wxss')
    expect(getRelativePathWithinSubPackage('packages/order', 'packages/order')).toBe('')
    expect(getRelativePathWithinSubPackage('shared/styles.wxss', '')).toBe('shared/styles.wxss')
    expect(getRelativePathWithinSubPackage('shared/styles.wxss', 'packages/order')).toBe('shared/styles.wxss')
  })

  it('infers style scopes from normalized relative paths', () => {
    expect(inferScopeFromRelativePath('./pages.wxss')).toBe('pages')
    expect(inferScopeFromRelativePath('components.scss')).toBe('components')
    expect(inferScopeFromRelativePath('index.less')).toBe('all')
    expect(inferScopeFromRelativePath('nested/pages.scss')).toBeUndefined()
    expect(inferScopeFromRelativePath(undefined)).toBeUndefined()
  })

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
