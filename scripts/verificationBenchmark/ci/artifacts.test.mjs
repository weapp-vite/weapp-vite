import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { readArtifactDocuments } from './artifacts.mjs'

it('selects all dated reports by a frozen pattern and exact count', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'benchmark-artifact-'))
  try {
    for (const name of ['2026-10-18-a', '2026-10-19-b']) {
      const folder = path.join(directory, 'dom-acceptance', name)
      await mkdir(folder, { recursive: true })
      await writeFile(path.join(folder, 'index.json'), JSON.stringify({ name }))
    }
    const download = async () => ({ directory })
    const selector = { artifact: 'reports', filePattern: '**/dom-acceptance/**/index.json', expectedCount: 2 }
    expect((await readArtifactDocuments(selector, download)).map(bytes => JSON.parse(bytes.toString('utf8')))).toHaveLength(2)
    await expect(readArtifactDocuments({ ...selector, expectedCount: 1 }, download)).rejects.toThrow(/expected 1/u)
    await expect(readArtifactDocuments({ ...selector, expectedCount: 3 }, download)).rejects.toThrow(/expected 3/u)
    await expect(readArtifactDocuments({ ...selector, file: 'index.json' }, download)).rejects.toThrow(/exactly one/u)
    await expect(readArtifactDocuments({ ...selector, filePattern: '../**/index.json' }, download)).rejects.toThrow(/relative/u)
    await expect(readArtifactDocuments({ ...selector, filePattern: '**/{a,b}.json' }, download)).rejects.toThrow(/support/u)
    await symlink(path.join(directory, 'dom-acceptance'), path.join(directory, 'linked'))
    await expect(readArtifactDocuments(selector, download)).rejects.toThrow(/symlink/u)
    await expect(readArtifactDocuments({ artifact: 'reports', file: 'linked/2026-10-18-a/index.json' }, download)).rejects.toThrow(/symlink/u)
    expect(Buffer.isBuffer((await readArtifactDocuments({ artifact: 'reports', file: 'dom-acceptance/2026-10-18-a/index.json' }, download))[0])).toBe(true)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})
