import type { CandidateEntry } from './candidates'
import { describe, expect, it } from 'vitest'
import {
  applyCandidateEntryFile,
  hasNestedPagesRoot,
  resolveCandidateEntryPath,
  resolveCandidateSearchRoots,
  resolveCollectTargetRoot,
} from './candidates'
import { createAutoRoutesMatcher } from './matcher'

describe('auto routes candidates helpers', () => {
  it('detects nested pages roots for subpackages', () => {
    expect(hasNestedPagesRoot('/project/src/pkgA', [
      '/project/src/pages',
      '/project/src/pkgA/pages',
    ])).toBe(true)

    expect(hasNestedPagesRoot('/project/src/pkgB', [
      '/project/src/pages',
      '/project/src/pkgA/pages',
    ])).toBe(false)
  })

  it('resolves candidate search roots from explicit roots and matcher defaults', () => {
    const customMatcher = createAutoRoutesMatcher(['views/**'])

    expect(resolveCandidateSearchRoots('/project/src', customMatcher, [
      '/project/src/views',
      '/project/src/views',
    ])).toEqual(['/project/src/views'])

    expect(resolveCandidateSearchRoots('/project/src', customMatcher)).toEqual(['/project/src/views'])

    expect(resolveCandidateSearchRoots('/project/src', createAutoRoutesMatcher())).toBeUndefined()
  })

  it('accepts only collect roots inside src root', () => {
    expect(resolveCollectTargetRoot('/project/src', 'pages')).toBe('/project/src/pages')
    expect(resolveCollectTargetRoot('/project/src', '/project/src/pkgA')).toBe('/project/src/pkgA')
    expect(resolveCollectTargetRoot('/project/src', '../outside')).toBeUndefined()
  })

  it('resolves relative candidate entry metadata', () => {
    expect(resolveCandidateEntryPath('/project/src', '/project/src/pages/home/index.vue')).toEqual({
      normalizedRelative: 'pages/home/index.vue',
      relativeBase: 'pages/home/index',
      candidateBase: '/project/src/pages/home/index',
    })

    expect(resolveCandidateEntryPath('/project/src', '/project/components/card/index.vue')).toBeUndefined()
  })

  it('applies candidate entry files to script template and json flags', () => {
    const candidate: CandidateEntry = {
      base: '/project/src/pages/home/index',
      files: new Set(),
      hasScript: false,
      hasTemplate: false,
    }

    applyCandidateEntryFile(candidate, '/project/src/pages/home/index.vue')
    applyCandidateEntryFile(candidate, '/project/src/pages/home/index.wxml')
    applyCandidateEntryFile(candidate, '/project/src/pages/home/index.json')

    expect(candidate.files).toEqual(new Set([
      '/project/src/pages/home/index.vue',
      '/project/src/pages/home/index.wxml',
      '/project/src/pages/home/index.json',
    ]))
    expect(candidate.hasScript).toBe(true)
    expect(candidate.hasTemplate).toBe(true)
    expect(candidate.jsonPath).toBe('/project/src/pages/home/index.json')
  })

  it('does not treat declaration or sidecar files as scripts', () => {
    const candidate: CandidateEntry = {
      base: '/project/src/pages/home/index',
      files: new Set(),
      hasScript: false,
      hasTemplate: false,
    }

    applyCandidateEntryFile(candidate, '/project/src/pages/home/index.d.ts')
    applyCandidateEntryFile(candidate, '/project/src/pages/home/index.wxml.ts')
    applyCandidateEntryFile(candidate, '/project/src/pages/home/index.wxs.ts')

    expect(candidate.hasScript).toBe(false)
    expect(candidate.hasTemplate).toBe(false)
  })
})
