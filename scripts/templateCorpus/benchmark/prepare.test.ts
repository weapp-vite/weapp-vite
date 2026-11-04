import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { assertProfileArtifacts, prepareProfile } from './prepare'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('bundles and fingerprints executed transitive dependencies in a Node-only run', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-profile-prepare-'))
  directories.push(directory)
  const entry = path.join(directory, 'candidate.mjs')
  const output = path.join(directory, 'run')
  await writeFile(entry, 'export const marker = "controlled-built-entry"\n')
  await mkdir(output)
  const prepared = await prepareProfile(entry, output, false)
  expect(prepared.browserCode).toBeUndefined()
  const inputs = Object.keys(prepared.artifacts)
  expect(inputs.some(file => file.includes('/node_modules/domhandler/'))).toBe(true)
  expect(inputs.some(file => file.includes('/node_modules/entities/'))).toBe(true)
  expect(typeof prepared.run).toBe('function')
  await assertProfileArtifacts(prepared.artifacts)
  expect(await readFile(path.join(output, 'profile-runtime.mjs'), 'utf8')).toContain('controlled-built-entry')
  await writeFile(entry, 'export const marker = "changed-built-entry"\n')
  await expect(assertProfileArtifacts(prepared.artifacts)).rejects.toThrow('artifact changed during measurement')
})
