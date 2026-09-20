import type { MutableCompilerContext } from '../../../context'
import type { AutoRoutesSubPackage } from '../../../types/routes'
import type { CandidateEntry } from '../candidates'
import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../runtimeState'
import {
  scanRoutes,
  shouldIncludeScanCandidate,
  sortAutoRoutesEntries,
  sortAutoRoutesSubPackages,
} from './scan'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

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
      files: new Set(['/project/src/pages/home/index.ts']),
      hasScript: false,
      hasTemplate: false,
      jsonPath: '/project/src/pages/home/index.json',
    }, undefined)).toBe(false)

    expect(shouldIncludeScanCandidate({
      files: new Set(['/project/src/pages/home/index.ts']),
      hasScript: true,
      hasTemplate: false,
      jsonPath: '/project/src/pages/home/index.json',
    }, { component: true })).toBe(false)

    expect(shouldIncludeScanCandidate({
      files: new Set(['/project/src/pages/home/index.ts']),
      hasScript: true,
      hasTemplate: false,
      jsonPath: '/project/src/pages/home/index.json',
    }, {})).toBe(true)

    expect(shouldIncludeScanCandidate({
      files: new Set(['/project/src/pages/home/index.ts']),
      hasScript: false,
      hasTemplate: false,
      jsonPath: undefined,
    }, undefined)).toBe(false)

    expect(shouldIncludeScanCandidate({
      files: new Set(['/project/src/subpackages/item/issue-340-shared.ts']),
      hasScript: true,
      hasTemplate: false,
      jsonPath: undefined,
    }, undefined, {
      root: 'subpackages/item',
      pagePath: 'issue-340-shared',
    })).toBe(false)

    expect(shouldIncludeScanCandidate({
      files: new Set(['/project/src/subpackages/item/index.ts']),
      hasScript: true,
      hasTemplate: false,
      jsonPath: undefined,
    }, undefined, {
      root: 'subpackages/item',
      pagePath: 'index',
    })).toBe(true)

    expect(shouldIncludeScanCandidate({
      files: new Set(['/project/src/subpackages/user/register/form.vue']),
      hasScript: true,
      hasTemplate: false,
      jsonPath: undefined,
    }, undefined, {
      root: 'subpackages/user',
      pagePath: 'register/form',
    })).toBe(true)

    expect(shouldIncludeScanCandidate({
      files: new Set(['/project/src/pages/issue-484/define.ts']),
      hasScript: true,
      hasTemplate: false,
      jsonPath: undefined,
    }, undefined, {
      pagePath: 'pages/issue-484/define',
    })).toBe(false)

    expect(shouldIncludeScanCandidate({
      files: new Set(['/project/src/pages/home.ts']),
      hasScript: true,
      hasTemplate: false,
      jsonPath: undefined,
    }, undefined, {
      pagePath: 'pages/home',
    })).toBe(true)
  })

  it('uses one immutable candidate snapshot for route data and topology keys', async () => {
    const jsonReadStarted = createDeferred<void>()
    const jsonRead = createDeferred<Record<string, unknown>>()
    const base = '/project/src/pages/index/index'
    const candidate: CandidateEntry = {
      base,
      files: new Set([`${base}.json`]),
      hasScript: false,
      hasTemplate: true,
      jsonPath: `${base}.json`,
    }
    const candidates = new Map([[base, candidate]])
    const ctx = {
      runtimeState: createRuntimeState(),
      configService: {
        absoluteSrcRoot: '/project/src',
        cwd: '/project',
        weappViteConfig: {},
      },
      jsonService: {
        async read() {
          jsonReadStarted.resolve()
          return jsonRead.promise
        },
      },
    } as unknown as MutableCompilerContext
    const pendingScan = scanRoutes(ctx, candidates)
    await Promise.race([
      jsonReadStarted.promise,
      pendingScan.then(() => {
        throw new Error('Expected the scan to wait for its JSON source')
      }),
    ])

    candidate.files.add(`${base}.ts`)
    candidates.set('/project/src/pages/added/index', {
      base: '/project/src/pages/added/index',
      files: new Set(['/project/src/pages/added/index.ts']),
      hasScript: true,
      hasTemplate: false,
    })
    jsonRead.resolve({})
    const result = await pendingScan

    expect(result.snapshot.entries).toEqual(['pages/index/index'])
    expect(JSON.parse(result.topologyKey)).toMatchObject({
      candidates: [{
        base: 'pages/index/index',
        files: ['pages/index/index.json'],
      }],
    })
  })
})
