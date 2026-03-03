import type { SubPackageStyleEntry } from '../../../types'
import { describe, expect, it } from 'vitest'
import { collectSharedStyleEntries, injectSharedStyleImports } from './sharedStyles'

function createStyleEntry(overrides: Partial<SubPackageStyleEntry> = {}): SubPackageStyleEntry {
  return {
    source: 'styles/common.wxss',
    absolutePath: '/abs/pkgA/styles/common.wxss',
    outputRelativePath: 'pkgA/styles/common.wxss',
    inputExtension: '.wxss',
    scope: 'all',
    include: ['**/*'],
    exclude: [],
    ...overrides,
  }
}

function createConfigService(relativeAbsoluteSrcRoot: (id: string) => string | undefined) {
  return {
    relativeAbsoluteSrcRoot,
    currentSubPackageRoot: undefined,
  } as any
}

describe('sharedStyles helpers', () => {
  it('returns empty map when scan registry is missing', () => {
    const collected = collectSharedStyleEntries({} as any, {
      currentSubPackageRoot: undefined,
    } as any)
    expect(collected.size).toBe(0)
  })

  it('collects style entries from scan service and filters by current subpackage root', () => {
    const entryA = createStyleEntry()
    const entryB = createStyleEntry({
      outputRelativePath: 'pkgB/styles/common.wxss',
    })

    const ctx = {
      scanService: {
        subPackageMap: new Map([
          ['pkgA', { styleEntries: [entryA] }],
          ['pkgB', { styleEntries: [entryB] }],
          ['pkgC', { styleEntries: [] }],
        ]),
      },
    } as any

    const all = collectSharedStyleEntries(ctx, {
      currentSubPackageRoot: undefined,
    } as any)
    const onlyPkgB = collectSharedStyleEntries(ctx, {
      currentSubPackageRoot: 'pkgB',
    } as any)

    expect(Array.from(all.keys())).toEqual(['pkgA', 'pkgB'])
    expect(Array.from(onlyPkgB.keys())).toEqual(['pkgB'])
  })

  it('returns original css when module path cannot be resolved into src root', () => {
    const sharedStyles = new Map<string, SubPackageStyleEntry[]>([
      ['pkgA', [createStyleEntry()]],
    ])
    const css = '.page{color:red;}'

    const unresolved = injectSharedStyleImports(
      css,
      '/abs/pkgA/pages/foo.ts',
      'pkgA/pages/foo.wxss',
      sharedStyles,
      createConfigService(() => undefined),
    )
    const outsideRoot = injectSharedStyleImports(
      css,
      '/abs/pkgA/pages/foo.ts',
      'pkgA/pages/foo.wxss',
      sharedStyles,
      createConfigService(() => '../outside.ts'),
    )

    expect(unresolved).toBe(css)
    expect(outsideRoot).toBe(css)
  })

  it('injects shared imports for matching module/file with normalized relative paths', () => {
    const sharedStyles = new Map<string, SubPackageStyleEntry[]>([
      ['pkgA', [createStyleEntry()]],
    ])
    const css = '.page{color:red;}'

    const result = injectSharedStyleImports(
      css,
      '/abs/pkgA/pages/foo.ts',
      './pkgA/pages/foo.wxss',
      sharedStyles,
      createConfigService(() => './pkgA/pages/foo.ts'),
    )

    expect(result).toBe('@import \'../styles/common.wxss\';\n.page{color:red;}')
  })

  it('keeps charset prefix and only injects missing unique imports', () => {
    const sharedStyles = new Map<string, SubPackageStyleEntry[]>([
      ['pkgA', [
        createStyleEntry(),
        createStyleEntry({
          outputRelativePath: 'pkgA/styles/extra.wxss',
        }),
        createStyleEntry({
          outputRelativePath: 'pkgA/styles/extra.wxss',
        }),
      ]],
    ])
    const css = '@charset "utf-8";\n@import \'../styles/common.wxss\';\n.page{color:red;}'

    const result = injectSharedStyleImports(
      css,
      '/abs/pkgA/pages/foo.ts',
      'pkgA/pages/foo.wxss',
      sharedStyles,
      createConfigService(() => 'pkgA/pages/foo.ts'),
    )

    expect(result.startsWith('@import \'../styles/extra.wxss\';\n')).toBe(true)
    expect(result.includes('@charset "utf-8";')).toBe(true)
    expect(result.match(/@import '\.\.\/styles\/common\.wxss';/g)?.length).toBe(1)
  })

  it('skips entries with invalid roots and files outside the current root', () => {
    const sharedStyles = new Map<string, SubPackageStyleEntry[]>([
      ['///', [createStyleEntry()]],
      ['pkgB', [createStyleEntry({
        outputRelativePath: 'pkgB/styles/common.wxss',
      })]],
    ])
    const css = '.page{display:block;}'

    const result = injectSharedStyleImports(
      css,
      '/abs/pkgA/pages/foo.ts',
      'pkgA/pages/foo.wxss',
      sharedStyles,
      createConfigService(() => 'pkgA/pages/foo.ts'),
    )

    expect(result).toBe(css)
  })

  it('skips injection when include/exclude rules do not match current file', () => {
    const sharedStyles = new Map<string, SubPackageStyleEntry[]>([
      ['pkgA', [
        createStyleEntry({
          include: ['pages/**'],
          exclude: ['pages/private/**'],
        }),
      ]],
    ])
    const css = '.private{}'

    const result = injectSharedStyleImports(
      css,
      '/abs/pkgA/pages/private/secret.ts',
      'pkgA/pages/private/secret.wxss',
      sharedStyles,
      createConfigService(() => 'pkgA/pages/private/secret.ts'),
    )

    expect(result).toBe(css)
  })

  it('does not emit self import paths or no-op paths', () => {
    const sharedStyles = new Map<string, SubPackageStyleEntry[]>([
      ['pkgA', [
        createStyleEntry({
          outputRelativePath: 'pkgA/pages/foo.wxss',
        }),
      ]],
    ])
    const css = '.self{}'

    const result = injectSharedStyleImports(
      css,
      '/abs/pkgA/pages/foo.ts',
      'pkgA/pages/foo.wxss',
      sharedStyles,
      createConfigService(() => 'pkgA/pages/foo.ts'),
    )

    expect(result).toBe(css)
  })

  it('returns original css when relative candidates are empty for root file', () => {
    const sharedStyles = new Map<string, SubPackageStyleEntry[]>([
      ['pkgA', [createStyleEntry()]],
    ])
    const css = '.root{}'

    const result = injectSharedStyleImports(
      css,
      '/abs/pkgA/index.ts',
      'pkgA',
      sharedStyles,
      createConfigService(() => 'pkgA'),
    )

    expect(result).toBe(css)
  })

  it('reuses matcher cache and injects same-directory shared style as ./ path', () => {
    const cachedEntry = createStyleEntry({
      include: ['pages/**'],
      outputRelativePath: 'pkgA/pages/local.wxss',
    })
    const sharedStyles = new Map<string, SubPackageStyleEntry[]>([
      ['pkgA', [cachedEntry]],
    ])
    const css = '.cache{}'

    const first = injectSharedStyleImports(
      css,
      '/abs/pkgA/pages/foo.ts',
      'pkgA/pages/foo.wxss',
      sharedStyles,
      createConfigService(() => 'pkgA/pages/foo.ts'),
    )
    const second = injectSharedStyleImports(
      css,
      '/abs/pkgA/pages/bar.ts',
      'pkgA/pages/bar.wxss',
      sharedStyles,
      createConfigService(() => 'pkgA/pages/bar.ts'),
    )

    expect(first).toContain('@import \'./local.wxss\';')
    expect(second).toContain('@import \'./local.wxss\';')
  })

  it('skips malformed target specifiers and preserves charset ordering', () => {
    const sharedStyles = new Map<string, SubPackageStyleEntry[]>([
      ['pkgA', [
        createStyleEntry({
          outputRelativePath: 'pkgA/pages/.',
        }),
        createStyleEntry({
          outputRelativePath: 'pkgA/styles/common.wxss',
        }),
      ]],
    ])

    const result = injectSharedStyleImports(
      '@charset "utf-8";.page{}',
      '/abs/pkgA/pages/foo.ts',
      'pkgA/pages/foo.wxss',
      sharedStyles,
      createConfigService(() => 'pkgA/pages/foo.ts'),
    )

    expect(result).toContain('@charset "utf-8";')
    expect(result).toContain('@import \'../styles/common.wxss\';')
    expect(result).not.toContain('@import \'./\';')
  })

  it('does not prepend imports when all candidate imports already exist', () => {
    const sharedStyles = new Map<string, SubPackageStyleEntry[]>([
      ['pkgA', [
        createStyleEntry(),
      ]],
    ])
    const css = '@import \'../styles/common.wxss\';\n.page{}'

    const result = injectSharedStyleImports(
      css,
      '/abs/pkgA/pages/foo.ts',
      'pkgA/pages/foo.wxss',
      sharedStyles,
      createConfigService(() => 'pkgA/pages/foo.ts'),
    )

    expect(result).toBe(css)
  })
})
