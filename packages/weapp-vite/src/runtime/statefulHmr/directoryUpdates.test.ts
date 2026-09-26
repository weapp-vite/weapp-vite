import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { StatefulHmrDirectoryUpdates } from './directoryUpdates'

it('keeps directory metadata classification across repeated callbacks and missing event labels', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-directory-'))
  const directory = path.join(root, 'pages')
  const file = path.join(directory, 'index.js')
  try {
    await mkdir(directory)
    await writeFile(file, 'Page({})')
    const updates = new StatefulHmrDirectoryUpdates(root)
    updates.seedSources([file])
    expect(updates.observe(directory)).toBe(true)
    expect(updates.consume([directory, file])).toEqual([file])
    expect(updates.consume([directory, file])).toEqual([file])
    await rm(directory, { recursive: true })
    expect(updates.observe(directory, 'delete')).toBe(false)
    expect(updates.consume([directory])).toEqual([directory])
    await mkdir(directory)
    expect(updates.observe(directory, 'create')).toBe(false)
    expect(updates.observe(directory)).toBe(false)
    expect(updates.consume([directory])).toEqual([directory])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
