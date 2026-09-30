import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const requiredAssets = [
  'compiler/dist/index.js',
  ...['index.js', 'index.css', 'pageFrame.js', 'pageFrame.css', 'service.js'].map(file => `container-sdk/dist/${file}`),
]

async function assetHashes(directory: string) {
  const hashes: Record<string, string> = {}
  async function visit(relative: string) {
    for (const entry of await readdir(path.join(directory, 'fe/packages', relative), { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`
      if (entry.isDirectory()) {
        await visit(name)
      }
      else if (entry.isFile()) {
        hashes[name] = createHash('sha256').update(await readFile(path.join(directory, 'fe/packages', name))).digest('hex')
      }
    }
  }
  await visit('compiler/dist')
  await visit('container-sdk/dist')
  for (const name of requiredAssets) {
    if (!hashes[name]) {
      throw new Error(`Missing Dimina asset: ${name}`)
    }
  }
  return hashes
}

export async function recordPreparedAssets(directory: string) {
  await writeFile(path.join(directory, 'fe/.dimina-assets.json'), JSON.stringify(await assetHashes(directory)))
}

export async function validatePreparedAssets(directory: string) {
  const expected: unknown = JSON.parse(await readFile(path.join(directory, 'fe/.dimina-assets.json'), 'utf8'))
  const actual = await assetHashes(directory)
  if (!expected || typeof expected !== 'object'
    || Object.keys(expected).length !== Object.keys(actual).length
    || Object.entries(expected).some(([name, hash]) => actual[name] !== hash)) {
    throw new Error('Incomplete or modified Dimina assets')
  }
  await readFile(path.join(directory, 'fe/node_modules/.modules.yaml'))
}
