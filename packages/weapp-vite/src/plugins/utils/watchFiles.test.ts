import { describe, expect, it, vi } from 'vitest'
import { addNormalizedWatchFile, addNormalizedWatchFiles } from './watchFiles'

describe('watch file helpers', () => {
  it('adds normalized watch files when addWatchFile is available', () => {
    const addWatchFile = vi.fn()

    expect(addNormalizedWatchFile({ addWatchFile }, 'foo\\bar//main.wxml')).toBe(true)
    expect(addWatchFile).toHaveBeenCalledWith('foo/bar/main.wxml')
  })

  it('skips empty files and missing addWatchFile hooks', () => {
    expect(addNormalizedWatchFile({}, 'foo.wxml')).toBe(false)
    expect(addNormalizedWatchFile({ addWatchFile: vi.fn() }, undefined)).toBe(false)
  })

  it('adds multiple normalized watch files', () => {
    const addWatchFile = vi.fn()

    expect(addNormalizedWatchFiles({ addWatchFile }, ['foo\\bar.js', undefined, 'baz//qux.ts'])).toBe(2)
    expect(addWatchFile).toHaveBeenNthCalledWith(1, 'foo/bar.js')
    expect(addWatchFile).toHaveBeenNthCalledWith(2, 'baz/qux.ts')
  })
})
