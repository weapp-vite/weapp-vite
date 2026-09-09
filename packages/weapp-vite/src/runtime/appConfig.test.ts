import { describe, expect, it } from 'vitest'
import { finalizeAppConfigForBuild } from './appConfig'

describe('finalizeAppConfigForBuild independent subpackages', () => {
  it.each([
    [undefined, true, true],
    [undefined, false, false],
    [false, true, false],
    [true, false, true],
    [undefined, undefined, undefined],
  ])('resolves manifest %s with configured %s to %s', (declared, configured, expected) => {
    const source = {
      pages: ['pages/index'],
      subPackages: [{ root: 'pkg', pages: ['pages/settings'], ...(declared === undefined ? {} : { independent: declared }) }],
    }
    const original = structuredClone(source)
    const result = finalizeAppConfigForBuild(source, {
      subPackages: {
        pkg: { independent: configured, inlineConfig: { mode: 'production' }, styles: ['theme.wxss'] },
      },
    })

    expect(result.subPackages).toEqual([
      { root: 'pkg', pages: ['pages/settings'], ...(expected === undefined ? {} : { independent: expected }) },
    ])
    expect(source).toEqual(original)
  })

  it('matches normalized roots and retains independent flags through build scope', () => {
    const result = finalizeAppConfigForBuild({
      pages: ['pages/index'],
      subpackages: [
        { root: 'pkg\\settings', pages: ['pages/index'] },
        { root: 'excluded', pages: ['pages/index'] },
      ],
    }, {
      subPackages: { '/pkg/settings/': { independent: true } },
      buildScope: { include: ['pkg/settings'] },
    })

    expect(result).toEqual({
      pages: ['pages/index'],
      subPackages: [{ root: 'pkg/settings', pages: ['pages/index'], independent: true }],
    })
  })
})
