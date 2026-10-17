import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { normalizeWatchPath } from '../../utils/path'
import { createAutoRoutesWatchDirectoryRegistry } from './watchDirectories'

const directory = (...segments: string[]) => normalizeWatchPath(path.resolve('watch-directory-fixture', ...segments))

describe('auto routes physical watch roots', () => {
  it('keeps the broadest initial roots regardless of discovery order', () => {
    for (const roots of [
      [directory('pages', 'home'), directory('pages')],
      [directory('pages'), directory('pages', 'home')],
    ]) {
      expect(createAutoRoutesWatchDirectoryRegistry().add(roots)).toEqual([directory('pages')])
    }
  })

  it('does not register covered roots again during scans and snapshots', () => {
    const registry = createAutoRoutesWatchDirectoryRegistry()
    expect(registry.add([directory('pages')])).toEqual([directory('pages')])
    expect(registry.add([directory('pages'), directory('pages', 'home'), directory('pages', '..cache')])).toEqual([])
    expect(registry.add([directory('pages', 'restored'), directory('pages')])).toEqual([])
  })

  it('registers external dependencies and sibling prefixes without duplicate entries', () => {
    const registry = createAutoRoutesWatchDirectoryRegistry()
    registry.add([directory('pages')])
    expect(registry.add([
      directory('pages-extra'),
      directory('external'),
      directory('external', 'nested'),
      directory('external'),
    ])).toEqual([directory('pages-extra'), directory('external')])
    expect(registry.add([directory('external', 'restored')])).toEqual([])
  })

  it('allows a newly discovered ancestor to cover the previously unwatched siblings', () => {
    const registry = createAutoRoutesWatchDirectoryRegistry()
    registry.add([directory('external', 'first')])
    expect(registry.add([directory('external')])).toEqual([directory('external')])
    expect(registry.add([directory('external', 'second')])).toEqual([])
  })

  it('uses the host filesystem path semantics for separators, traversal and casing', () => {
    const registry = createAutoRoutesWatchDirectoryRegistry()
    registry.add([directory('pages')])
    expect(registry.add([`${directory('pages')}${path.sep}.${path.sep}home`])).toEqual([])
    expect(registry.add([`${directory('pages')}${path.sep}..${path.sep}sibling`])).toEqual([directory('sibling')])
    if (process.platform === 'win32') {
      expect(registry.add([directory('PAGES'), directory('PAGES', 'home').replaceAll('/', '\\')])).toEqual([])
      const initial = createAutoRoutesWatchDirectoryRegistry()
      expect(initial.add([directory('pages'), directory('PAGES')])).toEqual([directory('pages')])
    }
    else {
      expect(registry.add([directory('PAGES')])).toEqual([directory('PAGES')])
    }
  })
})
