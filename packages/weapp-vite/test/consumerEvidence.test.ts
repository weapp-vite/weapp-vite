import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { afterEach, expect, it } from 'vitest'
import { verifyConsumerExports } from '../scripts/consumerEvidence.mjs'

const directories: string[] = []
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'consumer-evidence-'))
  directories.push(root)
  const packageRoot = path.join(root, 'node_modules/probe')
  await mkdir(path.join(packageRoot, 'dist'), { recursive: true })
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
    name: 'probe',
    version: '1.0.0',
    exports: { '.': { import: './dist/index.mjs', types: './dist/index.d.mts' } },
  }))
  await writeFile(path.join(packageRoot, 'dist/index.mjs'), 'export const probe = true')
  await writeFile(path.join(packageRoot, 'dist/index.d.mts'), 'export declare const probe: true')
  return { root, packageRoot }
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('rejects a missing public declaration even when the JavaScript export exists', async () => {
  const { root, packageRoot } = await fixture()
  await verifyConsumerExports(root, { probe: 'candidate.tgz' })
  await rm(path.join(packageRoot, 'dist/index.d.mts'))
  await expect(verifyConsumerExports(root, { probe: 'candidate.tgz' })).rejects.toThrow('Missing published target: probe@1.0.0 -> ./dist/index.d.mts')
})

it('rejects an exports mapping that leaves the installed package', async () => {
  const { root, packageRoot } = await fixture()
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: 'probe', exports: '../unpacked.mjs' }))
  await expect(verifyConsumerExports(root, { probe: 'candidate.tgz' })).rejects.toThrow('Invalid published target')
})

it('rejects loading an unpacked dependency through a workspace directory link', async () => {
  const { root, packageRoot } = await fixture()
  const external = await mkdtemp(path.join(tmpdir(), 'unpacked-source-'))
  directories.push(external)
  await writeFile(path.join(external, 'index.mjs'), 'export const source = true')
  await symlink(external, path.join(root, 'node_modules/unpacked'), 'junction')
  await writeFile(path.join(packageRoot, 'dist/index.mjs'), 'import "unpacked/index.mjs"')
  await expect(promisify(execFile)(process.execPath, [
    '--import',
    path.resolve(import.meta.dirname, '../scripts/consumerLoadProbe.mjs'),
    path.join(packageRoot, 'dist/index.mjs'),
  ], {
    env: { ...process.env, WEAPP_VITE_PROBE_ROOT: root, WEAPP_VITE_PROBE_OUTPUT: path.join(root, 'profile.json') },
  })).rejects.toMatchObject({ stderr: expect.stringContaining('Consumer loaded an unpacked module') })
})
