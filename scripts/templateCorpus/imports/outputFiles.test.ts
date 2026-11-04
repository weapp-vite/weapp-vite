import type { CorpusFileIdentity } from '../types'
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { corpusHash } from '../integrity'
import { assertOutputIdentity, ownedFiles, ownedOutputFiles, readOwnedFile, readVerifiedFile, readVerifiedOutput } from './files'

const temporary: string[] = []
const outputFile = 'out/production/src/npm/.pnpm/components@1/node_modules/components/button.ux'
const source = '<template><div>😀</div></template>'

async function project() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-output-'))
  temporary.push(directory)
  await mkdir(path.dirname(path.join(directory, outputFile)), { recursive: true })
  await writeFile(path.join(directory, outputFile), source)
  return directory
}

function identity(file = outputFile): CorpusFileIdentity {
  return { file, sha256: corpusHash(source), bytes: new TextEncoder().encode(source).length }
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('allows emitted node_modules exclusively inside the declared output mode', async () => {
  const directory = await project()
  expect(await ownedOutputFiles(directory, 'production')).toEqual([outputFile])
  expect(new TextDecoder().decode(await readVerifiedOutput(directory, identity(), 'production'))).toBe(source)
  await expect(readOwnedFile(directory, outputFile)).rejects.toThrow('Unsafe imported file path')
  await expect(readVerifiedFile(directory, identity())).rejects.toThrow('Unsafe imported file path')
  await expect(ownedFiles(directory, 'out/production')).rejects.toThrow('Unsafe imported directory entry')
})

it.each([
  'node_modules/components/button.ux',
  'out/development/button.ux',
  'out/production',
  'out/production/../button.ux',
  'out/production/./button.ux',
  'out/production//button.ux',
  '/out/production/button.ux',
  'out/production/button\\escape.ux',
  'out/production/button:escape.ux',
  'out/production/button\u0000escape.ux',
  'out/production/button\u007Fescape.ux',
])('rejects a nonportable or out-of-mode output identity: %s', (file) => {
  expect(() => assertOutputIdentity(identity(file), 'production')).toThrow('Unsafe imported output path')
})

it('rejects invalid modes, changed output sizes and changed output bytes', async () => {
  const directory = await project()
  expect(() => assertOutputIdentity(identity(), 'other')).toThrow('Unsafe imported output path')
  await expect(ownedOutputFiles(directory, 'other')).rejects.toThrow('Unsafe imported output mode')
  await expect(readVerifiedOutput(directory, { ...identity(), bytes: 0 }, 'production')).rejects.toThrow('Imported output size changed')
  await expect(readVerifiedOutput(directory, { ...identity(), sha256: 'f'.repeat(64) }, 'production')).rejects.toThrow('Imported output hash changed')
})

it.each(['out', 'out/production', 'out/production/src/npm', outputFile])('refuses output symlinks at every level: %s', async (file) => {
  const directory = await project()
  const original = path.join(directory, file)
  const relocated = path.join(directory, 'relocated')
  await rename(original, relocated)
  await symlink(relocated, original)
  await expect(readVerifiedOutput(directory, identity(), 'production')).rejects.toThrow('cannot follow symbolic links')
  await expect(ownedOutputFiles(directory, 'production')).rejects.toThrow(/symbolic links|Unsafe imported directory entry/)
})

it('rejects a linked project root before reading its ordinary output tree', async () => {
  const directory = await project()
  const parent = await mkdtemp(path.join(os.tmpdir(), 'corpus-output-link-'))
  temporary.push(parent)
  const linked = path.join(parent, 'linked')
  await symlink(directory, linked)
  await expect(readVerifiedOutput(linked, identity(), 'production')).rejects.toThrow('root must be an ordinary directory')
  await expect(ownedOutputFiles(linked, 'production')).rejects.toThrow('root must be an ordinary directory')
})
