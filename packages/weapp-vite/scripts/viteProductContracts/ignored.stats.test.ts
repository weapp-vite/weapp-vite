import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { ignoredFor } from './ignored'

it.each([false, true])('ignores empty files and rechecks updated files with bigint stats=%s', async (bigint) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vite-ignored-stats-'))
  try {
    const ignored = ignoredFor('stats-file', root)
    if (typeof ignored !== 'function') {
      throw new TypeError('The stats-file selection must provide an ignored callback')
    }
    const file = path.join(root, 'empty.js')
    await writeFile(file, '')
    const readStats = (input: string) => bigint ? stat(input, { bigint: true }) : stat(input)

    expect(ignored(file)).toBe(false)
    expect(ignored(root, await readStats(root))).toBe(false)
    expect(ignored(file, await readStats(file))).toBe(true)

    await writeFile(file, 'export const value = 42')
    expect(ignored(file, await readStats(file))).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
