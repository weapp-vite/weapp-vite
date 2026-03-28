import type { CandidateEntry } from './candidates'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  applyCandidateEntryFile,
  buildDefaultSearchRoots,
  classifyPagesRootEntry,
  hasNestedPagesRoot,
  resolveCandidateEntryPath,
  resolveCandidateSearchRoots,
  resolveCollectTargetRoot,
  safeCrawlCandidateFiles,
  shouldCollectTargetRoot,
} from './candidates'
import { createAutoRoutesMatcher } from './matcher'

describe('auto routes candidates helpers', () => {
  it('classifies page root traversal entries', () => {
    expect(classifyPagesRootEntry('/project/src', {
      name: 'pages',
      isDirectory: () => true,
    })).toEqual({
      pageRoot: '/project/src/pages',
    })

    expect(classifyPagesRootEntry('/project/src', {
      name: 'pkgA',
      isDirectory: () => true,
    })).toEqual({
      nextPath: '/project/src/pkgA',
    })

    expect(classifyPagesRootEntry('/project/src', {
      name: '.git',
      isDirectory: () => true,
    })).toBeUndefined()

    expect(classifyPagesRootEntry('/project/src', {
      name: 'index.ts',
      isDirectory: () => false,
    })).toBeUndefined()
  })

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

  it('builds default search roots from discovered pages roots and subpackages', () => {
    expect(buildDefaultSearchRoots('/project/src', [
      '/project/src/pages',
      '/project/src/pkgA/pages',
    ], ['pkgA', 'pkgB'])).toEqual([
      '/project/src/pages',
      '/project/src/pkgA/pages',
      '/project/src/pkgB',
    ])

    expect(buildDefaultSearchRoots('/project/src', [], ['pkgA'])).toEqual([
      '/project/src',
      '/project/src/pkgA',
    ])
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

  it('checks target root existence and tolerates crawler failures', async () => {
    expect(await shouldCollectTargetRoot(path.resolve(process.cwd(), 'packages/weapp-vite/src'))).toBe(true)
    expect(await shouldCollectTargetRoot('/project/not-found')).toBe(false)

    const successCrawler = {
      crawl: () => ({
        withPromise: async () => ['/project/src/pages/home/index.vue'],
      }),
    } as any
    const failedCrawler = {
      crawl: () => ({
        withPromise: async () => {
          throw new Error('crawl failed')
        },
      }),
    } as any

    expect(await safeCrawlCandidateFiles(successCrawler, '/project/src')).toEqual([
      '/project/src/pages/home/index.vue',
    ])
    expect(await safeCrawlCandidateFiles(failedCrawler, '/project/src')).toEqual([])
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
