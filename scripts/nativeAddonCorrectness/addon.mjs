import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { candidateFile } from './manifest.mjs'

export function selectLoadedAddonFiles(root, entry, modules) {
  const packageRoot = path.dirname(entry)
  const loaded = []
  for (const module of modules) {
    if (module.loaded && module.filename.endsWith('.node') && path.dirname(module.filename) === packageRoot) {
      loaded.push(module.filename)
    }
  }
  if (loaded.length !== 1) {
    throw new Error('Expected exactly one actually loaded candidate addon')
  }
  return [entry, loaded[0]].map(file => path.relative(root, file).replaceAll('\\', '/'))
}

export function loadedAddonFiles(root, entry) {
  const require = createRequire(pathToFileURL(entry))
  return selectLoadedAddonFiles(root, entry, Object.values(require.cache))
}

export async function hashAddonFiles(root, files) {
  if (!Array.isArray(files) || files.length !== 2 || files[0] !== 'packages/ast-native/index.js'
    || typeof files[1] !== 'string' || !/^packages\/ast-native\/[a-z][\w.-]*\.node$/u.test(files[1])) {
    throw new Error('Invalid actual addon entry or binary identity')
  }
  return Promise.all(files.map(async file => ({
    file,
    sha256: createHash('sha256').update(await readFile(await candidateFile(root, file))).digest('hex'),
  })))
}

export async function verifyAddonFiles(root, identity) {
  if (!Array.isArray(identity) || !isDeepStrictEqual(identity, await hashAddonFiles(root, identity.map(item => item?.file)))) {
    throw new Error('Actual addon entry or binary changed after preflight')
  }
  return identity
}
