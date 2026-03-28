import type { AutoRoutesSubPackage } from '../../../types/routes'
import { describe, expect, it } from 'vitest'
import {
  shouldIncludeScanCandidate,
  sortAutoRoutesEntries,
  sortAutoRoutesSubPackages,
} from './scan'

describe('auto routes scan helpers', () => {
  it('sorts entries with pages/index/index first', () => {
    const values = [
      'pages/z/index',
      'packageA/pages/foo',
      'pages/index/index',
      'pages/a/index',
    ]

    sortAutoRoutesEntries(values)

    expect(values).toEqual([
      'pages/index/index',
      'packageA/pages/foo',
      'pages/a/index',
      'pages/z/index',
    ])
  })

  it('sorts subpackages by root', () => {
    const subPackages: AutoRoutesSubPackage[] = [
      { root: 'pkgB', pages: ['pages/b'] },
      { root: 'pkgA', pages: ['pages/a'] },
    ]

    sortAutoRoutesSubPackages(subPackages)

    expect(subPackages).toEqual([
      { root: 'pkgA', pages: ['pages/a'] },
      { root: 'pkgB', pages: ['pages/b'] },
    ])
  })

  it('decides whether scan candidates should be included', () => {
    expect(shouldIncludeScanCandidate({
      hasScript: false,
      hasTemplate: false,
      jsonPath: '/project/src/pages/home/index.json',
    }, undefined)).toBe(false)

    expect(shouldIncludeScanCandidate({
      hasScript: true,
      hasTemplate: false,
      jsonPath: '/project/src/pages/home/index.json',
    }, { component: true })).toBe(false)

    expect(shouldIncludeScanCandidate({
      hasScript: true,
      hasTemplate: false,
      jsonPath: '/project/src/pages/home/index.json',
    }, {})).toBe(true)

    expect(shouldIncludeScanCandidate({
      hasScript: false,
      hasTemplate: false,
      jsonPath: undefined,
    }, undefined)).toBe(false)
  })
})
