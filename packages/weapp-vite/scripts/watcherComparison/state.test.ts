import { describe, expect, it } from 'vitest'
import { matchesWatcherChange } from './state'

describe('watcher comparison path identity', () => {
  it('matches Windows native input paths with normalized adapter paths', () => {
    expect(matchesWatcherChange(
      { file: 'C:/project/src/entry.js', event: 'update', kind: 'file' },
      { file: 'C:\\project\\src\\entry.js', event: 'update', kind: 'file', contents: 'saved' },
    )).toBe(true)
  })

  it('retains event, kind and case differences after separator normalization', () => {
    const change = { file: 'C:/project/src/entry.js', event: 'update', kind: 'file' } as const
    expect(matchesWatcherChange(change, { ...change, event: 'delete' })).toBe(false)
    expect(matchesWatcherChange(change, { ...change, kind: 'directory' })).toBe(false)
    expect(matchesWatcherChange(change, { ...change, file: 'C:/project/src/Entry.js' })).toBe(false)
    expect(matchesWatcherChange(change, { file: change.file, kind: 'file' })).toBe(true)
  })
})
