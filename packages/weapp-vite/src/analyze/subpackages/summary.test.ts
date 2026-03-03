import { describe, expect, it } from 'vitest'
import {
  expandVirtualModulePlacements,
  summarizeModules,
  summarizePackages,
  summarizeSubPackages,
} from './summary'

describe('analyze subpackages summary', () => {
  it('summarizes packages with stable type and id ordering', () => {
    const packages = new Map<string, any>([
      ['b', {
        id: 'b',
        label: 'B',
        type: 'subPackage',
        files: new Map([
          ['b/z.js', { file: 'b/z.js', type: 'chunk', from: 'main' }],
          ['b/a.js', { file: 'b/a.js', type: 'chunk', from: 'main' }],
        ]),
      }],
      ['__main__', {
        id: '__main__',
        label: 'main',
        type: 'main',
        files: new Map([
          ['main/index.js', { file: 'main/index.js', type: 'chunk', from: 'main' }],
        ]),
      }],
      ['a', {
        id: 'a',
        label: 'A',
        type: 'independent',
        files: new Map([
          ['a/index.js', { file: 'a/index.js', type: 'chunk', from: 'independent' }],
        ]),
      }],
    ])

    const reports = summarizePackages(packages)
    expect(reports.map(item => item.id)).toEqual(['__main__', 'b', 'a'])
    expect(reports.find(item => item.id === 'b')?.files.map(file => file.file)).toEqual([
      'b/a.js',
      'b/z.js',
    ])
  })

  it('summarizes module usage and sorts package references/files', () => {
    const modules = new Map<string, any>([
      ['/a.ts', {
        id: '/a.ts',
        source: 'src/a.ts',
        sourceType: 'src',
        packages: new Map([
          ['pkg-b', new Set(['pkg-b/z.js', 'pkg-b/a.js'])],
          ['__main__', new Set(['main/b.js', 'main/a.js'])],
        ]),
      }],
      ['/b.ts', {
        id: '/b.ts',
        source: 'src/b.ts',
        sourceType: 'src',
        packages: new Map([
          ['pkg-a', new Set(['pkg-a/index.js'])],
        ]),
      }],
    ])

    const usage = summarizeModules(modules)
    expect(usage.map(item => item.source)).toEqual(['src/a.ts', 'src/b.ts'])
    expect(usage[0]?.packages).toEqual([
      {
        packageId: '__main__',
        files: ['main/a.js', 'main/b.js'],
      },
      {
        packageId: 'pkg-b',
        files: ['pkg-b/a.js', 'pkg-b/z.js'],
      },
    ])
  })

  it('expands virtual package placements to concrete subpackages with fallback', () => {
    const modules = new Map<string, any>([
      ['/shared.ts', {
        id: '/shared.ts',
        source: 'src/shared.ts',
        sourceType: 'src',
        packages: new Map([
          ['virtual:pkgA+pkgB', new Set(['assets/home.js', 'assets/unknown.js'])],
          ['virtual:unknown', new Set(['assets/home.js'])],
        ]),
      }],
    ])

    const packages = new Map<string, any>([
      ['pkgA', {
        id: 'pkgA',
        label: 'A',
        type: 'subPackage',
        files: new Map([
          ['pkgA/home.js', { file: 'pkgA/home.js', type: 'chunk', from: 'main' }],
          ['pkgA/list.js', { file: 'pkgA/list.js', type: 'chunk', from: 'main' }],
        ]),
      }],
      ['pkgB', {
        id: 'pkgB',
        label: 'B',
        type: 'subPackage',
        files: new Map([
          ['pkgB/fallback.js', { file: 'pkgB/fallback.js', type: 'chunk', from: 'main' }],
        ]),
      }],
    ])

    expandVirtualModulePlacements(
      modules,
      packages,
      {
        subPackageRoots: new Set(['pkgA', 'pkgB']),
        independentRoots: new Set(),
      },
    )

    const moduleEntry = modules.get('/shared.ts')
    expect(Array.from(moduleEntry.packages.get('pkgA') as Set<string>)).toEqual(['pkgA/home.js'])
    expect(Array.from(moduleEntry.packages.get('pkgB') as Set<string>)).toEqual(['pkgB/fallback.js'])
    expect(moduleEntry.packages.has('unknown')).toBe(false)
  })

  it('summarizes subpackages by filtering empty roots and sorting', () => {
    const descriptors = summarizeSubPackages([
      {
        subPackage: {
          root: 'b',
          independent: true,
          name: 'B',
        },
      },
      {
        subPackage: {
          root: '',
          independent: false,
          name: 'empty',
        },
      },
      {
        subPackage: {
          root: 'a',
          independent: false,
          name: 'A',
        },
      },
    ] as any)

    expect(descriptors).toEqual([
      {
        root: 'a',
        independent: false,
        name: 'A',
      },
      {
        root: 'b',
        independent: true,
        name: 'B',
      },
    ])
  })
})
