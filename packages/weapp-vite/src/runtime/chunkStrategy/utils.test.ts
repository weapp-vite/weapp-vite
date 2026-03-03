import { describe, expect, it } from 'vitest'
import {
  containsImportSpecifier,
  createRelativeImport,
  hasInCollection,
  replaceAll,
} from './utils'

describe('chunkStrategy utils', () => {
  it('replaces matched source segments with direct and trimmed "./" fallback', () => {
    expect(replaceAll('import "./a.js"', './a.js', './b.js')).toBe('import "./b.js"')
    expect(replaceAll('import "a.js"', './a.js', './b.js')).toBe('import "b.js"')
    expect(replaceAll('import "x.js"', './a.js', './b.js')).toBe('import "x.js"')
    expect(replaceAll('import "x.js"', '', './b.js')).toBe('import "x.js"')
  })

  it('detects import specifier with direct and trimmed "./" match', () => {
    expect(containsImportSpecifier('import "./a.js"', './a.js')).toBe(true)
    expect(containsImportSpecifier('import "a.js"', './a.js')).toBe(true)
    expect(containsImportSpecifier('import "x.js"', './a.js')).toBe(false)
    expect(containsImportSpecifier('import "x.js"', '')).toBe(false)
  })

  it('checks membership for Set/Array/Map and returns false for unsupported input', () => {
    expect(hasInCollection(new Set(['a']), 'a')).toBe(true)
    expect(hasInCollection(['a', 'b'], 'b')).toBe(true)
    expect(hasInCollection(new Map([['k', 1]]), 'k')).toBe(true)
    expect(hasInCollection({ a: 1 }, 'a')).toBe(false)
    expect(hasInCollection(undefined, 'a')).toBe(false)
    expect(hasInCollection([], '')).toBe(false)
  })

  it('creates normalized relative import path', () => {
    expect(createRelativeImport('/project/src/pages/a.js', '/project/src/pages/a.js')).toBe('./a.js')
    expect(createRelativeImport('/project/src/pages/a.js', '/project/src/pages/b.js')).toBe('./b.js')
    expect(createRelativeImport('/project/src/pages/a.js', '/project/src/shared/c.js')).toBe('../shared/c.js')
  })
})
