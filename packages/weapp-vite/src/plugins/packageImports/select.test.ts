import { describe, expect, it } from 'vitest'
import { packageImportsConditions, selectPackageImportsPostfix } from './select'

const data = {
  name: 'imports-fixture',
  imports: {
    '#wild/*': './lib/*.js',
    '#exact': './lib/exact.js',
    '#literal?query': './lib/query.js',
    '#literal#fragment': './lib/fragment.js',
    '#wild#literal/*': './fragment/*.js',
    '#blocked': './lib/allowed.js',
    '#blocked?query': { absent: './lib/blocked.js' },
    '#null': './lib/allowed.js',
    '#null?query': null,
    '#mode/*': { require: './require/*.js', custom: './custom/*.js', production: './production/*.js', development: './development/*.js', default: './default/*.js' },
  },
}

describe('package imports postfix selection', () => {
  it.each([
    ['#wild/part?raw', '#wild/part', '?raw', './lib/part?raw.js'],
    ['#wild/part?raw&flag#anchor', '#wild/part', '?raw&flag#anchor', './lib/part?raw&flag#anchor.js'],
    ['#wild#literal/part?raw', '#wild#literal/part', '?raw', './fragment/part?raw.js'],
    ['#literal?query?raw', '#literal?query', '?raw', undefined],
    ['#literal#fragment?raw', '#literal#fragment', '?raw', undefined],
    ['#exact?raw', '#exact', '?raw', undefined],
  ])('separates %s without discarding literal key characters', (id, key, postfix, originalTarget) => {
    expect(selectPackageImportsPostfix(data, id, ['import'])).toMatchObject({ key, postfix, originalTarget })
  })

  it.each(['#literal?query', '#literal#fragment', '#blocked?query', '#null?query', '#missing?raw', '#wild/part'])('leaves native resolution of %s intact', (id) => {
    expect(selectPackageImportsPostfix(data, id, ['import'])).toBeUndefined()
  })

  it.each([
    [false, false, [], './development/part?raw.js'],
    [true, false, [], './production/part?raw.js'],
    [false, true, [], './require/part?raw.js'],
    [false, false, ['custom'], './custom/part?raw.js'],
  ] as const)('uses environment and require-call conditions', (production, require, custom, target) => {
    const conditions = packageImportsConditions([...custom, 'development|production'], production, require)
    expect(selectPackageImportsPostfix(data, '#mode/part?raw', conditions)?.originalTarget).toBe(target)
  })

  it('leaves packages without an imports object intact', () => {
    expect(selectPackageImportsPostfix({ imports: [] }, '#wild/part?raw', [])).toBeUndefined()
    expect(selectPackageImportsPostfix({}, '#wild/part?raw', [])).toBeUndefined()
  })
})
