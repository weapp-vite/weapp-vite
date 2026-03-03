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
})
