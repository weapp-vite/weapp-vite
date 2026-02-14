import { describe, expect, it } from 'vitest'
import { createTypedRouterDefinition } from './format'

describe('createTypedRouterDefinition', () => {
  it('emits mutable tuple aliases with literal entries', () => {
    const dts = createTypedRouterDefinition({
      pages: ['pages/home/index', 'pages/logs/index'],
      entries: ['pages/home/index', 'pages/logs/index'],
      subPackages: [],
    })

    expect(dts).toContain('/* eslint-disable */')
    expect(dts).toContain('// biome-ignore lint: disable')
    expect(dts).toContain('// oxlint-disable')
    expect(dts).toContain('// ------')
    expect(dts).not.toContain('readonly [')
    expect(dts).toContain('    export type AutoRoutesPages = [')
    expect(dts).toContain('        "pages/home/index"')
    expect(dts).toContain('        "pages/logs/index"')
    expect(dts).toContain('    export type AutoRoutesEntries = [')
    expect(dts).toContain('export type AutoRoutesSubPackages = [];')
  })

  it('preserves subpackage tuple literal shape', () => {
    const dts = createTypedRouterDefinition({
      pages: ['pages/home/index'],
      entries: ['pages/home/index', 'packageA/pages/cat'],
      subPackages: [
        {
          root: 'packageA',
          pages: ['pages/cat'],
        },
      ],
    })

    expect(dts).toContain('    export type AutoRoutesSubPackages = [')
    expect(dts).toContain('            readonly root: "packageA";')
    expect(dts).toContain('            readonly pages: [')
    expect(dts).toContain('"pages/cat"')
    expect(dts).not.toContain('readonly [')
  })
})
