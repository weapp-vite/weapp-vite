import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { pruneOwnedAssetFiles } from './prune'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'owned-asset-prune-'))
  roots.push(root)
  const outDir = path.join(root, 'dist')
  await mkdir(path.join(outDir, 'nested'), { recursive: true })
  await writeFile(path.join(outDir, 'nested/copied.txt'), 'owned')
  await writeFile(path.join(root, 'outside.txt'), 'outside')
  return { root, outDir }
}

it('accepts normalized asset names and tolerates already absent outputs', async () => {
  const { outDir } = await fixture()
  await pruneOwnedAssetFiles(outDir, ['nested\\copied.txt', 'missing/old.txt'])
  await expect(readFile(path.join(outDir, 'nested/copied.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it.each(['../outside.txt', '..\\outside.txt', '.', '/outside.txt', 'C:\\outside.txt'])('rejects escaping or non-file names before deletion: %s', async (file) => {
  const { root, outDir } = await fixture()
  await expect(pruneOwnedAssetFiles(outDir, ['nested/copied.txt', file])).rejects.toThrow('Invalid owned output')
  await expect(readFile(path.join(outDir, 'nested/copied.txt'), 'utf8')).resolves.toBe('owned')
  await expect(readFile(path.join(root, 'outside.txt'), 'utf8')).resolves.toBe('outside')
})

it('does not follow an output subdirectory symlink to remove an external file', async () => {
  const { root, outDir } = await fixture()
  await symlink(root, path.join(outDir, 'linked'), 'junction')
  await expect(pruneOwnedAssetFiles(outDir, ['linked/outside.txt'])).rejects.toThrow('outside the output directory')
  await expect(readFile(path.join(root, 'outside.txt'), 'utf8')).resolves.toBe('outside')
})
