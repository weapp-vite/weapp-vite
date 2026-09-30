import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { cacheRoot, root, upstreamCommit } from '../config'
import { validatePreparedAssets } from './preparedAssets'

export async function preparationInputs(projectRoot = root) {
  const patchRoot = path.join(projectRoot, 'upstream/patches')
  const patches = (await readdir(patchRoot)).filter(name => name.endsWith('.patch')).sort()
  const hash = createHash('sha256').update(upstreamCommit)
  for (const name of ['upstream/pnpm-lock.yaml', 'scripts/setup.ts', 'scripts/preparation.ts', 'scripts/prepareSource.ts', 'scripts/preparedAssets.ts', 'scripts/upstreamTests.ts', 'scripts/toolchain.ts', 'upstream/toolchain/package.json', 'upstream/toolchain/package-lock.json', 'upstream/toolchain/pnpm-workspace.yaml', ...patches.map(name => `upstream/patches/${name}`)]) {
    hash.update(name).update(await readFile(path.join(projectRoot, name)))
  }
  return { fingerprint: hash.digest('hex'), patches: patches.map(name => path.join(patchRoot, name)) }
}

export async function preparedRoot(projectRoot = root, cacheDirectory = cacheRoot, options: { allowMissingDependencies?: boolean } = {}) {
  const { fingerprint } = await preparationInputs(projectRoot)
  let value: unknown
  try {
    value = JSON.parse(await readFile(path.join(cacheDirectory, 'ready.json'), 'utf8'))
  }
  catch { value = null }
  if (!value || typeof value !== 'object' || !('fingerprint' in value) || value.fingerprint !== fingerprint
    || !('commit' in value) || value.commit !== upstreamCommit
    || !('directory' in value) || typeof value.directory !== 'string' || !/^build-[\w-]+$/.test(value.directory)) {
    throw new Error('Run pnpm --filter @weapp-vite/dimina-playground setup:dimina first (missing or stale SDK).')
  }
  const directory = path.join(cacheDirectory, value.directory)
  try {
    await validatePreparedAssets(directory)
    if (!options.allowMissingDependencies) {
      await readFile(path.join(directory, 'fe/node_modules/.modules.yaml'))
    }
  }
  catch { throw new Error('Run setup:dimina again (incomplete SDK assets or dependencies).') }
  return directory
}
