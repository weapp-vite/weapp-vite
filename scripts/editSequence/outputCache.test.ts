import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { restoreOwnedOutputs, retireOwnedOutputs } from './outputCache'

it('does not retire an owned name after another tool changed its content', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'output-owner-'))
  try {
    await writeFile(path.join(root, 'previous.js'), 'user replacement')
    await expect(retireOwnedOutputs(root, { 'previous.js': 'YnVpbHQ=' }, {})).rejects.toThrow('ownership changed')
    expect(await readFile(path.join(root, 'previous.js'), 'utf8')).toBe('user replacement')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects cache collisions before writing any restored file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'output-owner-'))
  try {
    await writeFile(path.join(root, 'user.js'), 'user asset')
    await expect(restoreOwnedOutputs(root, {}, { 'first.js': 'YnVpbHQ=', 'user.js': 'YnVpbHQ=' })).rejects.toThrow('unowned content')
    expect(await readFile(path.join(root, 'user.js'), 'utf8')).toBe('user asset')
    await expect(readFile(path.join(root, 'first.js'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(restoreOwnedOutputs(root, {}, { '../escape.js': 'YnVpbHQ=' })).rejects.toThrow('relative emitted files')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
