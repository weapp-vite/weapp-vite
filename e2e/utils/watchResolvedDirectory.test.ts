import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchResolvedDirectory } from './watchResolvedDirectory'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('watchResolvedDirectory', () => {
  it('registers the Windows long path while preserving the caller event callback', () => {
    const shortPath = 'C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\fixture\\dist'
    const longPath = 'C:\\Users\\runneradmin\\AppData\\Local\\Temp\\fixture\\dist'
    const resolve = vi.spyOn(fs.realpathSync, 'native').mockReturnValue(longPath)
    const watcher = { close: vi.fn() } as unknown as fs.FSWatcher
    const watch = vi.spyOn(fs, 'watch').mockReturnValue(watcher)
    const listener = vi.fn()

    expect(watchResolvedDirectory(shortPath, listener)).toBe(watcher)
    expect(resolve).toHaveBeenCalledWith(shortPath)
    expect(watch).toHaveBeenCalledExactlyOnceWith(longPath, listener)
    const callback = watch.mock.calls[0]![1] as fs.WatchListener<string>
    callback('change', 'app.json')
    expect(listener).toHaveBeenCalledExactlyOnceWith('change', 'app.json')
  })

  it('does not register the unresolved alias when the directory disappears', () => {
    vi.spyOn(fs.realpathSync, 'native').mockImplementation(() => {
      throw Object.assign(new Error('directory removed'), { code: 'ENOENT' })
    })
    const watch = vi.spyOn(fs, 'watch')
    expect(watchResolvedDirectory('removed-output', vi.fn())).toBeUndefined()
    expect(watch).not.toHaveBeenCalled()
  })

  it('allows a directory to disappear after resolving it and before watching it', () => {
    vi.spyOn(fs.realpathSync, 'native').mockReturnValue('resolved-output')
    vi.spyOn(fs, 'watch').mockImplementation(() => {
      throw Object.assign(new Error('directory removed'), { code: 'ENOENT' })
    })
    expect(watchResolvedDirectory('output-alias', vi.fn())).toBeUndefined()
  })

  it.each(['realpath', 'watch'])('propagates unexpected %s errors without silently dropping observation', (stage) => {
    const failure = Object.assign(new Error('access denied'), { code: 'EACCES' })
    vi.spyOn(fs.realpathSync, 'native').mockImplementation(() => {
      if (stage === 'realpath') {
        throw failure
      }
      return 'resolved-output'
    })
    vi.spyOn(fs, 'watch').mockImplementation(() => {
      throw failure
    })
    expect(() => watchResolvedDirectory('output-alias', vi.fn())).toThrow(failure)
  })
})
