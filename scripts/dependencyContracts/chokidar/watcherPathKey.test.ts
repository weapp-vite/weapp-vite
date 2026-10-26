import { expect, it } from 'vitest'
import { watcherPathKey } from './watcherPathKey.mjs'

it('uses v6 logical separators without folding case or changing another path', () => {
  const watcher = { events: { pendingUnlinks: new Map() } }
  const file = String.raw`C:\fixture\MixedCase\entry.txt`
  expect(watcherPathKey(watcher, file)).toBe('C:/fixture/MixedCase/entry.txt')
  expect(watcherPathKey(watcher, '//server/share/MixedCase/entry.txt')).toBe('//server/share/MixedCase/entry.txt')
  expect(watcherPathKey(watcher, file)).not.toBe(watcherPathKey(watcher, String.raw`C:\fixture\mixedcase\entry.txt`))
  expect(watcherPathKey(watcher, file)).not.toBe(watcherPathKey(watcher, String.raw`C:\fixture\MixedCase\other.txt`))
})

it('keeps the original native key for the legacy pending-unlink map', () => {
  const file = String.raw`C:\fixture\MixedCase\entry.txt`
  expect(watcherPathKey({ _pendingUnlinks: new Map() }, file)).toBe(file)
})
